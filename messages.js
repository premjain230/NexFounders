import { auth, db } from "./firebase.js";

import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  setDoc,
  updateDoc,
  query,
  orderBy,
  onSnapshot,
  where,
  serverTimestamp,
  arrayRemove
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

/* ─────────────────────────────
   GLOBAL STATE
───────────────────────────── */
let currentUser = null;
let currentUserData = null;
let activeConvId = null;
let unsubChat = null;
let conversationsCache = [];

/* ─────────────────────────────
   DOM
───────────────────────────── */
const convList    = document.getElementById("convList");
const chatPanel   = document.getElementById("chatPanel");
const convSearch  = document.getElementById("convSearch");
const msgBadge    = document.getElementById("msgBadge");
const searchInput = document.getElementById("searchInput");
const modal       = document.getElementById("modal");
const newMsgBtn   = document.getElementById("newMsgBtn");
const closeModal  = document.getElementById("closeModal");
const modalSearch = document.getElementById("modalSearch");
const modalList   = document.getElementById("modalList");

/* ─────────────────────────────
   AUTH
───────────────────────────── */
onAuthStateChanged(auth, async (user) => {
  if (!user) { location.href = "index.html"; return; }
  currentUser = user;

  const snap = await getDoc(doc(db, "users", user.uid));
  if (snap.exists()) currentUserData = snap.data();

  loadConversations();
  loadUsers();
});

/* ─────────────────────────────
   HELPERS
───────────────────────────── */
function formatTime(ts) {
  if (!ts?.toDate) return "";
  return ts.toDate().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function escapeHTML(str) {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function avatarHTML(user, size = 44) {
  if (user.photoURL) {
    return `<img src="${user.photoURL}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
  }
  return user.initials || "?";
}

/* ─────────────────────────────
   LOAD CONVERSATIONS
───────────────────────────── */
function loadConversations(filter = "") {
  const q = query(
    collection(db, "conversations"),
    where("participants", "array-contains", currentUser.uid),
    orderBy("lastMessageAt", "desc")
  );

  onSnapshot(q, async (snap) => {
    convList.innerHTML = "";
    conversationsCache = [];

    for (const d of snap.docs) {
      const conv = { id: d.id, ...d.data() };
      const otherId = conv.participants.find(p => p !== currentUser.uid);
      if (!otherId) continue;

      const otherSnap = await getDoc(doc(db, "users", otherId));
      const other = otherSnap.exists()
        ? otherSnap.data()
        : { displayName: "User", initials: "?" };

      if (filter && !other.displayName?.toLowerCase().includes(filter.toLowerCase())) continue;

      conversationsCache.push({ conv, other, otherId });
    }

    renderConversations();
  });
}

/* ─────────────────────────────
   RENDER CONVERSATIONS
───────────────────────────── */
function renderConversations() {
  if (conversationsCache.length === 0) {
    convList.innerHTML = `<div class="empty"><div>💬</div><p>No conversations yet</p></div>`;
    return;
  }

  conversationsCache.forEach(({ conv, other, otherId }) => {
    const unread = conv.unreadBy?.includes(currentUser.uid);
    const a = document.createElement("a");
    a.className = "conv-item" + (unread ? " unread" : "");
    a.href = `chat.html?uid=${otherId}`;
    a.innerHTML = `
      <div class="conv-avatar">${avatarHTML(other)}</div>
      <div class="conv-content">
        <div class="conv-name">${escapeHTML(other.displayName || "User")}</div>
        <div class="conv-preview">${escapeHTML(conv.lastMessage || "")}</div>
      </div>
      <div class="conv-right">
        <div class="conv-time">${formatTime(conv.lastMessageAt)}</div>
        ${unread ? `<div class="unread-dot"></div>` : ""}
      </div>`;
    convList.appendChild(a);
  });
}

/* ─────────────────────────────
   SEARCH CONVERSATIONS
───────────────────────────── */
if (searchInput) {
  searchInput.addEventListener("input", (e) => loadConversations(e.target.value));
}
if (convSearch) {
  convSearch.addEventListener("input", (e) => loadConversations(e.target.value));
}

/* ─────────────────────────────
   LOAD USERS (for modal)
───────────────────────────── */
async function loadUsers(filter = "") {
  const snap = await getDocs(collection(db, "users"));
  if (!modalList) return;
  modalList.innerHTML = "";

  const users = [];
  snap.forEach(d => {
    if (d.id === currentUser.uid) return;
    const u = d.data();
    if (filter && !u.displayName?.toLowerCase().includes(filter.toLowerCase())) return;
    users.push({ id: d.id, ...u });
  });

  if (users.length === 0) {
    modalList.innerHTML = `<div style="padding:20px;text-align:center;color:#64748b">No users found</div>`;
    return;
  }

  users.forEach(u => {
    const div = document.createElement("div");
    div.className = "modal-user";
    div.onclick = () => { location.href = `chat.html?uid=${u.id}`; };
    div.innerHTML = `
      <div class="modal-avatar">${avatarHTML(u)}</div>
      <div>
        <div class="modal-name">${escapeHTML(u.displayName || "User")}</div>
        <div class="modal-username">@${escapeHTML(u.username || "user")}</div>
      </div>`;
    modalList.appendChild(div);
  });
}

/* ─────────────────────────────
   MODAL
───────────────────────────── */
if (newMsgBtn)  newMsgBtn.onclick  = () => modal?.classList.add("open");
if (closeModal) closeModal.onclick = () => modal?.classList.remove("open");

window.onclick = (e) => {
  if (e.target === modal) modal?.classList.remove("open");
};

if (modalSearch) {
  modalSearch.addEventListener("input", (e) => loadUsers(e.target.value));
}
