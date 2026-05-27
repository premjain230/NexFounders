import { auth, db } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  collection,
  doc,
  getDoc,
  addDoc,
  setDoc,
  updateDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  arrayRemove
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

let currentUser = null;
let otherUser = null;
let activeConvId = null;
let unsubMessages = null;

/* DOM */
const chatAvatar = document.getElementById("chatAvatar");
const chatName = document.getElementById("chatName");
const chatUsername = document.getElementById("chatUsername");
const messagesArea = document.getElementById("messagesArea");
const msgInput = document.getElementById("msgInput");
const sendBtn = document.getElementById("sendBtn");

const params = new URLSearchParams(location.search);
const otherUid = params.get("uid");

/* AUTH */
onAuthStateChanged(auth, async (user) => {
  if (!user) return location.href = "index.html";
  if (!otherUid) return location.href = "messages.html";

  currentUser = user;

  await loadOtherUser();

  activeConvId = [user.uid, otherUid].sort().join("_");

  openChat();
});

/* LOAD USER */
async function loadOtherUser() {
  const snap = await getDoc(doc(db, "users", otherUid));
  if (!snap.exists()) return location.href = "messages.html";

  otherUser = snap.data();

  chatName.textContent = otherUser.displayName || "User";
  chatUsername.textContent = "@" + (otherUser.username || "user");

  chatAvatar.innerHTML = otherUser.photoURL
    ? `<img src="${otherUser.photoURL}">`
    : (otherUser.initials || "?");
}

/* CHAT STREAM */
function openChat() {
  if (unsubMessages) unsubMessages();

  const q = query(
    collection(db, "messages"),
    where("convId", "==", activeConvId)
  );

  unsubMessages = onSnapshot(q, (snap) => {
    messagesArea.innerHTML = "";

    if (snap.empty) {
      messagesArea.innerHTML = `
        <div class="empty">
          <div>👋</div>
          <p>Start chatting with ${otherUser.displayName}</p>
        </div>`;
      return;
    }

    const msgs = [];
    snap.forEach(d => msgs.push(d.data()));

    // IMPORTANT: sort safely (fix crash)
    msgs.sort((a, b) =>
      (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0)
    );

    msgs.forEach(m => {
      const wrap = document.createElement("div");
      wrap.className =
        m.fromUid === currentUser.uid
          ? "msg-wrap msg-mine"
          : "msg-wrap msg-other";

      wrap.innerHTML = `
        <div class="msg-bubble">${escape(m.text)}</div>
      `;
      messagesArea.appendChild(wrap);
    });

    messagesArea.scrollTop = messagesArea.scrollHeight;
  });
}

/* SEND MESSAGE */
async function sendMessage() {
  const text = msgInput.value.trim();
  if (!text) return;

  msgInput.value = "";

  const msgRef = collection(db, "messages");

  await addDoc(msgRef, {
    convId: activeConvId,
    fromUid: currentUser.uid,
    toUid: otherUid,
    text,
    createdAt: serverTimestamp()
  });

  await setDoc(doc(db, "conversations", activeConvId), {
    participants: [currentUser.uid, otherUid],
    lastMessage: text,
    lastMessageAt: serverTimestamp(),
    unreadBy: [otherUid]
  }, { merge: true });
}

/* helpers */
function escape(str = "") {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

sendBtn.onclick = sendMessage;
msgInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") sendMessage();
});