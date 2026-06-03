/**
 * notifications.js — NexFounder Notifications
 *
 * Upgrades vs original:
 *  • XSS: all user content via textContent or esc(); no innerHTML with user data
 *  • safeUrl() on fromPhoto
 *  • Listener cleanup via trackUnsub()
 *  • markAllBtn: uses batch from top-level import (not dynamic import)
 */

import { auth, db } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  collection, doc, getDoc, updateDoc, writeBatch, getDocs,
  query, orderBy, onSnapshot, where, addDoc, arrayUnion, arrayRemove, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { esc, safeUrl, timeAgo, trackUnsub } from "./utils.js";

let currentUser     = null;
let currentUserData = null;

const notifList  = document.getElementById("notifList");
const markAllBtn = document.getElementById("markAllBtn");
const notifBadge = document.getElementById("notifBadge");
const msgBadge   = document.getElementById("msgBadge");

// ── AUTH ──────────────────────────────────────────────────────────────────────
onAuthStateChanged(auth, async (user) => {
  if (!user) { location.href = "index.html"; return; }
  currentUser = user;
  const snap = await getDoc(doc(db, "users", user.uid));
  if (snap.exists()) {
    currentUserData = snap.data();
    setNavAvatar();
  }
  loadNotifications();
  watchBadges();
});

function setNavAvatar() {
  const el = document.getElementById("navAvatar");
  const nn = document.getElementById("navName");
  if (nn) nn.textContent = currentUserData.displayName || "You";
  if (!el) return;
  const url = safeUrl(currentUserData.photoURL);
  if (url) {
    const img = document.createElement("img");
    img.src = url; img.alt = esc(currentUserData.displayName || "");
    img.style.cssText = "width:100%;height:100%;object-fit:cover;border-radius:50%;";
    el.replaceChildren(img);
  } else {
    el.textContent = currentUserData.initials || "?";
  }
}

// ── LOAD NOTIFICATIONS ────────────────────────────────────────────────────────
function loadNotifications() {
  const q = query(
    collection(db, "notifications"),
    where("toUid", "==", currentUser.uid),
    orderBy("createdAt", "desc")
  );

  trackUnsub(onSnapshot(q, (snap) => {
    notifList.innerHTML = "";
    if (snap.empty) {
      notifList.innerHTML = `<div class="empty-state"><div>🔔</div>No notifications yet</div>`;
      return;
    }
    snap.forEach(d => renderNotif(d));
  }));
}

// ── RENDER NOTIFICATION ───────────────────────────────────────────────────────
const ICON_MAP = {
  like: "❤️", comment: "💬",
  connect_request: "🤝", connect_accepted: "✅", follow: "👤"
};

function renderNotif(docSnap) {
  const n  = docSnap.data();
  const id = docSnap.id;
  const t  = n.createdAt ? timeAgo(n.createdAt.seconds * 1000) : "";

  const el = document.createElement("div");
  el.className = `notif-item ${n.read ? "" : "unread"}`;

  // Avatar — safe
  const avDiv = document.createElement("div");
  avDiv.className = "notif-avatar";
  const url = safeUrl(n.fromPhoto);
  if (url) {
    const img = document.createElement("img");
    img.src = url; img.alt = esc(n.fromName || "");
    img.style.cssText = "width:100%;height:100%;object-fit:cover;border-radius:50%;";
    avDiv.appendChild(img);
  } else {
    avDiv.textContent = (n.fromName || "?").slice(0, 2);
  }

  // Body
  const body = document.createElement("div");
  body.className = "notif-body";

  // Text — compose safely (bold name + plain text)
  const textEl = document.createElement("div");
  textEl.className = "notif-text";
  const bold = document.createElement("b");
  bold.textContent = n.fromName || "Someone";
  textEl.appendChild(bold);

  const actionText = {
    like:             " liked your post",
    comment:          " commented on your post",
    connect_request:  " sent you a connection request",
    connect_accepted: " accepted your connection request",
    follow:           " started following you"
  }[n.type] || ` — ${n.type}`;
  textEl.appendChild(document.createTextNode(actionText));
  body.appendChild(textEl);

  // Sub-text (post snippet or comment preview)
  if (n.postText) {
    const sub = document.createElement("div");
    sub.className  = "notif-subtext";
    sub.textContent= `"${n.postText}"`;
    body.appendChild(sub);
  }
  if (n.commentText) {
    const sub = document.createElement("div");
    sub.className  = "notif-subtext";
    sub.textContent= `Comment: "${n.commentText}"`;
    body.appendChild(sub);
  }

  // Time
  const timeEl = document.createElement("div");
  timeEl.className  = "notif-time";
  timeEl.textContent= t;
  body.appendChild(timeEl);

  // Accept / Decline for connect_request
  if (n.type === "connect_request") {
    const row = document.createElement("div");
    row.className = "accept-row";

    const acceptBtn = document.createElement("button");
    acceptBtn.className  = "accept-btn";
    acceptBtn.textContent= "Accept";
    acceptBtn.onclick = (e) => { e.stopPropagation(); acceptConnect(n.fromUid, id); };

    const declineBtn = document.createElement("button");
    declineBtn.className  = "decline-btn";
    declineBtn.textContent= "Decline";
    declineBtn.onclick = (e) => { e.stopPropagation(); declineConnect(n.fromUid, id); };

    row.appendChild(acceptBtn);
    row.appendChild(declineBtn);
    body.appendChild(row);
  }

  // Icon
  const iconDiv = document.createElement("div");
  iconDiv.className  = "notif-icon";
  iconDiv.textContent= ICON_MAP[n.type] || "🔔";

  el.appendChild(avDiv);
  el.appendChild(body);
  el.appendChild(iconDiv);

  // Click to mark read + navigate
  el.onclick = async () => {
    await markRead(id);
    if (n.fromUid) location.href = `profile.html?uid=${encodeURIComponent(n.fromUid)}`;
  };

  notifList.appendChild(el);
}

// ── MARK READ ─────────────────────────────────────────────────────────────────
async function markRead(id) {
  await updateDoc(doc(db, "notifications", id), { read: true });
}

markAllBtn?.addEventListener("click", async () => {
  const q    = query(collection(db, "notifications"), where("toUid", "==", currentUser.uid), where("read", "==", false));
  const snap = await getDocs(q);
  const batch = writeBatch(db);
  snap.forEach(d => batch.update(d.ref, { read: true }));
  await batch.commit();
});

// ── ACCEPT / DECLINE ─────────────────────────────────────────────────────────
async function acceptConnect(fromUid, notifId) {
  const myRef   = doc(db, "users", currentUser.uid);
  const fromRef = doc(db, "users", fromUid);
  await updateDoc(myRef,   { pendingConnections: arrayRemove(fromUid), connections: arrayUnion(fromUid) });
  await updateDoc(fromRef, { sentConnections: arrayRemove(currentUser.uid), connections: arrayUnion(currentUser.uid) });
  await markRead(notifId);
  await addDoc(collection(db, "notifications"), {
    toUid: fromUid, fromUid: currentUser.uid,
    fromName: currentUserData.displayName, fromUsername: currentUserData.username,
    fromPhoto: safeUrl(currentUserData.photoURL) || "",
    type: "connect_accepted", read: false, createdAt: serverTimestamp()
  });
}

async function declineConnect(fromUid, notifId) {
  await updateDoc(doc(db, "users", currentUser.uid), { pendingConnections: arrayRemove(fromUid) });
  await updateDoc(doc(db, "users", fromUid),          { sentConnections:   arrayRemove(currentUser.uid) });
  await markRead(notifId);
}

// ── BADGES ────────────────────────────────────────────────────────────────────
function watchBadges() {
  trackUnsub(onSnapshot(
    query(collection(db, "notifications"), where("toUid", "==", currentUser.uid), where("read", "==", false)),
    snap => {
      notifBadge.textContent = snap.size > 9 ? "9+" : snap.size;
      notifBadge.classList.toggle("show", snap.size > 0);
    }
  ));
  trackUnsub(onSnapshot(
    query(collection(db, "conversations"), where("participants", "array-contains", currentUser.uid), where("unreadBy", "array-contains", currentUser.uid)),
    snap => {
      msgBadge.textContent = snap.size > 9 ? "9+" : snap.size;
      msgBadge.classList.toggle("show", snap.size > 0);
    }
  ));
}
