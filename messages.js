import { auth, db } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
  collection, doc, getDoc, addDoc, setDoc,
  query, orderBy, onSnapshot, where,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// ─────────────────────────────
// GLOBAL STATE
// ─────────────────────────────
let currentUser = null;
let currentUserData = null;
let activeConvId = null;
let unsubChat = null;

// ─────────────────────────────
// DOM ELEMENTS
// ─────────────────────────────
const convList = document.getElementById("convList");
const chatPanel = document.getElementById("chatPanel");
const convSearch = document.getElementById("convSearch");

const notifBadge = document.getElementById("notifBadge");
const msgBadge = document.getElementById("msgBadge");

const newMsgBtn = document.getElementById("newMsgBtn");
const newMsgModal = document.getElementById("newMsgModal");
const modalClose = document.getElementById("modalClose");
const modalSearch = document.getElementById("modalSearch");
const modalUserList = document.getElementById("modalUserList");

// ─────────────────────────────
// AUTH
// ─────────────────────────────
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    location.href = "index.html";
    return;
  }

  currentUser = user;

  const snap = await getDoc(doc(db, "users", user.uid));
  if (snap.exists()) {
    currentUserData = snap.data();
    setNavAvatar();
  }

  loadConversations();
  watchBadges();

  const params = new URLSearchParams(location.search);
  const uid = params.get("uid");
  if (uid) openOrCreateConversation(uid);
});

// ─────────────────────────────
// NAV UI
// ─────────────────────────────
function setNavAvatar() {
  const el = document.getElementById("navAvatar");
  document.getElementById("navName").textContent =
    currentUserData.displayName || "You";

  if (currentUserData.photoURL) {
    el.innerHTML = `<img src="${currentUserData.photoURL}">`;
  } else {
    el.textContent = currentUserData.initials || "?";
  }
}

// ─────────────────────────────
// CONVERSATION ID
// ─────────────────────────────
function convId(uid1, uid2) {
  return [uid1, uid2].sort().join("_");
}

// ─────────────────────────────
// LOAD CONVERSATIONS
// ─────────────────────────────
function loadConversations(filter = "") {
  const q = query(
    collection(db, "conversations"),
    where("participants", "array-contains", currentUser.uid),
    orderBy("lastMessageAt", "desc")
  );

  onSnapshot(q, async (snap) => {
    convList.innerHTML = "";

    const list = [];
    snap.forEach(d => list.push({ id: d.id, ...d.data() }));

    for (const conv of list) {
      const otherId = conv.participants.find(p => p !== currentUser.uid);
      if (!otherId) continue;

      const otherSnap = await getDoc(doc(db, "users", otherId));
      const other = otherSnap.exists()
        ? otherSnap.data()
        : { displayName: "User", initials: "?" };

      if (
        filter &&
        !other.displayName?.toLowerCase().includes(filter.toLowerCase())
      ) continue;

      const el = document.createElement("div");
      el.className = "conv-item";
      el.onclick = () => openChat(conv.id, otherId, other);

      el.innerHTML = `
        <div>
          <div class="conv-name">${other.displayName || "User"}</div>
          <div class="conv-preview">${conv.lastMessage || ""}</div>
        </div>
      `;

      convList.appendChild(el);
    }
  });
}

// ─────────────────────────────
// OPEN CHAT
// ─────────────────────────────
async function openChat(cid, otherId, other) {
  if (unsubChat) unsubChat();

  activeConvId = cid;

  chatPanel.innerHTML = `
    <div class="chat-header">
      <div class="chat-header-name">${other.displayName || "User"}</div>
    </div>

    <div id="messagesArea" class="messages-area"></div>

    <div class="send-area">
      <input id="msgInput" type="text" placeholder="Message...">
      <button id="sendBtn">Send</button>
    </div>
  `;

  const messagesArea = document.getElementById("messagesArea");
  const msgInput = document.getElementById("msgInput");
  const sendBtn = document.getElementById("sendBtn");

  sendBtn.onclick = () => sendMessage(cid, otherId, msgInput);

  const q = query(
    collection(db, "messages"),
    where("convId", "==", cid),
    orderBy("createdAt", "asc")
  );

  unsubChat = onSnapshot(q, (snap) => {
    messagesArea.innerHTML = "";

    snap.forEach(d => {
      const m = d.data();

      const div = document.createElement("div");
      div.className =
        m.fromUid === currentUser.uid ? "msg-bubble msg-mine" : "msg-bubble msg-other";

      div.innerHTML = `
        ${m.text}
        <div class="msg-time"></div>
      `;

      messagesArea.appendChild(div);
    });

    messagesArea.scrollTop = messagesArea.scrollHeight;
  });
}

// ─────────────────────────────
// SEND MESSAGE
// ─────────────────────────────
async function sendMessage(cid, toUid, input) {
  const text = input.value.trim();
  if (!text) return;

  input.value = "";

  await addDoc(collection(db, "messages"), {
    convId: cid,
    fromUid: currentUser.uid,
    toUid,
    text,
    read: false,
    createdAt: serverTimestamp()
  });

  await setDoc(doc(db, "conversations", cid), {
    participants: [currentUser.uid, toUid],
    lastMessage: text,
    lastMessageAt: serverTimestamp(),
    unreadBy: [toUid]
  }, { merge: true });
}

// ─────────────────────────────
// OPEN OR CREATE CHAT
// ─────────────────────────────
async function openOrCreateConversation(otherId) {
  const cid = convId(currentUser.uid, otherId);

  const otherSnap = await getDoc(doc(db, "users", otherId));
  const other = otherSnap.exists()
    ? otherSnap.data()
    : { displayName: "User", initials: "?" };

  openChat(cid, otherId, other);
}

// ─────────────────────────────
// SEARCH CONVERSATIONS
// ─────────────────────────────
convSearch.addEventListener("input", (e) => {
  loadConversations(e.target.value);
});

// ─────────────────────────────
// BADGES (FIXED - replaces missing watchBadges)
// ─────────────────────────────
function watchBadges() {
  const q = query(
    collection(db, "conversations"),
    where("participants", "array-contains", currentUser.uid)
  );

  onSnapshot(q, (snap) => {
    let unread = 0;

    snap.forEach(d => {
      const data = d.data();
      if (data.unreadBy?.includes(currentUser.uid)) {
        unread++;
      }
    });

    if (msgBadge) {
      msgBadge.textContent = unread > 0 ? unread : "";
      msgBadge.classList.toggle("show", unread > 0);
    }
  });
}

// ─────────────────────────────
// MODAL (basic working)
// ─────────────────────────────
newMsgBtn.onclick = () => {
  newMsgModal.classList.add("open");
};

modalClose.onclick = () => {
  newMsgModal.classList.remove("open");
};
