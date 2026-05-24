import { auth, db } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  doc, getDoc, setDoc, updateDoc, collection,
  query, where, orderBy, arrayUnion, arrayRemove,
  onSnapshot, addDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const CLOUD_NAME    = "dr5uatib5";
const UPLOAD_PRESET = "nexfounder_upload";

let currentUser, profileData, targetUid, isOwnProfile;

// ── DOM REFS ──────────────────────────────────────────
const avatar           = document.getElementById("avatar");
const banner           = document.getElementById("banner");
const avatarInput      = document.getElementById("avatarInput");
const bannerInput      = document.getElementById("bannerInput");
const avatarEditBtn    = document.getElementById("avatarEditBtn");
const bannerEditBtn    = document.getElementById("bannerEditBtn");
const displayName      = document.getElementById("displayName");
const displayUsername  = document.getElementById("displayUsername");
const displayBio       = document.getElementById("displayBio");
const displayEmail     = document.getElementById("displayEmail");
const followersCount   = document.getElementById("followersCount");
const followingCount   = document.getElementById("followingCount");
const connectionsCount = document.getElementById("connectionsCount");
const openEditBtn      = document.getElementById("openEditBtn");
const followBtn        = document.getElementById("followBtn");
const connectBtn       = document.getElementById("connectBtn");
const messageBtn       = document.getElementById("messageBtn");
const editModal        = document.getElementById("editModal");
const cancelBtn        = document.getElementById("cancelBtn");
const saveBtn          = document.getElementById("saveBtn");
const inputName        = document.getElementById("inputName");
const inputUsername    = document.getElementById("inputUsername");
const inputBio         = document.getElementById("inputBio");
const postsContainer   = document.getElementById("userPosts");

// ── AUTH ──────────────────────────────────────────────
onAuthStateChanged(auth, async (user) => {
  if (!user) { location.href = "index.html"; return; }
  currentUser = user;

  const params = new URLSearchParams(location.search);
  targetUid    = params.get("uid") || user.uid;
  isOwnProfile = targetUid === user.uid;

  const userRef = doc(db, "users", targetUid);
  const snap    = await getDoc(userRef);

  if (!snap.exists()) {
    const name = user.email.split("@")[0];
    profileData = {
      displayName: name, username: name, bio: "", initials: initials(name),
      followers: [], following: [], connections: [], pendingConnections: [], sentConnections: [],
      email: user.email, photoURL: "", bannerURL: ""
    };
    await setDoc(userRef, profileData);
  }

  onSnapshot(userRef, (ds) => {
    if (!ds.exists()) return;
    profileData = ds.data();
    renderProfile();
  });

  loadPostsRealtime();
});

// ── CLOUDINARY UPLOAD ────────────────────────────────
async function uploadToCloudinary(file) {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("upload_preset", UPLOAD_PRESET);
  const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, { method: "POST", body: fd });
  return (await res.json()).secure_url;
}

// ── RENDER PROFILE ────────────────────────────────────
function renderProfile() {
  profileData.followers          = profileData.followers          || [];
  profileData.following          = profileData.following          || [];
  profileData.connections        = profileData.connections        || [];
  profileData.pendingConnections = profileData.pendingConnections || [];
  profileData.sentConnections    = profileData.sentConnections    || [];

  displayName.textContent      = profileData.displayName || "Unknown";
  displayUsername.textContent  = "@" + (profileData.username || "user");
  displayBio.textContent       = profileData.bio || "";
  displayEmail.textContent     = profileData.email || "";
  followersCount.textContent   = profileData.followers.length;
  followingCount.textContent   = profileData.following.length;
  connectionsCount.textContent = profileData.connections.length;

  // Avatar
  if (profileData.photoURL) {
    avatar.style.backgroundImage    = `url(${profileData.photoURL})`;
    avatar.style.backgroundSize     = "cover";
    avatar.style.backgroundPosition = "center";
    const oldSpan = avatar.querySelector("span");
    if (oldSpan) oldSpan.remove();
  } else {
    avatar.style.backgroundImage = "";
    let txt = avatar.querySelector("span");
    if (!txt) { txt = document.createElement("span"); avatar.prepend(txt); }
    txt.textContent = initials(profileData.displayName);
  }

  // Banner
  if (profileData.bannerURL) {
    banner.style.backgroundImage    = `url(${profileData.bannerURL})`;
    banner.style.backgroundSize     = "cover";
    banner.style.backgroundPosition = "center";
  }

  if (isOwnProfile) {
    // Own profile — show edit controls only
    openEditBtn.style.display   = "inline-flex";
    followBtn.style.display     = "none";
    connectBtn.style.display    = "none";
    messageBtn.style.display    = "none";
    avatarEditBtn.style.display = "flex";
    bannerEditBtn.style.display = "block";
  } else {
    // Other profile — hide edit controls, show social buttons
    openEditBtn.style.display   = "none";
    avatarEditBtn.style.display = "none";
    bannerEditBtn.style.display = "none";
    messageBtn.style.display    = "inline-flex";

    // ── Render Follow Button ──
    renderFollowButton();

    // ── Render Connect Button ──
    const isConnected = profileData.connections.includes(currentUser.uid);
    getDoc(doc(db, "users", currentUser.uid)).then(mySnap => {
      const myData        = mySnap.data() || {};
      const iSent         = (myData.sentConnections    || []).includes(targetUid);
      const theyRequested = (myData.pendingConnections || []).includes(targetUid);

      connectBtn.style.display = "inline-flex";
      connectBtn.className     = "connectbtn";

      if (isConnected) {
        connectBtn.textContent = "✓ Connected";
        connectBtn.classList.add("connected");
      } else if (iSent) {
        connectBtn.textContent = "Request Sent";
        connectBtn.classList.add("pending");
      } else if (theyRequested) {
        connectBtn.textContent = "Accept Request";
        connectBtn.classList.add("accept");
      } else {
        connectBtn.textContent = "Connect";
        connectBtn.classList.add("default");
      }
    });
  }
}

// ── FOLLOW BUTTON RENDER ──────────────────────────────
function renderFollowButton() {
  const isFollowing = (profileData.followers || []).includes(currentUser.uid);

  followBtn.style.display = "inline-flex";
  followBtn.className     = "followbtn";

  if (isFollowing) {
    followBtn.innerHTML = "✓ Following";
    followBtn.classList.add("following");
    followBtn.title = "Click to unfollow";

    // Hover: show "Unfollow" text
    followBtn.onmouseenter = () => { followBtn.innerHTML = "✕ Unfollow"; };
    followBtn.onmouseleave = () => { followBtn.innerHTML = "✓ Following"; };
  } else {
    followBtn.innerHTML    = "＋ Follow";
    followBtn.title        = "";
    followBtn.onmouseenter = null;
    followBtn.onmouseleave = null;
  }
}

// ── FOLLOW CLICK ──────────────────────────────────────
followBtn.onclick = async () => {
  if (isOwnProfile) return; // safety guard

  const myRef     = doc(db, "users", currentUser.uid);
  const targetRef = doc(db, "users", targetUid);
  const isFollowing = (profileData.followers || []).includes(currentUser.uid);

  followBtn.disabled = true;

  try {
    if (isFollowing) {
      // Unfollow
      await updateDoc(targetRef, { followers: arrayRemove(currentUser.uid) });
      await updateDoc(myRef,     { following: arrayRemove(targetUid) });
    } else {
      // Follow
      await updateDoc(targetRef, { followers: arrayUnion(currentUser.uid) });
      await updateDoc(myRef,     { following: arrayUnion(targetUid) });

      // Send notification
      const meSnap = await getDoc(myRef);
      const me     = meSnap.data() || {};
      await addDoc(collection(db, "notifications"), {
        toUid:        targetUid,
        fromUid:      currentUser.uid,
        fromName:     me.displayName     || "",
        fromUsername: me.username        || "",
        fromPhoto:    me.photoURL        || "",
        type:         "new_follower",
        read:         false,
        createdAt:    serverTimestamp()
      });
    }
  } catch (err) {
    console.error("Follow error:", err);
    alert("Something went wrong. Please try again.");
  }

  followBtn.disabled = false;
  // onSnapshot will auto-update profileData and re-render the button
};

// ── CONNECT CLICK ─────────────────────────────────────
connectBtn.onclick = async () => {
  const myRef     = doc(db, "users", currentUser.uid);
  const targetRef = doc(db, "users", targetUid);
  const mySnap    = await getDoc(myRef);
  const myData    = mySnap.data() || {};

  const isConnected   = (profileData.connections    || []).includes(currentUser.uid);
  const iSent         = (myData.sentConnections     || []).includes(targetUid);
  const theyRequested = (myData.pendingConnections  || []).includes(targetUid);

  connectBtn.disabled = true;

  try {
    if (isConnected) {
      // Disconnect
      await updateDoc(myRef,     { connections: arrayRemove(targetUid) });
      await updateDoc(targetRef, { connections: arrayRemove(currentUser.uid) });
    } else if (iSent) {
      // Cancel request
      await updateDoc(myRef,     { sentConnections:    arrayRemove(targetUid) });
      await updateDoc(targetRef, { pendingConnections: arrayRemove(currentUser.uid) });
    } else if (theyRequested) {
      // Accept
      await updateDoc(myRef, {
        pendingConnections: arrayRemove(targetUid),
        connections:        arrayUnion(targetUid)
      });
      await updateDoc(targetRef, {
        sentConnections: arrayRemove(currentUser.uid),
        connections:     arrayUnion(currentUser.uid)
      });
      await addDoc(collection(db, "notifications"), {
        toUid:        targetUid,
        fromUid:      currentUser.uid,
        fromName:     profileData.displayName || "",
        fromUsername: profileData.username    || "",
        fromPhoto:    profileData.photoURL    || "",
        type:         "connect_accepted",
        read:         false,
        createdAt:    serverTimestamp()
      });
    } else {
      // Send request
      await updateDoc(myRef,     { sentConnections:    arrayUnion(targetUid) });
      await updateDoc(targetRef, { pendingConnections: arrayUnion(currentUser.uid) });
      const meSnap = await getDoc(myRef);
      const me     = meSnap.data() || {};
      await addDoc(collection(db, "notifications"), {
        toUid:        targetUid,
        fromUid:      currentUser.uid,
        fromName:     me.displayName  || "",
        fromUsername: me.username     || "",
        fromPhoto:    me.photoURL     || "",
        type:         "connect_request",
        read:         false,
        createdAt:    serverTimestamp()
      });
    }
  } catch (err) {
    console.error("Connect error:", err);
    alert("Something went wrong. Please try again.");
  }

  connectBtn.disabled = false;
};

// ── MESSAGE BUTTON ────────────────────────────────────
messageBtn.onclick = () => {
  location.href = `messages.html?uid=${targetUid}`;
};

// ── FILE PICKERS ──────────────────────────────────────
avatar.addEventListener("click", () => { if (isOwnProfile) avatarInput.click(); });
banner.addEventListener("click", () => { if (isOwnProfile) bannerInput.click(); });
avatarEditBtn.onclick = (e) => { e.stopPropagation(); avatarInput.click(); };
bannerEditBtn.onclick = (e) => { e.stopPropagation(); bannerInput.click(); };

avatarInput.addEventListener("change", async (e) => {
  const file = e.target.files[0]; if (!file) return;
  avatar.style.opacity = "0.5";
  try {
    const url = await uploadToCloudinary(file);
    await updateDoc(doc(db, "users", currentUser.uid), { photoURL: url });
  } catch { alert("Failed to upload photo"); }
  avatar.style.opacity = "1";
  e.target.value = "";
});

bannerInput.addEventListener("change", async (e) => {
  const file = e.target.files[0]; if (!file) return;
  banner.style.opacity = "0.6";
  try {
    const url = await uploadToCloudinary(file);
    await updateDoc(doc(db, "users", currentUser.uid), { bannerURL: url });
  } catch { alert("Failed to upload banner"); }
  banner.style.opacity = "1";
  e.target.value = "";
});

// ── EDIT PROFILE ──────────────────────────────────────
openEditBtn.onclick = () => {
  inputName.value     = profileData.displayName || "";
  inputUsername.value = profileData.username    || "";
  inputBio.value      = profileData.bio         || "";
  editModal.classList.add("open");
};

cancelBtn.onclick = () => editModal.classList.remove("open");

editModal.addEventListener("click", (e) => {
  if (e.target === editModal) editModal.classList.remove("open");
});

saveBtn.onclick = async () => {
  const name     = inputName.value.trim();
  const username = inputUsername.value.trim();
  const bio      = inputBio.value.trim();
  if (!name || !username) { alert("Name and username are required."); return; }

  saveBtn.disabled    = true;
  saveBtn.textContent = "Saving...";
  try {
    await updateDoc(doc(db, "users", currentUser.uid), {
      displayName: name, username, bio, initials: initials(name)
    });
    editModal.classList.remove("open");
  } catch { alert("Update failed. Please try again."); }
  saveBtn.disabled    = false;
  saveBtn.textContent = "Save";
};

// ── POSTS ─────────────────────────────────────────────
function loadPostsRealtime() {
  const q = query(
    collection(db, "posts"),
    where("uid", "==", targetUid),
    orderBy("createdAt", "desc")
  );
  onSnapshot(q, (snapshot) => {
    if (snapshot.empty) {
      postsContainer.innerHTML = `<div class="empty">No posts yet</div>`;
      return;
    }
    postsContainer.innerHTML = "";
    snapshot.forEach(ds => renderPost(ds.data()));
  });
}

function renderPost(post) {
  const div = document.createElement("div");
  div.innerHTML = `
    <div style="background:#0f172a;border:1px solid #1e293b;border-radius:20px;padding:18px;margin-bottom:18px;">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px">
        <div style="width:46px;height:46px;border-radius:50%;background:${post.photoURL ? `url(${post.photoURL}) center/cover` : "#2563eb"};display:flex;align-items:center;justify-content:center;font-weight:700;overflow:hidden;flex-shrink:0;">
          ${post.photoURL ? "" : (profileData?.initials || "?")}
        </div>
        <div>
          <div style="font-weight:700;font-size:15px">${profileData?.displayName || ""}</div>
          <div style="color:#64748b;font-size:13px">@${profileData?.username || ""} · ${post.createdAt ? new Date(post.createdAt.seconds * 1000).toLocaleDateString() : ""}</div>
        </div>
      </div>
      <div style="color:#e2e8f0;line-height:1.6;font-size:15px">${post.text || ""}</div>
      ${post.imageUrl ? `<img src="${post.imageUrl}" style="width:100%;margin-top:14px;border-radius:16px;border:1px solid #1e293b;max-height:500px;object-fit:cover;">` : ""}
      ${post.videoUrl ? `<video src="${post.videoUrl}" controls style="width:100%;margin-top:14px;border-radius:16px;border:1px solid #1e293b;"></video>` : ""}
      <div style="margin-top:12px;color:#64748b;font-size:13px">❤️ ${post.likes?.length || 0} &nbsp; 💬 ${post.comments?.length || 0}</div>
    </div>
  `;
  postsContainer.appendChild(div);
}

// ── HELPERS ───────────────────────────────────────────
function initials(name = "") {
  return name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
}
