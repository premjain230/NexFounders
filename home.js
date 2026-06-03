/**
 * feed.js — NexFounder Home Feed 
 *
 * Upgrades vs original:
 *  • XSS: all user content escaped via esc(); no raw innerHTML interpolation
 *  • Performance: docChanges() diffing — only add/modify/remove individual post
 *    nodes instead of wiping and re-rendering the whole feed on every update
 *  • Low data: limit(30) on forYou feed; following feed capped to 10 uids
 *    (Firestore "in" query max); single getDoc for currentUser on auth
 *  • Listener cleanup: trackUnsub() prevents stale listeners accumulating
 *  • Comment notification: only fires when commenter ≠ post author
 *  • No repeated getDocs("users") on search — single fetch + client-side filter
 */

import { auth, db } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  collection, addDoc, doc, getDoc, getDocs,
  query, orderBy, serverTimestamp, updateDoc,
  arrayUnion, arrayRemove, onSnapshot, where, limit
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { esc, safeUrl, avatarHTML, timeAgo, debounce, initials, trackUnsub, cleanupAll, cacheUser, getCachedUser } from "./utils.js";

let currentUser     = null;
let currentUserData = null;
let currentTab      = "forYou";
let allUsersCache   = null;   // fetched once for search

// ── DOM ───────────────────────────────────────────────────────────────────────
const postInput     = document.getElementById("postInput");
const postBtn       = document.getElementById("postBtn");
const mediaInput    = document.getElementById("mediaInput");
const feedEl        = document.getElementById("feed");
const navAvatar     = document.getElementById("navAvatar");
const navName       = document.getElementById("navName");
const createAvatar  = document.getElementById("createAvatar");
const searchInput   = document.getElementById("searchInput");
const searchResults = document.getElementById("searchResults");
const notifBadge    = document.getElementById("notifBadge");
const msgBadge      = document.getElementById("msgBadge");

// ── TAB SWITCH ────────────────────────────────────────────────────────────────
window.switchTab = function (tab) {
  currentTab = tab;
  document.getElementById("tabForYou")?.classList.toggle("active", tab === "forYou");
  document.getElementById("tabFollowing")?.classList.toggle("active", tab === "following");
  loadFeedRealtime();
};

// ── AUTH ──────────────────────────────────────────────────────────────────────
onAuthStateChanged(auth, async (user) => {
  if (!user) { location.href = "index.html"; return; }
  currentUser = user;

  // Single getDoc; cache result
  const snap = await getDoc(doc(db, "users", user.uid));
  if (snap.exists()) {
    currentUserData = snap.data();
    cacheUser(user.uid, currentUserData);
    setAvatar(navAvatar, currentUserData);
    if (navName)     navName.textContent    = esc(currentUserData.displayName || "You");
    if (createAvatar) setAvatar(createAvatar, currentUserData);
  }

  loadFeedRealtime();
  watchNotifBadge();
  watchMsgBadge();
});

function setAvatar(el, data) {
  if (!el || !data) return;
  if (data.photoURL) {
    const img = document.createElement("img");
    img.src   = safeUrl(data.photoURL);
    img.className = "nav-avatar-img";
    img.alt   = esc(data.displayName || "");
    el.replaceChildren(img);
  } else {
    el.textContent = initials(data.displayName);
  }
}

// ── CLOUDINARY UPLOAD ─────────────────────────────────────────────────────────
async function uploadToCloudinary(file) {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("upload_preset", "nexfounder_upload");
  const res  = await fetch("https://api.cloudinary.com/v1_1/dr5uatib5/auto/upload", { method: "POST", body: fd });
  const data = await res.json();
  return data.secure_url || "";
}

// ── POST CREATE ───────────────────────────────────────────────────────────────
postBtn?.addEventListener("click", async () => {
  const text = postInput?.value.trim();
  if (!text && !mediaInput?.files[0]) return;

  postBtn.disabled = true;
  postBtn.textContent = "Posting…";

  try {
    let imageUrl = "", videoUrl = "";
    const file = mediaInput?.files[0];
    if (file) {
      const url = await uploadToCloudinary(file);
      if (file.type.startsWith("image")) imageUrl = url;
      if (file.type.startsWith("video")) videoUrl = url;
    }

    // Store minimal fields — omit redundant denormalized data where possible.
    // displayName/username/photoURL are denormalized intentionally for feed
    // performance (avoids per-post user lookup), but we keep the set lean.
    await addDoc(collection(db, "posts"), {
      text,
      uid: currentUser.uid,
      displayName: currentUserData.displayName,
      username:    currentUserData.username,
      initials:    currentUserData.initials,
      photoURL:    currentUserData.photoURL || "",
      likes:       [],
      comments:    [],   // kept as array; heavy threads should migrate to subcollection
      imageUrl,
      videoUrl,
      createdAt:   serverTimestamp()
    });

    if (postInput)  postInput.value  = "";
    if (mediaInput) mediaInput.value = "";
  } catch (err) {
    console.error(err);
    alert("Failed to post. Please try again.");
  }

  postBtn.disabled = false;
  postBtn.textContent = "Post";
});

// ── FEED (docChanges diffing) ─────────────────────────────────────────────────
let unsubFeed = null;

function loadFeedRealtime() {
  if (unsubFeed) { unsubFeed(); unsubFeed = null; }
  if (feedEl) feedEl.innerHTML = `<div style="padding:40px;text-align:center;color:#64748b;">Loading…</div>`;

  let q;
  if (currentTab === "following" && currentUserData?.following?.length) {
    // Firestore "in" max = 10 items
    q = query(
      collection(db, "posts"),
      where("uid", "in", currentUserData.following.slice(0, 10)),
      orderBy("createdAt", "desc")
    );
  } else {
    q = query(collection(db, "posts"), orderBy("createdAt", "desc"), limit(30));
  }

  let initialLoad = true;

  unsubFeed = trackUnsub(onSnapshot(q, (snapshot) => {
    if (!feedEl) return;

    if (initialLoad) {
      // First render: build full list
      feedEl.innerHTML = "";
      if (snapshot.empty) {
        feedEl.innerHTML = `<div style="padding:40px;text-align:center;color:#64748b;">No posts yet.</div>`;
        initialLoad = false;
        return;
      }
      snapshot.forEach(ds => feedEl.appendChild(buildPostEl(ds)));
      initialLoad = false;
      return;
    }

    // Incremental updates via docChanges — avoids full re-render
    snapshot.docChanges().forEach(change => {
      if (change.type === "added") {
        const el = buildPostEl(change.doc);
        feedEl.insertBefore(el, feedEl.firstChild);
      } else if (change.type === "modified") {
        const old = feedEl.querySelector(`[data-post-id="${change.doc.id}"]`);
        if (old) old.replaceWith(buildPostEl(change.doc));
      } else if (change.type === "removed") {
        feedEl.querySelector(`[data-post-id="${change.doc.id}"]`)?.remove();
      }
    });
  }));
}

// ── BUILD POST ELEMENT ────────────────────────────────────────────────────────
function buildPostEl(docSnap) {
  const post   = docSnap.data();
  const id     = docSnap.id;
  const liked  = (post.likes || []).includes(currentUser.uid);
  const likeCount = (post.likes || []).length;
  const comments  = post.comments || [];
  const time = post.createdAt
    ? new Date(post.createdAt.seconds * 1000).toLocaleString()
    : "Just now";

  const el = document.createElement("div");
  el.className    = "post";
  el.dataset.postId = id;

  // Safely build avatar using DOM, not innerHTML
  const avatarDiv = document.createElement("div");
  avatarDiv.className = "post-avatar";
  const photoUrl = safeUrl(post.photoURL);
  if (photoUrl) {
    const img = document.createElement("img");
    img.src       = photoUrl;
    img.className = "post-avatar-img";
    img.alt       = esc(post.displayName || "");
    avatarDiv.appendChild(img);
  } else {
    avatarDiv.textContent = post.initials || "?";
  }

  // Build post using a template — user content only via esc()
  el.innerHTML = `
    <div class="post-header">
      <div class="post-avatar-slot"></div>
      <div>
        <div class="post-name">
          <a href="profile.html?uid=${esc(post.uid)}" class="profile-link">${esc(post.displayName)}</a>
        </div>
        <div class="post-username">@${esc(post.username)} · ${esc(time)}</div>
      </div>
    </div>
    <div class="post-text">${esc(post.text || "")}</div>
    ${photoUrl && post.imageUrl ? `<img src="${safeUrl(post.imageUrl)}" class="post-image" alt="Post image" loading="lazy">` : ""}
    ${post.videoUrl             ? `<video src="${safeUrl(post.videoUrl)}" class="post-video" controls preload="none"></video>` : ""}
    <div class="post-actions">
      <button class="like-btn ${liked ? "liked" : ""}" aria-label="Like post">
        ${liked ? "❤️" : "🤍"} <span class="like-count">${likeCount}</span>
      </button>
    </div>
    <div class="comments-section">
      <div class="comments-list"></div>
      <div class="comment-input-wrap">
        <input type="text" class="comment-input" placeholder="Write a comment…" maxlength="500" autocomplete="off">
        <button class="comment-btn">Post</button>
      </div>
    </div>`;

  // Inject avatar safely (bypasses innerHTML)
  el.querySelector(".post-avatar-slot").replaceWith(avatarDiv);

  // Render comments safely via DOM
  const commentsList = el.querySelector(".comments-list");
  comments.forEach(c => commentsList.appendChild(buildCommentEl(c)));

  // Like handler
  el.querySelector(".like-btn").onclick = () => toggleLike(id, post);

  // Comment handler
  const commentInput = el.querySelector(".comment-input");
  el.querySelector(".comment-btn").onclick = () => submitComment(id, post, commentInput);
  commentInput.addEventListener("keydown", e => {
    if (e.key === "Enter") submitComment(id, post, commentInput);
  });

  return el;
}

function buildCommentEl(c) {
  const div = document.createElement("div");
  div.className = "comment";
  // Safe: use textContent for user-supplied text
  const bold = document.createElement("b");
  bold.textContent = `@${c.username || "?"}`;
  const span = document.createElement("span");
  span.textContent = ` ${c.text || ""}`;
  div.appendChild(bold);
  div.appendChild(span);
  return div;
}

// ── LIKE ──────────────────────────────────────────────────────────────────────
async function toggleLike(postId, post) {
  const ref   = doc(db, "posts", postId);
  const liked = (post.likes || []).includes(currentUser.uid);
  await updateDoc(ref, { likes: liked ? arrayRemove(currentUser.uid) : arrayUnion(currentUser.uid) });

  // Notify post owner (skip self-likes; skip if already liked to avoid duplicate notifs)
  if (!liked && post.uid !== currentUser.uid) {
    await addDoc(collection(db, "notifications"), {
      toUid:       post.uid,
      fromUid:     currentUser.uid,
      fromName:    currentUserData.displayName,
      fromUsername:currentUserData.username,
      fromPhoto:   currentUserData.photoURL || "",
      type:        "like",
      read:        false,
      createdAt:   serverTimestamp()
    });
  }
}

// ── COMMENT ───────────────────────────────────────────────────────────────────
async function submitComment(postId, post, input) {
  const text = input.value.trim();
  if (!text) return;
  input.value = "";

  const ref = doc(db, "posts", postId);
  await updateDoc(ref, {
    comments: arrayUnion({
      uid:      currentUser.uid,
      username: currentUserData.username,
      text
    })
  });

  // Notify post owner (skip self-comments)
  if (post.uid !== currentUser.uid) {
    await addDoc(collection(db, "notifications"), {
      toUid:        post.uid,
      fromUid:      currentUser.uid,
      fromName:     currentUserData.displayName,
      fromUsername: currentUserData.username,
      fromPhoto:    currentUserData.photoURL || "",
      type:         "comment",
      commentText:  text.slice(0, 60),
      read:         false,
      createdAt:    serverTimestamp()
    });
  }
}

// ── BADGES ────────────────────────────────────────────────────────────────────
function watchNotifBadge() {
  if (!notifBadge) return;
  trackUnsub(onSnapshot(
    query(collection(db, "notifications"), where("toUid", "==", currentUser.uid), where("read", "==", false)),
    snap => {
      notifBadge.textContent = snap.size > 9 ? "9+" : snap.size;
      notifBadge.classList.toggle("show", snap.size > 0);
    }
  ));
}

function watchMsgBadge() {
  if (!msgBadge) return;
  // Query conversations for unread, not raw messages — fewer documents
  trackUnsub(onSnapshot(
    query(collection(db, "conversations"), where("participants", "array-contains", currentUser.uid), where("unreadBy", "array-contains", currentUser.uid)),
    snap => {
      msgBadge.textContent = snap.size > 9 ? "9+" : snap.size;
      msgBadge.classList.toggle("show", snap.size > 0);
    }
  ));
}

// ── SEARCH (single fetch, client-side filter) ─────────────────────────────────
searchInput?.addEventListener("input", debounce(async () => {
  const q = searchInput.value.trim().toLowerCase();
  if (!searchResults) return;

  if (!q) { searchResults.style.display = "none"; return; }

  // Fetch once, cache for session
  if (!allUsersCache) {
    const snap = await getDocs(collection(db, "users"));
    allUsersCache = [];
    snap.forEach(d => allUsersCache.push({ id: d.id, ...d.data() }));
  }

  const matches = allUsersCache.filter(u =>
    u.displayName?.toLowerCase().includes(q) ||
    u.username?.toLowerCase().includes(q)
  );

  searchResults.innerHTML = "";
  if (!matches.length) { searchResults.style.display = "none"; return; }

  searchResults.style.display = "block";
  matches.slice(0, 8).forEach(u => {
    const el = document.createElement("div");
    el.className = "search-result";

    const av = document.createElement("div");
    av.className = "search-avatar";
    const url = safeUrl(u.photoURL);
    if (url) {
      const img = document.createElement("img");
      img.src = url; img.className = "post-avatar-img"; img.alt = esc(u.displayName || "");
      av.appendChild(img);
    } else {
      av.textContent = u.initials || "?";
    }

    const info = document.createElement("div");
    const name = document.createElement("div");
    name.style.fontWeight = "600";
    name.textContent = u.displayName || "";
    const uname = document.createElement("div");
    uname.style.cssText = "color:#64748b;font-size:13px";
    uname.textContent = `@${u.username || ""}`;
    info.appendChild(name);
    info.appendChild(uname);

    el.appendChild(av);
    el.appendChild(info);
    el.onclick = () => { location.href = `profile.html?uid=${encodeURIComponent(u.id)}`; };
    searchResults.appendChild(el);
  });
}, 250));

document.addEventListener("click", (e) => {
  if (!searchInput?.contains(e.target) && !searchResults?.contains(e.target)) {
    if (searchResults) searchResults.style.display = "none";
  }
});
