import { auth, db } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
  collection, doc, getDoc, getDocs, addDoc, updateDoc,
  query, orderBy, onSnapshot, where, setDoc,
  serverTimestamp, writeBatch
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

let currentUser = null;
let currentUserData = null;
let activeConvId = null;
let unsubChat = null;
let allUsersCache = [];

// ─────────────────────────────────────────────
// AUTH SAFE WRAPPER (IMPORTANT FIX)
// ─────────────────────────────────────────────
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

function setNavAvatar() {
  const el = document.getElementById("navAvatar");
  document.getElementById("navName").textContent =
    currentUserData.displayName || "You";

  if (currentUserData.photoURL) {
    el.innerHTML = `<img src="${currentUserData.photoURL}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
  } else {
    el.textContent = currentUserData.initials || "?";
  }
}

// ─────────────────────────────────────────────
// CONVERSATION ID
// ─────────────────────────────────────────────
function convId(uid1, uid2) {
  return [uid1, uid2].sort().join("_");
}

// ─────────────────────────────────────────────
// LOAD CONVERSATIONS (SAFE)
// ─────────────────────────────────────────────
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

      if (filter &&
        !other.displayName?.toLowerCase().includes(filter.toLowerCase())
      ) continue;

      const el = document.createElement("div");
      el.className = "conv-item";
      el.onclick = () => openChat(conv.id, otherId, other);

      el.innerHTML = `
        <div>${other.displayName || "User"}</div>
        <div>${conv.lastMessage || ""}</div>
      `;

      convList.appendChild(el);
    }
  });
}

// ─────────────────────────────────────────────
// OPEN CHAT (FIXED SNAPSHOT SAFETY)
// ─────────────────────────────────────────────
async function openChat(cid, otherId, other) {
  if (unsubChat) unsubChat();

  activeConvId = cid;

  chatPanel.innerHTML = `
    <div class="chat-header">
      <div>${other.displayName || "User"}</div>
    </div>
    <div id="messagesArea"></div>
    <div>
      <input id="msgInput" type="text">
      <button id="sendBtn">Send</button>
    </div>
  `;

  const messagesArea = document.getElementById("messagesArea");
  const msgInput = document.getElementById("msgInput");
  const sendBtn = document.getElementById("sendBtn");

  sendBtn.onclick = () => sendMessage(cid, otherId, msgInput);

  // ✅ SAFE LISTENER (FIXED)
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

      div.textContent = m.text;
      messagesArea.appendChild(div);
    });

    messagesArea.scrollTop = messagesArea.scrollHeight;
  });
}

// ─────────────────────────────────────────────
// SEND MESSAGE (SAFE)
// ─────────────────────────────────────────────
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

  const convRef = doc(db, "conversations", cid);

  await setDoc(convRef, {
    participants: [currentUser.uid, toUid],
    lastMessage: text,
    lastMessageAt: serverTimestamp(),
    unreadBy: [toUid]
  }, { merge: true });
}

// ─────────────────────────────────────────────
// OPEN OR CREATE CHAT
// ─────────────────────────────────────────────
async function openOrCreateConversation(otherId) {
  const cid = convId(currentUser.uid, otherId);

  const otherSnap = await getDoc(doc(db, "users", otherId));
  const other = otherSnap.exists()
    ? otherSnap.data()
    : { displayName: "User", initials: "?" };

  openChat(cid, otherId, other);
}
