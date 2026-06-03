/**
 * messages.js — NexFounder Conversations List
 *
 * Upgrades vs original:
 *  • XSS: escapeHTML on all user content; avatarHTML uses safe URL
 *  • Performance: user lookups cached via getCachedUser/cacheUser —
 *    avoids a getDoc per conversation on every snapshot fire
 *  • Listener: single tracked onSnapshot; cleaned up on pagehide
 *  • Low data: badges use conversations.unreadBy instead of messages collection
 */

import { auth, db } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  collection, doc, getDoc, getDocs,
  query, orderBy, onSnapshot, where
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { esc, safeUrl, debounce, formatTime, trackUnsub, cacheUser, getCachedUser } from "./utils.js";

let currentUser     = null;
let currentUserData = null;
let conversationsCache = [];

const convList   = document.getElementById("convList");
const convSearch = document.getElementById("convSearch");
const searchInput= document.getElementById("searchInput");
const msgBadge   = document.getElementById("msgBadge");
const modal      = document.getElementById("modal");
const newMsgBtn  = document.getElementById("newMsgBtn");
const closeModal = document.getElementById("closeModal");
const modalSearch= document.getElementById("modalSearch");
const modalList  = document.getElementById("modalList");

// ── AUTH ──────────────────────────────────────────────────────────────────────
onAuthStateChanged(auth, async (user) => {
  if (!user) { location.href = "index.html"; return; }
  currentUser = user;

  const snap = await getDoc(doc(db, "users", user.uid));
  if (snap.exists()) currentUserData = snap.data();

  loadConversations();
  loadUsers();
  watchMsgBadge();
});

// ── LOAD CONVERSATIONS ────────────────────────────────────────────────────────
function loadConversations(filter = "") {
  const q = query(
    collection(db, "conversations"),
    where("participants", "array-contains", currentUser.uid),
    orderBy("lastMessageAt", "desc")
  );

  trackUnsub(onSnapshot(q, async (snap) => {
    conversationsCache = [];

    // Resolve other-user data, using cache to avoid repeated getDoc calls
    const resolvePromises = snap.docs.map(async d => {
      const conv    = { id: d.id, ...d.data() };
      const otherId = conv.participants.find(p => p !== currentUser.uid);
      if (!otherId) return null;

      let other = getCachedUser(otherId);
      if (!other) {
        const otherSnap = await getDoc(doc(db, "users", otherId));
        other = otherSnap.exists() ? otherSnap.data() : { displayName: "User", initials: "?" };
        cacheUser(otherId, other);
      }
      return { conv, other, otherId };
    });

    const results = (await Promise.all(resolvePromises)).filter(Boolean);
    conversationsCache = results;
    renderConversations(filter);
  }));
}

// ── RENDER CONVERSATIONS ──────────────────────────────────────────────────────
function renderConversations(filter = "") {
  convList.innerHTML = "";

  const filtered = filter
    ? conversationsCache.filter(({ other }) =>
        other.displayName?.toLowerCase().includes(filter.toLowerCase()))
    : conversationsCache;

  if (!filtered.length) {
    convList.innerHTML = `<div class="empty"><div>💬</div><p>No conversations yet</p></div>`;
    return;
  }

  filtered.forEach(({ conv, other, otherId }) => {
    const unread = conv.unreadBy?.includes(currentUser.uid);

    const a = document.createElement("a");
    a.className = "conv-item" + (unread ? " unread" : "");
    a.href      = `chat.html?uid=${encodeURIComponent(otherId)}`;

    // Avatar — safe DOM build
    const avDiv = document.createElement("div");
    avDiv.className = "conv-avatar";
    const url = safeUrl(other.photoURL);
    if (url) {
      const img = document.createElement("img");
      img.src = url; img.alt = esc(other.displayName || "");
      img.style.cssText = "width:100%;height:100%;object-fit:cover;border-radius:50%;";
      img.loading = "lazy";
      avDiv.appendChild(img);
    } else {
      avDiv.textContent = other.initials || "?";
    }

    // Content
    const contentDiv = document.createElement("div");
    contentDiv.className = "conv-content";
    const nameEl = document.createElement("div");
    nameEl.className  = "conv-name";
    nameEl.textContent= other.displayName || "User";
    const previewEl = document.createElement("div");
    previewEl.className  = "conv-preview";
    previewEl.textContent= conv.lastMessage || "";
    contentDiv.appendChild(nameEl);
    contentDiv.appendChild(previewEl);

    // Right (time + unread dot)
    const rightDiv = document.createElement("div");
    rightDiv.className = "conv-right";
    const timeEl = document.createElement("div");
    timeEl.className  = "conv-time";
    timeEl.textContent= formatTime(conv.lastMessageAt);
    rightDiv.appendChild(timeEl);
    if (unread) {
      const dot = document.createElement("div");
      dot.className = "unread-dot";
      rightDiv.appendChild(dot);
    }

    a.appendChild(avDiv);
    a.appendChild(contentDiv);
    a.appendChild(rightDiv);
    convList.appendChild(a);
  });
}

// ── SEARCH ────────────────────────────────────────────────────────────────────
const handleSearch = debounce((val) => renderConversations(val), 200);
searchInput?.addEventListener("input",  e => handleSearch(e.target.value));
convSearch?.addEventListener("input",   e => handleSearch(e.target.value));

// ── LOAD USERS FOR MODAL (one-time) ───────────────────────────────────────────
let allUsersCache = null;

async function loadUsers(filter = "") {
  if (!modalList) return;

  if (!allUsersCache) {
    const snap = await getDocs(collection(db, "users"));
    allUsersCache = [];
    snap.forEach(d => {
      if (d.id !== currentUser.uid) allUsersCache.push({ id: d.id, ...d.data() });
    });
  }

  const filtered = filter
    ? allUsersCache.filter(u => u.displayName?.toLowerCase().includes(filter.toLowerCase()))
    : allUsersCache;

  modalList.innerHTML = "";

  if (!filtered.length) {
    const empty = document.createElement("div");
    empty.style.cssText = "padding:20px;text-align:center;color:#64748b";
    empty.textContent   = "No users found";
    modalList.appendChild(empty);
    return;
  }

  filtered.forEach(u => {
    const div = document.createElement("div");
    div.className = "modal-user";
    div.onclick   = () => { location.href = `chat.html?uid=${encodeURIComponent(u.id)}`; };

    const avDiv = document.createElement("div");
    avDiv.className = "modal-avatar";
    const url = safeUrl(u.photoURL);
    if (url) {
      const img = document.createElement("img");
      img.src = url; img.alt = esc(u.displayName || "");
      img.style.cssText = "width:100%;height:100%;object-fit:cover;border-radius:50%;";
      avDiv.appendChild(img);
    } else {
      avDiv.textContent = u.initials || "?";
    }

    const info = document.createElement("div");
    const nameEl  = document.createElement("div");
    nameEl.className  = "modal-name";
    nameEl.textContent= u.displayName || "User";
    const unameEl = document.createElement("div");
    unameEl.className  = "modal-username";
    unameEl.textContent= `@${u.username || "user"}`;
    info.appendChild(nameEl);
    info.appendChild(unameEl);

    div.appendChild(avDiv);
    div.appendChild(info);
    modalList.appendChild(div);
  });
}

// ── MODAL ─────────────────────────────────────────────────────────────────────
newMsgBtn?.addEventListener("click",  () => modal?.classList.add("open"));
closeModal?.addEventListener("click", () => modal?.classList.remove("open"));
window.addEventListener("click", e => { if (e.target === modal) modal?.classList.remove("open"); });
modalSearch?.addEventListener("input", debounce(e => loadUsers(e.target.value), 200));

// ── MSG BADGE ─────────────────────────────────────────────────────────────────
function watchMsgBadge() {
  if (!msgBadge) return;
  trackUnsub(onSnapshot(
    query(collection(db, "conversations"), where("participants", "array-contains", currentUser.uid), where("unreadBy", "array-contains", currentUser.uid)),
    snap => {
      msgBadge.textContent = snap.size > 9 ? "9+" : snap.size;
      msgBadge.classList.toggle("show", snap.size > 0);
    }
  ));
}
