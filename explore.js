import { auth, db } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  collection, doc, getDoc, getDocs, addDoc, updateDoc, 
  query, orderBy, limit, onSnapshot, where,
  arrayUnion, arrayRemove, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

let currentUser = null;
let currentUserData = null;
let allUsers = [];

const peopleGrid   = document.getElementById("peopleGrid");
const trendingEl   = document.getElementById("trendingPosts");
const searchInput  = document.getElementById("searchInput");
const notifBadge   = document.getElementById("notifBadge");
const msgBadge     = document.getElementById("msgBadge");

onAuthStateChanged(auth, async (user) => {
  if (!user) { location.href = "index.html"; return; }
  currentUser = user;
  const snap = await getDoc(doc(db,"users",user.uid));
  if (snap.exists()) {
    currentUserData = snap.data();
    setNavAvatar();
  }
  loadPeople();
  loadTrendingPosts();
  watchBadges();
});

function setNavAvatar() {
  const el = document.getElementById("navAvatar");
  document.getElementById("navName").textContent = currentUserData.displayName || "You";
  if (currentUserData.photoURL) el.innerHTML = `<img src="${currentUserData.photoURL}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
  else el.textContent = currentUserData.initials || "?";
}

// ── LOAD PEOPLE ──────────────────────────────────────
async function loadPeople(filterText = "") {
  peopleGrid.innerHTML = "";
  const snap = await getDocs(collection(db,"users"));
  allUsers = [];
  snap.forEach(d => { if (d.id !== currentUser.uid) allUsers.push({ id:d.id, ...d.data() }); });

  let filtered = allUsers;
  if (filterText) {
    const q = filterText.toLowerCase();
    filtered = allUsers.filter(u =>
      u.displayName?.toLowerCase().includes(q) ||
      u.username?.toLowerCase().includes(q) ||
      u.bio?.toLowerCase().includes(q)
    );
  }

  if (!filtered.length) {
    peopleGrid.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><div>😕</div>No founders found</div>`;
    return;
  }

  filtered.forEach(u => {
    const myData = currentUserData;
    const connections  = myData.connections || [];
    const pending      = myData.sentConnections || [];   // sent by me, waiting
    const incomingPending = myData.pendingConnections || []; // others sent to me

    let btnClass = "default";
    let btnText  = "Connect";
    if (connections.includes(u.id))           { btnClass="connected"; btnText="✓ Connected"; }
    else if (pending.includes(u.id))          { btnClass="pending";   btnText="Request Sent"; }
    else if (incomingPending.includes(u.id))  { btnClass="connected"; btnText="Accept"; }

    const card = document.createElement("div");
    card.className = "person-card";
    card.innerHTML = `
      <div class="person-avatar">
        ${u.photoURL ? `<img src="${u.photoURL}">` : (u.initials||"?")}
      </div>
      <div class="person-name">${u.displayName||"Unknown"}</div>
      <div class="person-username">@${u.username||""}</div>
      ${u.bio ? `<div class="person-bio">${u.bio.slice(0,80)}${u.bio.length>80?"...":""}</div>` : ""}
      <button class="connect-btn ${btnClass}" data-uid="${u.id}" data-class="${btnClass}">${btnText}</button>
      <a href="profile.html?uid=${u.id}" class="view-profile-btn">View Profile →</a>
    `;
    card.querySelector(".connect-btn").onclick = (e) => handleConnect(e.currentTarget, u);
    peopleGrid.appendChild(card);
  });
}

// ── HANDLE CONNECT ───────────────────────────────────
async function handleConnect(btn, targetUser) {
  const state = btn.dataset.class;
  if (state === "pending") return; // already sent

  const myRef     = doc(db,"users",currentUser.uid);
  const targetRef = doc(db,"users",targetUser.id);

  if (state === "connected") {
    // disconnect
    await updateDoc(myRef,     { connections: arrayRemove(targetUser.id) });
    await updateDoc(targetRef, { connections: arrayRemove(currentUser.uid) });
    btn.textContent = "Connect"; btn.className="connect-btn default"; btn.dataset.class="default";

  } else if (btn.textContent === "Accept") {
    // accept incoming request
    await updateDoc(myRef, {
      pendingConnections: arrayRemove(targetUser.id),
      connections: arrayUnion(targetUser.id)
    });
    await updateDoc(targetRef, {
      sentConnections: arrayRemove(currentUser.uid),
      connections: arrayUnion(currentUser.uid)
    });
    btn.textContent = "✓ Connected"; btn.className="connect-btn connected"; btn.dataset.class="connected";

    // notify the requester that they were accepted
    await addDoc(collection(db,"notifications"), {
      toUid: targetUser.id,
      fromUid: currentUser.uid,
      fromName: currentUserData.displayName,
      fromUsername: currentUserData.username,
      fromPhoto: currentUserData.photoURL||"",
      type: "connect_accepted",
      read: false,
      createdAt: serverTimestamp()
    });

  } else {
    // send request
    await updateDoc(myRef,     { sentConnections:    arrayUnion(targetUser.id) });
    await updateDoc(targetRef, { pendingConnections: arrayUnion(currentUser.uid) });
    btn.textContent = "Request Sent"; btn.className="connect-btn pending"; btn.dataset.class="pending";

    // notify target
    await addDoc(collection(db,"notifications"), {
      toUid: targetUser.id,
      fromUid: currentUser.uid,
      fromName: currentUserData.displayName,
      fromUsername: currentUserData.username,
      fromPhoto: currentUserData.photoURL||"",
      type: "connect_request",
      read: false,
      createdAt: serverTimestamp()
    });
    // refresh current user data
    const me = await getDoc(doc(db,"users",currentUser.uid));
    currentUserData = me.data();
  }
}

// ── TRENDING POSTS ───────────────────────────────────
function loadTrendingPosts() {
  const q = query(collection(db,"posts"), orderBy("createdAt","desc"), limit(20));
  onSnapshot(q, (snap) => {
    const posts = [];
    snap.forEach(d => posts.push({ id:d.id, ...d.data() }));
    // sort by likes count
    posts.sort((a,b) => (b.likes?.length||0) - (a.likes?.length||0));
    trendingEl.innerHTML = "";
    posts.slice(0,10).forEach(post => {
      const time = post.createdAt
        ? new Date(post.createdAt.seconds*1000).toLocaleDateString()
        : "";
      const div = document.createElement("div");
      div.className = "trending-post";
      div.innerHTML = `
        <div class="tp-meta">@${post.username||""} · ${time}</div>
        <div class="tp-text">${post.text?.slice(0,200)||""}</div>
        <div class="tp-stats">
          <span>❤️ ${post.likes?.length||0}</span>
          <span>💬 ${post.comments?.length||0}</span>
        </div>
      `;
      div.onclick = () => location.href = `profile.html?uid=${post.uid}`;
      trendingEl.appendChild(div);
    });
  });
}

// ── SEARCH ───────────────────────────────────────────
searchInput.addEventListener("input", () => {
  loadPeople(searchInput.value.trim());
});

// ── BADGES ───────────────────────────────────────────
function watchBadges() {
  onSnapshot(
    query(collection(db,"notifications"), where("toUid","==",currentUser.uid), where("read","==",false)),
    (snap) => {
      notifBadge.textContent = snap.size > 9 ? "9+" : snap.size;
      notifBadge.classList.toggle("show", snap.size > 0);
    }
  );
  onSnapshot(
    query(collection(db,"messages"), where("toUid","==",currentUser.uid), where("read","==",false)),
    (snap) => {
      msgBadge.textContent = snap.size > 9 ? "9+" : snap.size;
      msgBadge.classList.toggle("show", snap.size > 0);
    }
  );
}
