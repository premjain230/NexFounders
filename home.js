import { auth, db } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  collection, addDoc, doc, getDoc, getDocs,
  query, orderBy, serverTimestamp, updateDoc,
  arrayUnion, arrayRemove, onSnapshot, where, limit
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

let currentUser     = null;
let currentUserData = null;
let currentTab      = "forYou";
let unsubFeed       = null;

const postInput     = document.getElementById("postInput");
const postBtn       = document.getElementById("postBtn");
const mediaInput    = document.getElementById("mediaInput");
const feedEl        = document.getElementById("feed");
const navAvatar     = document.getElementById("navAvatar");
const navName       = document.getElementById("navName");
const searchInput   = document.getElementById("searchInput");
const searchResults = document.getElementById("searchResults");
const notifBadge    = document.getElementById("notifBadge");
const msgBadge      = document.getElementById("msgBadge");

/* TAB */
window.switchTab = function (tab) {
  currentTab = tab;
  document.getElementById("tabForYou").classList.toggle("active", tab === "forYou");
  document.getElementById("tabFollowing").classList.toggle("active", tab === "following");
  loadFeedRealtime();
};

/* AUTH */
onAuthStateChanged(auth, async (user) => {
  if (!user) { location.href = "index.html"; return; }
  currentUser = user;

  const userSnap = await getDoc(doc(db, "users", user.uid));
  if (userSnap.exists()) {
    currentUserData = userSnap.data();
    setAvatar(navAvatar, currentUserData);
    navName.textContent = currentUserData.displayName || "You";
  }

  loadFeedRealtime();
  watchNotifBadge();
  watchMsgBadge();
});

/* AVATAR */
function setAvatar(el, data) {
  if (data.photoURL) {
    el.innerHTML = `<img src="${data.photoURL}" class="nav-avatar-img">`;
  } else {
    el.textContent = data.initials || "?";
  }
}

/* SAFE HTML */
function escapeHTML(str) {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/* UPLOAD */
async function uploadToCloudinary(file) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", "nexfounder_upload");

  const res = await fetch(
    "https://api.cloudinary.com/v1_1/dr5uatib5/auto/upload",
    { method: "POST", body: formData }
  );

  const data = await res.json();
  return data.secure_url;
}

/* CREATE POST */
postBtn.addEventListener("click", async () => {
  const text = postInput.value.trim();
  if (!text && !mediaInput.files[0]) return;

  postBtn.disabled = true;
  postBtn.textContent = "Posting...";

  try {
    let imageUrl = "", videoUrl = "";
    const file = mediaInput.files[0];

    if (file) {
      const url = await uploadToCloudinary(file);
      if (file.type.startsWith("image")) imageUrl = url;
      if (file.type.startsWith("video")) videoUrl = url;
    }

    await addDoc(collection(db, "posts"), {
      text,
      uid: currentUser.uid,
      displayName: currentUserData.displayName,
      username: currentUserData.username,
      initials: currentUserData.initials,
      photoURL: currentUserData.photoURL || "",
      likes: [],
      comments: [],
      imageUrl,
      videoUrl,
      createdAt: serverTimestamp()
    });

    postInput.value = "";
    mediaInput.value = "";

  } catch (err) {
    alert(err.message);
  }

  postBtn.disabled = false;
  postBtn.textContent = "Post";
});

/* FEED */
function loadFeedRealtime() {
  if (unsubFeed) unsubFeed();

  feedEl.innerHTML = `<div style="padding:40px;text-align:center;color:#64748b;">Loading...</div>`;

  let q;

  if (currentTab === "following" && currentUserData?.following?.length) {
    q = query(
      collection(db, "posts"),
      where("uid", "in", currentUserData.following.slice(0, 30)),
      orderBy("createdAt", "desc")
    );
  } else {
    q = query(collection(db, "posts"), orderBy("createdAt", "desc"), limit(50));
  }

  unsubFeed = onSnapshot(q, (snapshot) => {
    feedEl.innerHTML = "";

    if (snapshot.empty) {
      feedEl.innerHTML = `<div style="padding:40px;text-align:center;color:#64748b;">No posts yet</div>`;
      return;
    }

    snapshot.forEach(renderPost);
  });
}

/* RENDER POST (FIXED SAFE VERSION) */
function renderPost(docSnap) {
  const post = docSnap.data();
  const id = docSnap.id;

  // SAFE GUARDS
  if (!post.likes) post.likes = [];
  if (!post.comments) post.comments = [];

  const liked = post.likes.includes(currentUser.uid);
  const time = post.createdAt
    ? new Date(post.createdAt.seconds * 1000).toLocaleString()
    : "Just now";

  const el = document.createElement("div");
  el.className = "post";

  el.innerHTML = `
    <div class="post-header">
      <div class="post-avatar">
        ${post.photoURL ? `<img src="${post.photoURL}">` : (post.initials || "?")}
      </div>
      <div>
        <div>
          <a href="profile.html?uid=${post.uid}">
            ${escapeHTML(post.displayName || "User")}
          </a>
        </div>
        <div>@${escapeHTML(post.username || "")} · ${time}</div>
      </div>
    </div>

    <div class="post-text">${escapeHTML(post.text || "")}</div>

    ${post.imageUrl ? `<img src="${post.imageUrl}" class="post-image">` : ""}
    ${post.videoUrl ? `<video src="${post.videoUrl}" controls></video>` : ""}

    <div class="post-actions">
      <button class="like-btn" data-liked="${liked}">
        ${liked ? "❤️" : "🤍"} <span>${post.likes.length}</span>
      </button>

      <button class="comment-toggle">
        💬 ${post.comments.length}
      </button>
    </div>

    <div class="comments" style="display:none;">
      ${post.comments.map(c => `
        <div>
          <b>@${escapeHTML(c.username || "user")}</b>
          ${escapeHTML(c.text || "")}
        </div>
      `).join("")}
    </div>
  `;

  /* LIKE */
  const likeBtn = el.querySelector(".like-btn");

  likeBtn.onclick = async () => {
    const wasLiked = likeBtn.dataset.liked === "true";

    await updateDoc(doc(db, "posts", id), {
      likes: wasLiked
        ? arrayRemove(currentUser.uid)
        : arrayUnion(currentUser.uid)
    });
  };

  /* COMMENT TOGGLE */
  const commentBox = el.querySelector(".comments");
  el.querySelector(".comment-toggle").onclick = () => {
    commentBox.style.display =
      commentBox.style.display === "none" ? "block" : "none";
  };

  feedEl.appendChild(el);
}

/* BADGES */
function watchNotifBadge() {
  onSnapshot(
    query(collection(db, "notifications"),
      where("toUid", "==", currentUser.uid),
      where("read", "==", false)
    ),
    (snap) => {
      notifBadge.textContent = snap.size > 9 ? "9+" : snap.size;
      notifBadge.classList.toggle("show", snap.size > 0);
    }
  );
}

function watchMsgBadge() {
  onSnapshot(
    query(collection(db, "messages"),
      where("toUid", "==", currentUser.uid),
      where("read", "==", false)
    ),
    (snap) => {
      msgBadge.textContent = snap.size > 9 ? "9+" : snap.size;
      msgBadge.classList.toggle("show", snap.size > 0);
    }
  );
}