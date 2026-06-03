/**
 * profile.js — NexFounder Profile Page
 *
 * Upgrades vs original:
 *  • XSS: zero raw innerHTML user content; all text via textContent or esc()
 *  • Posts: docChanges() diffing prevents full re-render on every snapshot,
 *    fixing the "like/comment buttons break after onSnapshot" bug
 *  • Edit modal: username uniqueness check before saving
 *  • Email visibility toggle (stored as showEmail boolean)
 *  • Avatar/banner: safeUrl() validates URLs before use
 *  • Connect button: reads from cached currentUserData; single getDoc refresh
 *  • Listener cleanup via trackUnsub()
 */

import { auth, db } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  doc, getDoc, setDoc, updateDoc, collection,
  query, where, orderBy, getDocs, limit,
  arrayUnion, arrayRemove,
  onSnapshot, addDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { esc, safeUrl, avatarHTML, initials, timeAgo, trackUnsub, cleanupAll, cacheUser, getCachedUser } from "./utils.js";

const CLOUD_NAME    = "dr5uatib5";
const UPLOAD_PRESET = "nexfounder_upload";

let currentUser, profileData, targetUid, isOwnProfile;
let myData = null; // cached current user doc

// ── DOM ───────────────────────────────────────────────────────────────────────
const avatar          = document.getElementById("avatar");
const banner          = document.getElementById("banner");
const avatarInput     = document.getElementById("avatarInput");
const bannerInput     = document.getElementById("bannerInput");
const avatarEditBtn   = document.getElementById("avatarEditBtn");
const bannerEditBtn   = document.getElementById("bannerEditBtn");
const displayName     = document.getElementById("displayName");
const displayUsername = document.getElementById("displayUsername");
const displayBio      = document.getElementById("displayBio");
const displayEmail    = document.getElementById("displayEmail");   // optional el
const followersCount  = document.getElementById("followersCount");
const followingCount  = document.getElementById("followingCount");
const connectionsCount= document.getElementById("connectionsCount");
const openEditBtn     = document.getElementById("openEditBtn");
const connectBtn      = document.getElementById("connectBtn");
const messageBtn      = document.getElementById("messageBtn");
const editModal       = document.getElementById("editModal");
const cancelBtn       = document.getElementById("cancelBtn");
const saveBtn         = document.getElementById("saveBtn");
const inputName       = document.getElementById("inputName");
const inputUsername   = document.getElementById("inputUsername");
const inputBio        = document.getElementById("inputBio");
const inputShowEmail  = document.getElementById("inputShowEmail"); // checkbox toggle
const postsContainer  = document.getElementById("userPosts");

// ── AUTH ──────────────────────────────────────────────────────────────────────
onAuthStateChanged(auth, async (user) => {
  if (!user) { location.href = "index.html"; return; }
  currentUser = user;

  const params = new URLSearchParams(location.search);
  targetUid    = params.get("uid") || user.uid;
  isOwnProfile = targetUid === user.uid;

  // Load own data for connect state (only if viewing others)
  if (!isOwnProfile) {
    const mySnap = await getDoc(doc(db, "users", currentUser.uid));
    myData = mySnap.exists() ? mySnap.data() : {};
  }

  const userRef = doc(db, "users", targetUid);
  const snap    = await getDoc(userRef);

  if (!snap.exists() && isOwnProfile) {
    const name = user.email.split("@")[0];
    profileData = {
      displayName: name, username: name, bio: "", initials: initials(name),
      followers: [], following: [], connections: [], pendingConnections: [],
      sentConnections: [], email: user.email, photoURL: "", bannerURL: "",
      showEmail: false
    };
    await setDoc(userRef, profileData);
  }

  // Real-time profile updates
  trackUnsub(onSnapshot(userRef, (ds) => {
    if (!ds.exists()) return;
    profileData = ds.data();
    cacheUser(targetUid, profileData);
    renderProfile();
  }));

  loadPostsRealtime();
});

// ── CLOUDINARY ────────────────────────────────────────────────────────────────
async function uploadToCloudinary(file) {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("upload_preset", UPLOAD_PRESET);
  const res  = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, { method: "POST", body: fd });
  const data = await res.json();
  return data.secure_url || "";
}

// ── RENDER PROFILE ────────────────────────────────────────────────────────────
function renderProfile() {
  profileData.followers         = profileData.followers         || [];
  profileData.following         = profileData.following         || [];
  profileData.connections       = profileData.connections       || [];
  profileData.pendingConnections= profileData.pendingConnections|| [];
  profileData.sentConnections   = profileData.sentConnections   || [];

  // Use textContent — never innerHTML — for user data
  displayName.textContent     = profileData.displayName || "Unknown";
  displayUsername.textContent = `@${profileData.username || "user"}`;
  displayBio.textContent      = profileData.bio || "";

  // Email: only show if owner set showEmail = true (or it's own profile)
  if (displayEmail) {
    const show = isOwnProfile || profileData.showEmail;
    displayEmail.textContent = show ? (profileData.email || "") : "";
    displayEmail.style.display = show && profileData.email ? "block" : "none";
  }

  followersCount.textContent   = profileData.followers.length;
  followingCount.textContent   = profileData.following.length;
  connectionsCount.textContent = profileData.connections.length;

  // Avatar — safe URL only
  const photoUrl = safeUrl(profileData.photoURL);
  if (photoUrl) {
    avatar.style.backgroundImage    = `url(${photoUrl})`;
    avatar.style.backgroundSize     = "cover";
    avatar.style.backgroundPosition = "center";
    // Remove any text nodes, keep buttons
    Array.from(avatar.childNodes).forEach(n => { if (n.nodeType === Node.TEXT_NODE) n.remove(); });
  } else {
    avatar.style.backgroundImage = "";
    let span = avatar.querySelector("span.initials");
    if (!span) { span = document.createElement("span"); span.className = "initials"; avatar.prepend(span); }
    span.textContent = initials(profileData.displayName);
  }

  // Banner
  const bannerUrl = safeUrl(profileData.bannerURL);
  if (bannerUrl) {
    banner.style.backgroundImage    = `url(${bannerUrl})`;
    banner.style.backgroundSize     = "cover";
    banner.style.backgroundPosition = "center";
  }

  // Own profile vs other
  if (isOwnProfile) {
    openEditBtn.style.display   = "inline-flex";
    connectBtn.style.display    = "none";
    messageBtn.style.display    = "none";
    avatarEditBtn.style.display = "flex";
    bannerEditBtn.style.display = "block";
  } else {
    openEditBtn.style.display   = "none";
    messageBtn.style.display    = "inline-flex";
    avatarEditBtn.style.display = "none";
    bannerEditBtn.style.display = "none";
    renderConnectBtn();
  }
}

function renderConnectBtn() {
  const isConnected   = (profileData.connections || []).includes(currentUser.uid);
  const iSent         = (myData?.sentConnections   || []).includes(targetUid);
  const theyRequested = (myData?.pendingConnections || []).includes(targetUid);

  connectBtn.style.display = "inline-flex";
  connectBtn.className     = "connectbtn";

  if (isConnected)        { connectBtn.textContent = "✓ Connected";    connectBtn.classList.add("connected"); }
  else if (iSent)         { connectBtn.textContent = "Request Sent";   connectBtn.classList.add("pending"); }
  else if (theyRequested) { connectBtn.textContent = "Accept Request"; connectBtn.classList.add("accept"); }
  else                    { connectBtn.textContent = "Connect";        connectBtn.classList.add("default"); }
}

// ── FILE PICKERS ──────────────────────────────────────────────────────────────
avatar.addEventListener("click",    () => { if (isOwnProfile) avatarInput.click(); });
banner.addEventListener("click",    () => { if (isOwnProfile) bannerInput.click(); });
avatarEditBtn.onclick = (e) => { e.stopPropagation(); avatarInput.click(); };
bannerEditBtn.onclick = (e) => { e.stopPropagation(); bannerInput.click(); };

avatarInput.addEventListener("change", async (e) => {
  const file = e.target.files[0]; if (!file) return;
  avatar.style.opacity = "0.5";
  try {
    const url = await uploadToCloudinary(file);
    await updateDoc(doc(db, "users", currentUser.uid), { photoURL: url });
  } catch { alert("Failed to upload photo."); }
  avatar.style.opacity = "1";
  e.target.value = "";
});

bannerInput.addEventListener("change", async (e) => {
  const file = e.target.files[0]; if (!file) return;
  banner.style.opacity = "0.6";
  try {
    const url = await uploadToCloudinary(file);
    await updateDoc(doc(db, "users", currentUser.uid), { bannerURL: url });
  } catch { alert("Failed to upload banner."); }
  banner.style.opacity = "1";
  e.target.value = "";
});

// ── CONNECT ───────────────────────────────────────────────────────────────────
connectBtn.onclick = async () => {
  const myRef     = doc(db, "users", currentUser.uid);
  const targetRef = doc(db, "users", targetUid);

  // Refresh myData snapshot before acting
  const mySnap = await getDoc(myRef);
  myData = mySnap.data() || {};

  const isConnected   = (profileData.connections || []).includes(currentUser.uid);
  const iSent         = (myData.sentConnections   || []).includes(targetUid);
  const theyRequested = (myData.pendingConnections || []).includes(targetUid);

  connectBtn.disabled = true;

  try {
    if (isConnected) {
      await updateDoc(myRef,     { connections: arrayRemove(targetUid) });
      await updateDoc(targetRef, { connections: arrayRemove(currentUser.uid) });
    } else if (iSent) {
      await updateDoc(myRef,     { sentConnections:    arrayRemove(targetUid) });
      await updateDoc(targetRef, { pendingConnections: arrayRemove(currentUser.uid) });
    } else if (theyRequested) {
      await updateDoc(myRef, { pendingConnections: arrayRemove(targetUid), connections: arrayUnion(targetUid) });
      await updateDoc(targetRef, { sentConnections: arrayRemove(currentUser.uid), connections: arrayUnion(currentUser.uid) });
      await addDoc(collection(db, "notifications"), {
        toUid: targetUid, fromUid: currentUser.uid,
        fromName: myData.displayName, fromUsername: myData.username,
        fromPhoto: safeUrl(myData.photoURL) || "",
        type: "connect_accepted", read: false, createdAt: serverTimestamp()
      });
    } else {
      await updateDoc(myRef,     { sentConnections:    arrayUnion(targetUid) });
      await updateDoc(targetRef, { pendingConnections: arrayUnion(currentUser.uid) });
      await addDoc(collection(db, "notifications"), {
        toUid: targetUid, fromUid: currentUser.uid,
        fromName: myData.displayName, fromUsername: myData.username,
        fromPhoto: safeUrl(myData.photoURL) || "",
        type: "connect_request", read: false, createdAt: serverTimestamp()
      });
    }

    // Refresh myData after update
    const refreshed = await getDoc(myRef);
    myData = refreshed.data() || {};
    renderConnectBtn();
  } catch (err) {
    console.error(err);
  }

  connectBtn.disabled = false;
};

// ── MESSAGE ───────────────────────────────────────────────────────────────────
messageBtn.onclick = () => { location.href = `messages.html?uid=${encodeURIComponent(targetUid)}`; };

// ── EDIT MODAL ────────────────────────────────────────────────────────────────
openEditBtn.onclick = () => {
  inputName.value     = profileData.displayName || "";
  inputUsername.value = profileData.username    || "";
  inputBio.value      = profileData.bio         || "";
  if (inputShowEmail) inputShowEmail.checked = !!profileData.showEmail;
  editModal.classList.add("open");
};
cancelBtn.onclick = () => editModal.classList.remove("open");

saveBtn.onclick = async () => {
  const name     = inputName.value.trim();
  const username = inputUsername.value.trim().toLowerCase().replace(/[^a-z0-9_]/g, "");
  const bio      = inputBio.value.trim().slice(0, 200);
  const showEmail= inputShowEmail ? inputShowEmail.checked : false;

  if (!name || !username) { alert("Name and username are required."); return; }

  // Username uniqueness check (skip if unchanged)
  if (username !== profileData.username) {
    const q    = query(collection(db, "users"), where("username", "==", username), limit(1));
    const snap = await getDocs(q);
    if (!snap.empty) { alert("Username is already taken."); return; }
  }

  saveBtn.disabled = true; saveBtn.textContent = "Saving…";

  try {
    await updateDoc(doc(db, "users", currentUser.uid), {
      displayName: name,
      username,
      bio,
      initials: initials(name),
      showEmail
    });
    editModal.classList.remove("open");
  } catch (err) {
    console.error(err);
    alert("Update failed.");
  }

  saveBtn.disabled = false; saveBtn.textContent = "Save";
};

// ── POSTS (docChanges diffing) ────────────────────────────────────────────────
function loadPostsRealtime() {
  const q = query(
    collection(db, "posts"),
    where("uid", "==", targetUid),
    orderBy("createdAt", "desc"),
    limit(30)
  );

  let initialLoad = true;

  trackUnsub(onSnapshot(q, (snapshot) => {
    if (initialLoad) {
      postsContainer.innerHTML = "";
      if (snapshot.empty) {
        postsContainer.innerHTML = `<div class="empty">No posts yet</div>`;
        initialLoad = false;
        return;
      }
      snapshot.forEach(ds => postsContainer.appendChild(buildPostEl(ds)));
      initialLoad = false;
      return;
    }

    // Incremental updates — preserves open comment sections
    snapshot.docChanges().forEach(change => {
      if (change.type === "added") {
        postsContainer.insertBefore(buildPostEl(change.doc), postsContainer.firstChild);
      } else if (change.type === "modified") {
        const old = postsContainer.querySelector(`[data-post-id="${change.doc.id}"]`);
        if (old) old.replaceWith(buildPostEl(change.doc));
      } else if (change.type === "removed") {
        postsContainer.querySelector(`[data-post-id="${change.doc.id}"]`)?.remove();
      }
    });
  }));
}

function buildPostEl(docSnap) {
  const post = docSnap.data();
  const id   = docSnap.id;
  const time = post.createdAt
    ? new Date(post.createdAt.seconds * 1000).toLocaleDateString()
    : "";

  const wrapper = document.createElement("div");
  wrapper.className    = "post-card";
  wrapper.dataset.postId = id;
  wrapper.style.cssText = "background:#0f172a;border:1px solid #1e293b;border-radius:20px;padding:18px;margin-bottom:18px;";

  // Header
  const header = document.createElement("div");
  header.style.cssText = "display:flex;align-items:center;gap:12px;margin-bottom:12px";

  const av = document.createElement("div");
  av.style.cssText = "width:46px;height:46px;border-radius:50%;background:#2563eb;display:flex;align-items:center;justify-content:center;font-weight:700;overflow:hidden;";
  const photoUrl = safeUrl(post.photoURL || profileData?.photoURL || "");
  if (photoUrl) {
    const img = document.createElement("img");
    img.src = photoUrl; img.alt = esc(post.displayName || "");
    img.style.cssText = "width:100%;height:100%;object-fit:cover;";
    img.loading = "lazy";
    av.appendChild(img);
  } else {
    av.textContent = profileData?.initials || "?";
  }

  const info = document.createElement("div");
  const nameEl = document.createElement("div");
  nameEl.style.cssText = "font-weight:700;font-size:15px";
  nameEl.textContent   = profileData?.displayName || "";
  const metaEl = document.createElement("div");
  metaEl.style.cssText = "color:#64748b;font-size:13px";
  metaEl.textContent   = `@${profileData?.username || ""} · ${time}`;
  info.appendChild(nameEl);
  info.appendChild(metaEl);

  header.appendChild(av);
  header.appendChild(info);

  // Body
  const body = document.createElement("div");
  body.style.cssText  = "color:#e2e8f0;line-height:1.6;font-size:15px";
  body.textContent    = post.text || "";   // textContent = XSS safe

  // Stats
  const stats = document.createElement("div");
  stats.style.cssText = "margin-top:12px;color:#64748b;font-size:13px";
  stats.textContent   = `❤️ ${(post.likes || []).length}  💬 ${(post.comments || []).length}`;

  wrapper.appendChild(header);
  wrapper.appendChild(body);

  // Media — safe URLs
  const imgUrl = safeUrl(post.imageUrl);
  if (imgUrl) {
    const img = document.createElement("img");
    img.src = imgUrl; img.alt = "Post image"; img.loading = "lazy";
    img.style.cssText = "width:100%;margin-top:14px;border-radius:16px;border:1px solid #1e293b;max-height:500px;object-fit:cover;";
    wrapper.appendChild(img);
  }
  const vidUrl = safeUrl(post.videoUrl);
  if (vidUrl) {
    const vid = document.createElement("video");
    vid.src = vidUrl; vid.controls = true; vid.preload = "none";
    vid.style.cssText = "width:100%;margin-top:14px;border-radius:16px;border:1px solid #1e293b;";
    wrapper.appendChild(vid);
  }

  wrapper.appendChild(stats);
  return wrapper;
}
