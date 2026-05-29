import { auth, db } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  collection, addDoc, doc, getDoc, getDocs,
  query, orderBy, serverTimestamp, updateDoc,
  arrayUnion, arrayRemove, onSnapshot, where, limit
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

let currentUser = null;
let currentUserData = null;
let currentTab = "forYou";

const postInput    = document.getElementById("postInput");
const postBtn      = document.getElementById("postBtn");
const mediaInput   = document.getElementById("mediaInput");
const feedEl       = document.getElementById("feed");
const navAvatar    = document.getElementById("navAvatar");
const navName      = document.getElementById("navName");
const searchInput  = document.getElementById("searchInput");
const searchResults= document.getElementById("searchResults");
const notifBadge   = document.getElementById("notifBadge");
const msgBadge     = document.getElementById("msgBadge");

// ── TAB SWITCH ──────────────────────────────────────
window.switchTab = function(tab) {
  currentTab = tab;
  document.getElementById("tabForYou").classList.toggle("active", tab === "forYou");
  document.getElementById("tabFollowing").classList.toggle("active", tab === "following");
  loadFeedRealtime();
};

// ── AUTH ────────────────────────────────────────────
onAuthStateChanged(auth, async (user) => {
  if (!user) { location.href = "index.html"; return; }
  currentUser = user;

  const userSnap = await getDoc(doc(db, "users", user.uid));
  if (userSnap.exists()) {
    currentUserData = userSnap.data();
    setAvatar(navAvatar, currentUserData);
    navName.textContent = currentUserData.displayName || "You";
    const createAvatar = document.getElementById("createAvatar");
    if (createAvatar) setAvatar(createAvatar, currentUserData);
  }

  loadFeedRealtime();
  watchNotifBadge();
  watchMsgBadge();
});

// ── AVATAR HELPER ───────────────────────────────────
function setAvatar(el, data) {
  if (data.photoURL) {
    el.innerHTML = `<img src="${data.photoURL}" class="nav-avatar-img">`;
  } else {
    el.textContent = data.initials || "?";
  }
}

// ── CLOUDINARY ──────────────────────────────────────
async function uploadToCloudinary(file) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", "nexfounder_upload");
  const res = await fetch("https://api.cloudinary.com/v1_1/dr5uatib5/auto/upload", { method:"POST", body:formData });
  const data = await res.json();
  return data.secure_url;
}

// ── CREATE POST ─────────────────────────────────────
postBtn.addEventListener("click", async () => {
  const text = postInput.value.trim();
  if (!text && !mediaInput.files[0]) return;
  postBtn.disabled = true; postBtn.textContent = "Posting...";
  try {
    let imageUrl = "", videoUrl = "";
    const file = mediaInput.files[0];
    if (file) {
      const url = await uploadToCloudinary(file);
      if (file.type.startsWith("image")) imageUrl = url;
      if (file.type.startsWith("video")) videoUrl = url;
    }
    await addDoc(collection(db, "posts"), {
      text, uid: currentUser.uid,
      displayName: currentUserData.displayName,
      username: currentUserData.username,
      initials: currentUserData.initials,
      photoURL: currentUserData.photoURL || "",
      likes: [], comments: [], imageUrl, videoUrl,
      createdAt: serverTimestamp()
    });
    postInput.value = ""; mediaInput.value = "";
  } catch (err) { alert(err.message); }
  postBtn.disabled = false; postBtn.textContent = "Post";
});

// ── REALTIME FEED ───────────────────────────────────
let unsubFeed = null;
function loadFeedRealtime() {
  if (unsubFeed) unsubFeed();
  feedEl.innerHTML = `<div style="padding:40px;text-align:center;color:#64748b;">Loading...</div>`;

  let q;
  if (currentTab === "following" && currentUserData?.following?.length) {
    q = query(collection(db,"posts"), where("uid","in", currentUserData.following.slice(0,10)), orderBy("createdAt","desc"));
  } else {
    q = query(collection(db,"posts"), orderBy("createdAt","desc"), limit(50));
  }

  unsubFeed = onSnapshot(q, (snapshot) => {
    feedEl.innerHTML = "";
    if (snapshot.empty) {
      feedEl.innerHTML = `<div style="padding:40px;text-align:center;color:#64748b;">No posts yet. Be the first!</div>`;
      return;
    }
    snapshot.forEach((docSnap) => renderPost(docSnap));
  });
}

// ── RENDER POST ─────────────────────────────────────
function renderPost(docSnap) {
  const post = docSnap.data();
  const id   = docSnap.id;
  const liked = (post.likes||[]).includes(currentUser.uid);
  const likeCount = (post.likes||[]).length;
  const comments  = post.comments || [];
  const time = post.createdAt
    ? new Date(post.createdAt.seconds*1000).toLocaleString()
    : "Just now";

  const el = document.createElement("div");
  el.className = "post";
  el.innerHTML = `
    <div class="post-header">
      <div class="post-avatar">
        ${post.photoURL ? `<img src="${post.photoURL}" class="post-avatar-img">` : (post.initials||"?")}
      </div>
      <div>
        <div class="post-name">
          <a href="profile.html?uid=${post.uid}" class="profile-link">${post.displayName}</a>
        </div>
        <div class="post-username">@${post.username} · ${time}</div>
      </div>
    </div>
    <div class="post-text">${post.text||""}</div>
    ${post.imageUrl ? `<img src="${post.imageUrl}" class="post-image">` : ""}
    ${post.videoUrl ? `<video src="${post.videoUrl}" class="post-video" controls></video>` : ""}
    <div class="post-actions">
      <button class="like-btn ${liked?"liked":""}">
        ${liked?"❤️":"🤍"} ${likeCount}
      </button>
    </div>
    <div class="comments-section">
      <div class="comments-list">
        ${comments.map(c=>`
          <div class="comment"><b>@${c.username}</b> ${c.text}</div>
        `).join("")}
      </div>
      <div class="comment-input-wrap">
        <input type="text" class="comment-input" placeholder="Write a comment...">
        <button class="comment-btn">Post</button>
      </div>
    </div>
  `;

  el.querySelector(".like-btn").onclick = () => toggleLike(id, post);
  const commentInput = el.querySelector(".comment-input");
  el.querySelector(".comment-btn").onclick = async () => {
    const text = commentInput.value.trim();
    if (!text) return;
    await addComment(id, text, post);
    commentInput.value = "";
  };

  feedEl.appendChild(el);
}

// ── LIKE ────────────────────────────────────────────
async function toggleLike(postId, post) {
  const ref = doc(db, "posts", postId);
  const liked = (post.likes||[]).includes(currentUser.uid);
  await updateDoc(ref, {
    likes: liked ? arrayRemove(currentUser.uid) : arrayUnion(currentUser.uid)
  });
  // Write notification if liking someone else's post
  if (!liked && post.uid !== currentUser.uid) {
    await addDoc(collection(db,"notifications"), {
      toUid: post.uid,
      fromUid: currentUser.uid,
      fromName: currentUserData.displayName,
      fromUsername: currentUserData.username,
      fromPhoto: currentUserData.photoURL || "",
      type: "like",
      postId,
      postText: post.text?.slice(0,60) || "",
      read: false,
      createdAt: serverTimestamp()
    });
  }
}

// ── COMMENT ─────────────────────────────────────────
async function addComment(postId, text, post) {
  const ref = doc(db,"posts",postId);
  await updateDoc(ref, {
    comments: arrayUnion({ uid:currentUser.uid, username:currentUserData.username, text })
  });
  if (post.uid !== currentUser.uid) {
    await addDoc(collection(db,"notifications"), {
      toUid: post.uid,
      fromUid: currentUser.uid,
      fromName: currentUserData.displayName,
      fromUsername: currentUserData.username,
      fromPhoto: currentUserData.photoURL || "",
      type: "comment",
      postId,
      postText: post.text?.slice(0,60) || "",
      commentText: text,
      read: false,
      createdAt: serverTimestamp()
    });
  }
}

// ── NOTIFICATION BADGE ───────────────────────────────
function watchNotifBadge() {
  const q = query(
    collection(db,"notifications"),
    where("toUid","==",currentUser.uid),
    where("read","==",false)
  );
  onSnapshot(q, (snap) => {
    const count = snap.size;
    notifBadge.textContent = count > 9 ? "9+" : count;
    notifBadge.classList.toggle("show", count > 0);
  });
}

// ── MESSAGE BADGE ────────────────────────────────────
function watchMsgBadge() {
  const q = query(
    collection(db,"messages"),
    where("toUid","==",currentUser.uid),
    where("read","==",false)
  );
  onSnapshot(q, (snap) => {
    const count = snap.size;
    msgBadge.textContent = count > 9 ? "9+" : count;
    msgBadge.classList.toggle("show", count > 0);
  });
}

// ── SEARCH ───────────────────────────────────────────
searchInput.addEventListener("input", async () => {
  const qText = searchInput.value.trim().toLowerCase();
  searchResults.innerHTML = "";
  if (!qText) { searchResults.style.display="none"; return; }

  const snap = await getDocs(collection(db,"users"));
  const matches = [];
  snap.forEach((d) => {
    const u = d.data();
    if (u.displayName?.toLowerCase().includes(qText) || u.username?.toLowerCase().includes(qText)) {
      matches.push({ id:d.id, ...u });
    }
  });

  if (!matches.length) { searchResults.style.display="none"; return; }
  searchResults.style.display = "block";
  matches.forEach((u) => {
    const el = document.createElement("div");
    el.className = "search-result";
    el.innerHTML = `
      <div class="search-avatar">
        ${u.photoURL ? `<img src="${u.photoURL}" class="post-avatar-img">` : (u.initials||"?")}
      </div>
      <div>
        <div style="font-weight:600">${u.displayName}</div>
        <div style="color:#64748b;font-size:13px">@${u.username}</div>
      </div>
    `;
    el.onclick = () => { location.href=`profile.html?uid=${u.id}`; };
    searchResults.appendChild(el);
  });
});

document.addEventListener("click", (e) => {
  if (!searchInput.contains(e.target) && !searchResults.contains(e.target))
    searchResults.style.display="none";
});
