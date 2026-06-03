/**
 * explore.js — NexFounder People / Explore Page
 *
 * Upgrades vs original:
 *  • XSS: all user data via textContent or esc(); no raw innerHTML interpolation
 *  • Performance: users fetched once and cached; search is client-side filter
 *  • Low data: trending posts limited to 20, then sorted client-side (unchanged)
 *    but onSnapshot replaced with a one-time getDocs + manual refresh to avoid
 *    a persistent listener for rarely-changing data
 *  • Listener cleanup via trackUnsub()
 *  • safeUrl() on all photo URLs
 *  • debounced search input
 */

import { auth, db } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  collection, doc, getDoc, getDocs, addDoc, updateDoc,
  query, orderBy, limit, onSnapshot, where,
  arrayUnion, arrayRemove, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { esc, safeUrl, avatarHTML, debounce, initials, trackUnsub } from "./utils.js";

let currentUser     = null;
let currentUserData = null;
let allUsers        = [];    // fetched once

const peopleGrid   = document.getElementById("peopleGrid");
const trendingEl   = document.getElementById("trendingPosts");
const searchInput  = document.getElementById("searchInput");
const notifBadge   = document.getElementById("notifBadge");
const msgBadge     = document.getElementById("msgBadge");

// ── AUTH ──────────────────────────────────────────────────────────────────────
onAuthStateChanged(auth, async (user) => {
  if (!user) { location.href = "index.html"; return; }
  currentUser = user;

  const snap = await getDoc(doc(db, "users", user.uid));
  if (snap.exists()) {
    currentUserData = snap.data();
    setNavAvatar();
  }

  await fetchAllUsers();
  renderPeople();
  loadTrendingPosts();
  watchBadges();
});

function setNavAvatar() {
  const el    = document.getElementById("navAvatar");
  const nName = document.getElementById("navName");
  if (nName) nName.textContent = currentUserData.displayName || "You";
  if (!el) return;
  const url = safeUrl(currentUserData.photoURL);
  if (url) {
    const img = document.createElement("img");
    img.src   = url;
    img.style.cssText = "width:100%;height:100%;object-fit:cover;border-radius:50%;";
    img.alt   = esc(currentUserData.displayName || "");
    el.replaceChildren(img);
  } else {
    el.textContent = currentUserData.initials || initials(currentUserData.displayName) || "?";
  }
}

// ── FETCH USERS (once) ────────────────────────────────────────────────────────
async function fetchAllUsers() {
  const snap = await getDocs(collection(db, "users"));
  allUsers = [];
  snap.forEach(d => { if (d.id !== currentUser.uid) allUsers.push({ id: d.id, ...d.data() }); });
}

// ── RENDER PEOPLE ─────────────────────────────────────────────────────────────
function renderPeople(filterText = "") {
  peopleGrid.innerHTML = "";

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
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.style.gridColumn = "1 / -1";
    empty.textContent = "No founders found";
    peopleGrid.appendChild(empty);
    return;
  }

  filtered.forEach(u => buildPersonCard(u));
}

function buildPersonCard(u) {
  const connections      = currentUserData.connections       || [];
  const pending          = currentUserData.sentConnections   || [];
  const incomingPending  = currentUserData.pendingConnections || [];

  let btnClass = "default", btnText = "Connect";
  if (connections.includes(u.id))      { btnClass = "connected"; btnText = "✓ Connected"; }
  else if (pending.includes(u.id))     { btnClass = "pending";   btnText = "Request Sent"; }
  else if (incomingPending.includes(u.id)) { btnClass = "connected"; btnText = "Accept"; }

  const card = document.createElement("div");
  card.className = "person-card";

  // Avatar — safe DOM
  const avDiv = document.createElement("div");
  avDiv.className = "person-avatar";
  const url = safeUrl(u.photoURL);
  if (url) {
    const img = document.createElement("img");
    img.src = url; img.alt = esc(u.displayName || "");
    img.style.cssText = "width:100%;height:100%;object-fit:cover;border-radius:50%;";
    img.loading = "lazy";
    avDiv.appendChild(img);
  } else {
    avDiv.textContent = u.initials || initials(u.displayName) || "?";
  }

  const nameEl = document.createElement("div");
  nameEl.className = "person-name";
  nameEl.textContent = u.displayName || "Unknown";

  const usernameEl = document.createElement("div");
  usernameEl.className = "person-username";
  usernameEl.textContent = `@${u.username || ""}`;

  const btn = document.createElement("button");
  btn.className   = `connect-btn ${btnClass}`;
  btn.dataset.uid   = u.id;
  btn.dataset.class = btnClass;
  btn.textContent = btnText;
  btn.onclick = (e) => handleConnect(e.currentTarget, u);

  const viewLink = document.createElement("a");
  viewLink.className = "view-profile-btn";
  viewLink.href      = `profile.html?uid=${encodeURIComponent(u.id)}`;
  viewLink.textContent = "View Profile →";

  card.appendChild(avDiv);
  card.appendChild(nameEl);
  card.appendChild(usernameEl);

  if (u.bio) {
    const bioEl = document.createElement("div");
    bioEl.className   = "person-bio";
    bioEl.textContent = u.bio.slice(0, 80) + (u.bio.length > 80 ? "…" : "");
    card.appendChild(bioEl);
  }

  card.appendChild(btn);
  card.appendChild(viewLink);
  peopleGrid.appendChild(card);
}

// ── HANDLE CONNECT ────────────────────────────────────────────────────────────
async function handleConnect(btn, targetUser) {
  const state = btn.dataset.class;
  if (state === "pending") return;

  const myRef     = doc(db, "users", currentUser.uid);
  const targetRef = doc(db, "users", targetUser.id);

  btn.disabled = true;

  try {
    if (state === "connected") {
      await updateDoc(myRef,     { connections: arrayRemove(targetUser.id) });
      await updateDoc(targetRef, { connections: arrayRemove(currentUser.uid) });
      btn.textContent = "Connect"; btn.className = "connect-btn default"; btn.dataset.class = "default";

    } else if (btn.textContent === "Accept") {
      await updateDoc(myRef, {
        pendingConnections: arrayRemove(targetUser.id),
        connections:        arrayUnion(targetUser.id)
      });
      await updateDoc(targetRef, {
        sentConnections: arrayRemove(currentUser.uid),
        connections:     arrayUnion(currentUser.uid)
      });
      btn.textContent = "✓ Connected"; btn.className = "connect-btn connected"; btn.dataset.class = "connected";
      await addDoc(collection(db, "notifications"), {
        toUid: targetUser.id, fromUid: currentUser.uid,
        fromName: currentUserData.displayName, fromUsername: currentUserData.username,
        fromPhoto: safeUrl(currentUserData.photoURL) || "",
        type: "connect_accepted", read: false, createdAt: serverTimestamp()
      });

    } else {
      await updateDoc(myRef,     { sentConnections:    arrayUnion(targetUser.id) });
      await updateDoc(targetRef, { pendingConnections: arrayUnion(currentUser.uid) });
      btn.textContent = "Request Sent"; btn.className = "connect-btn pending"; btn.dataset.class = "pending";
      await addDoc(collection(db, "notifications"), {
        toUid: targetUser.id, fromUid: currentUser.uid,
        fromName: currentUserData.displayName, fromUsername: currentUserData.username,
        fromPhoto: safeUrl(currentUserData.photoURL) || "",
        type: "connect_request", read: false, createdAt: serverTimestamp()
      });
      // Refresh local currentUserData to reflect sent request
      const me = await getDoc(doc(db, "users", currentUser.uid));
      currentUserData = me.data();
    }
  } catch (err) { console.error(err); }

  btn.disabled = false;
}

// ── TRENDING POSTS (one-time fetch, no persistent listener) ───────────────────
async function loadTrendingPosts() {
  const q = query(collection(db, "posts"), orderBy("createdAt", "desc"), limit(20));
  const snap = await getDocs(q); // one-time — not a live listener

  const posts = [];
  snap.forEach(d => posts.push({ id: d.id, ...d.data() }));
  posts.sort((a, b) => (b.likes?.length || 0) - (a.likes?.length || 0));

  trendingEl.innerHTML = "";
  posts.slice(0, 10).forEach(post => {
    const time = post.createdAt
      ? new Date(post.createdAt.seconds * 1000).toLocaleDateString()
      : "";

    const div = document.createElement("div");
    div.className = "trending-post";

    const meta = document.createElement("div");
    meta.className   = "tp-meta";
    meta.textContent = `@${post.username || ""} · ${time}`;

    const text = document.createElement("div");
    text.className   = "tp-text";
    text.textContent = (post.text || "").slice(0, 200); // textContent = safe

    const statsDiv = document.createElement("div");
    statsDiv.className   = "tp-stats";
    statsDiv.textContent = `❤️ ${post.likes?.length || 0}  💬 ${post.comments?.length || 0}`;

    div.appendChild(meta);
    div.appendChild(text);
    div.appendChild(statsDiv);
    div.onclick = () => { location.href = `profile.html?uid=${encodeURIComponent(post.uid)}`; };
    trendingEl.appendChild(div);
  });
}

// ── SEARCH ────────────────────────────────────────────────────────────────────
searchInput?.addEventListener("input", debounce(() => {
  renderPeople(searchInput.value.trim());
}, 200));

// ── BADGES ────────────────────────────────────────────────────────────────────
function watchBadges() {
  trackUnsub(onSnapshot(
    query(collection(db, "notifications"), where("toUid", "==", currentUser.uid), where("read", "==", false)),
    snap => {
      notifBadge.textContent = snap.size > 9 ? "9+" : snap.size;
      notifBadge.classList.toggle("show", snap.size > 0);
    }
  ));
  // Use conversations unreadBy instead of scanning all messages
  trackUnsub(onSnapshot(
    query(collection(db, "conversations"), where("participants", "array-contains", currentUser.uid), where("unreadBy", "array-contains", currentUser.uid)),
    snap => {
      msgBadge.textContent = snap.size > 9 ? "9+" : snap.size;
      msgBadge.classList.toggle("show", snap.size > 0);
    }
  ));
}
