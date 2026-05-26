import { auth, db } from "./firebase.js";
import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  collection, doc, getDoc, getDocs,
  query, where, orderBy, onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

/* STATE */
let currentUser   = null;
let conversations = [];   // raw resolved list
let allUsers      = [];   // for new-message modal
let unsubConvs    = null; // single listener reference

/* DOM */
const convList   = document.getElementById("convList");
const searchInput= document.getElementById("searchInput");
const modal      = document.getElementById("modal");
const newMsgBtn  = document.getElementById("newMsgBtn");
const closeModal = document.getElementById("closeModal");
const modalSearch= document.getElementById("modalSearch");
const modalList  = document.getElementById("modalList");

/* AUTH */
onAuthStateChanged(auth, async (user) => {
  if (!user) { location.href = "index.html"; return; }
  currentUser = user;
  subscribeConversations();
  loadUsers();
});

/* HELPERS */
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

/* SUBSCRIBE CONVERSATIONS — single listener, never re-created */
function subscribeConversations() {
  if (unsubConvs) unsubConvs(); // clean up any existing listener

  const q = query(
    collection(db, "conversations"),
    where("participants", "array-contains", currentUser.uid),
    orderBy("lastMessageAt", "desc")
  );

  unsubConvs = onSnapshot(q, async (snap) => {
    conversations = [];

    for (const d of snap.docs) {
      const conv    = { id: d.id, ...d.data() };
      const otherId = conv.participants.find(p => p !== currentUser.uid);
      if (!otherId) continue;

      const otherSnap = await getDoc(doc(db, "users", otherId));
      const other     = otherSnap.exists()
        ? otherSnap.data()
        : { displayName: "User", initials: "?" };

      conversations.push({ conv, other, otherId });
    }

    renderConversations(searchInput.value.trim());
  });
}

/* RENDER CONVERSATIONS — filter locally, no new Firestore calls */
function renderConversations(filter = "") {
  convList.innerHTML = "";

  const filtered = filter
    ? conversations.filter(({ other }) =>
        other.displayName?.toLowerCase().includes(filter.toLowerCase())
      )
    : conversations;

  if (!filtered.length) {
    convList.innerHTML = `
      <div class="empty">
        <div>💬</div>
        <p>${filter ? "No conversations match" : "No conversations yet"}</p>
      </div>`;
    return;
  }

  filtered.forEach(({ conv, other, otherId }) => {
    const unread = conv.unreadBy?.includes(currentUser.uid);
    const a      = document.createElement("a");
    a.className  = "conv-item";
    a.href       = `chat.html?uid=${otherId}`;
    a.innerHTML  = `
      <div class="conv-avatar">
        ${other.photoURL ? `<img src="${other.photoURL}">` : (other.initials || "?")}
      </div>
      <div class="conv-content">
        <div class="conv-name">${other.displayName || "User"}</div>
        <div class="conv-preview">${escapeHTML(conv.lastMessage || "")}</div>
      </div>
      <div class="conv-right">
        <div class="conv-time">${formatTime(conv.lastMessageAt)}</div>
        ${unread ? `<div class="unread-dot"></div>` : ""}
      </div>`;
    convList.appendChild(a);
  });
}

/* SEARCH — purely local, no Firestore */
searchInput.addEventListener("input", (e) => {
  renderConversations(e.target.value.trim());
});

/* LOAD USERS FOR MODAL */
async function loadUsers(filter = "") {
  const snap = await getDocs(collection(db, "users"));
  allUsers   = [];
  snap.forEach(d => {
    if (d.id === currentUser.uid) return;
    allUsers.push({ id: d.id, ...d.data() });
  });
  renderUsers(filter);
}

/* RENDER USERS — filter locally */
function renderUsers(filter = "") {
  modalList.innerHTML = "";

  const filtered = filter
    ? allUsers.filter(u =>
        u.displayName?.toLowerCase().includes(filter.toLowerCase()) ||
        u.username?.toLowerCase().includes(filter.toLowerCase())
      )
    : allUsers;

  if (!filtered.length) {
    modalList.innerHTML = `
      <div style="padding:20px;text-align:center;color:#64748b">
        No users found
      </div>`;
    return;
  }

  filtered.forEach(u => {
    const div      = document.createElement("div");
    div.className  = "modal-user";
    div.onclick    = () => { location.href = `chat.html?uid=${u.id}`; };
    div.innerHTML  = `
      <div class="modal-avatar">
        ${u.photoURL ? `<img src="${u.photoURL}">` : (u.initials || "?")}
      </div>
      <div>
        <div class="modal-name">${u.displayName || "User"}</div>
        <div class="modal-username">@${u.username || "user"}</div>
      </div>`;
    modalList.appendChild(div);
  });
}

/* MODAL SEARCH — local filter only */
modalSearch.addEventListener("input", (e) => {
  renderUsers(e.target.value.trim());
});

/* MODAL OPEN / CLOSE */
newMsgBtn.onclick  = () => modal.classList.add("open");
closeModal.onclick = () => modal.classList.remove("open");
window.onclick     = (e) => { if (e.target === modal) modal.classList.remove("open"); };

/* CLEANUP on page leave */
window.addEventListener("beforeunload", () => {
  if (unsubConvs) unsubConvs();
});
