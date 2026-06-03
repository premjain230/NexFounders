/**
 * chat.js — NexFounder 1:1 Chat
 *
 * Upgrades vs original:
 *  • XSS: message text via textContent; avatar via safeUrl()
 *  • Listener cleanup via trackUnsub()
 *  • safeUrl() on all image sources
 *  • Input: maxlength + Enter sends (unchanged), but disabled during send to prevent double-send
 */

import { auth, db } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  collection, doc, getDoc, addDoc, setDoc, updateDoc,
  query, where, orderBy, onSnapshot, serverTimestamp, arrayRemove
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { esc, safeUrl, formatTime, trackUnsub } from "./utils.js";

let currentUser   = null;
let otherUser     = null;
let activeConvId  = null;

const chatAvatar   = document.getElementById("chatAvatar");
const chatName     = document.getElementById("chatName");
const chatUsername = document.getElementById("chatUsername");
const messagesArea = document.getElementById("messagesArea");
const msgInput     = document.getElementById("msgInput");
const sendBtn      = document.getElementById("sendBtn");

const params   = new URLSearchParams(location.search);
const otherUid = params.get("uid");

// ── AUTH ──────────────────────────────────────────────────────────────────────
onAuthStateChanged(auth, async (user) => {
  if (!user)   { location.href = "index.html";  return; }
  if (!otherUid) { location.href = "messages.html"; return; }
  currentUser = user;

  await loadOtherUser();
  activeConvId = convId(currentUser.uid, otherUid);
  openChat();
});

// ── HELPERS ───────────────────────────────────────────────────────────────────
function convId(uid1, uid2) { return [uid1, uid2].sort().join("_"); }

// ── LOAD OTHER USER ───────────────────────────────────────────────────────────
async function loadOtherUser() {
  const snap = await getDoc(doc(db, "users", otherUid));
  if (!snap.exists()) { location.href = "messages.html"; return; }
  otherUser = snap.data();

  // Use textContent for safe name/username rendering
  chatName.textContent     = otherUser.displayName || "User";
  chatUsername.textContent = `@${otherUser.username || "user"}`;

  const url = safeUrl(otherUser.photoURL);
  if (url) {
    const img = document.createElement("img");
    img.src = url;
    img.alt = esc(otherUser.displayName || "");
    img.style.cssText = "width:100%;height:100%;object-fit:cover;border-radius:50%;";
    chatAvatar.replaceChildren(img);
  } else {
    chatAvatar.textContent = otherUser.initials || "?";
  }
}

// ── OPEN CHAT ─────────────────────────────────────────────────────────────────
function openChat() {
  // Mark messages as read by removing current user from unreadBy
  updateDoc(doc(db, "conversations", activeConvId), {
    unreadBy: arrayRemove(currentUser.uid)
  }).catch(() => {}); // conv may not exist yet

  const q = query(
    collection(db, "messages"),
    where("convId", "==", activeConvId),
    orderBy("createdAt", "asc")
  );

  trackUnsub(onSnapshot(q, (snap) => {
    messagesArea.innerHTML = "";

    if (snap.empty) {
      const empty = document.createElement("div");
      empty.className = "empty";
      empty.innerHTML = `<div>👋</div>`;
      const p = document.createElement("p");
      p.textContent = `Start a conversation with ${otherUser?.displayName || "User"}`;
      empty.appendChild(p);
      messagesArea.appendChild(empty);
      return;
    }

    snap.forEach(d => {
      const m    = d.data();
      const wrap = document.createElement("div");
      wrap.className = m.fromUid === currentUser.uid ? "msg-wrap msg-mine" : "msg-wrap msg-other";

      const bubble = document.createElement("div");
      bubble.className  = "msg-bubble";
      bubble.textContent= m.text || ""; // textContent = XSS safe

      const time = document.createElement("div");
      time.className  = "msg-time";
      time.textContent= formatTime(m.createdAt);

      wrap.appendChild(bubble);
      wrap.appendChild(time);
      messagesArea.appendChild(wrap);
    });

    messagesArea.scrollTop = messagesArea.scrollHeight;
  }));
}

// ── SEND MESSAGE ──────────────────────────────────────────────────────────────
async function sendMessage() {
  const text = msgInput.value.trim();
  if (!text) return;

  // Disable input during send to prevent duplicate messages
  sendBtn.disabled  = true;
  msgInput.disabled = true;
  msgInput.value    = "";

  try {
    await addDoc(collection(db, "messages"), {
      convId:   activeConvId,
      fromUid:  currentUser.uid,
      toUid:    otherUid,
      text,
      read:     false,
      createdAt: serverTimestamp()
    });

    await setDoc(
      doc(db, "conversations", activeConvId),
      {
        participants:  [currentUser.uid, otherUid],
        lastMessage:   text.slice(0, 100), // cap preview length
        lastMessageAt: serverTimestamp(),
        unreadBy:      [otherUid]
      },
      { merge: true }
    );
  } catch (err) {
    console.error(err);
    msgInput.value = text; // restore on failure
  }

  sendBtn.disabled  = false;
  msgInput.disabled = false;
  msgInput.focus();
}

sendBtn.onclick = sendMessage;
msgInput.addEventListener("keydown", e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } });
