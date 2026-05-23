import { auth, db } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  collection, doc, getDoc, getDocs, addDoc, updateDoc,
  query, orderBy, onSnapshot, where, setDoc, serverTimestamp,
  limit, writeBatch
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

let currentUser = null;
let currentUserData = null;
let activeConvId = null;
let unsubChat = null;
let allUsersCache = [];

const convList    = document.getElementById("convList");
const chatPanel   = document.getElementById("chatPanel");
const newMsgBtn   = document.getElementById("newMsgBtn");
const newMsgModal = document.getElementById("newMsgModal");
const modalClose  = document.getElementById("modalClose");
const modalSearch = document.getElementById("modalSearch");
const modalUserList = document.getElementById("modalUserList");
const convSearch  = document.getElementById("convSearch");
const notifBadge  = document.getElementById("notifBadge");
const msgBadge    = document.getElementById("msgBadge");

onAuthStateChanged(auth, async (user) => {
  if (!user) { location.href="index.html"; return; }
  currentUser = user;
  const snap = await getDoc(doc(db,"users",user.uid));
  if (snap.exists()) {
    currentUserData = snap.data();
    setNavAvatar();
  }
  loadConversations();
  watchBadges();
  // Check if URL has ?uid= to auto-open chat
  const params = new URLSearchParams(location.search);
  const uid = params.get("uid");
  if (uid) openOrCreateConversation(uid);
});

function setNavAvatar() {
  const el = document.getElementById("navAvatar");
  document.getElementById("navName").textContent = currentUserData.displayName||"You";
  if (currentUserData.photoURL) el.innerHTML=`<img src="${currentUserData.photoURL}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
  else el.textContent = currentUserData.initials||"?";
}

// ── CONVERSATION ID ──────────────────────────────────
function convId(uid1, uid2) {
  return [uid1, uid2].sort().join("_");
}

// ── LOAD CONVERSATIONS ───────────────────────────────
function loadConversations(filter="") {
  const q = query(
    collection(db,"conversations"),
    where("participants","array-contains",currentUser.uid),
    orderBy("lastMessageAt","desc")
  );
  onSnapshot(q, async (snap) => {
    convList.innerHTML = "";
    if (snap.empty) {
      convList.innerHTML = `<div style="padding:30px;text-align:center;color:#64748b">No conversations yet.<br>Start one with ✏️</div>`;
      return;
    }
    const filtered = [];
    snap.forEach(d => filtered.push({ id:d.id, ...d.data() }));

    for (const conv of filtered) {
      const otherId = conv.participants.find(p => p !== currentUser.uid);
      if (!otherId) continue;
      const otherSnap = await getDoc(doc(db,"users",otherId));
      const other = otherSnap.exists() ? otherSnap.data() : { displayName:"User", initials:"?" };

      if (filter && !other.displayName?.toLowerCase().includes(filter.toLowerCase())) continue;

      const unread = (conv.unreadBy || []).includes(currentUser.uid);
      const el = document.createElement("div");
      el.className = `conv-item ${activeConvId===conv.id?"active":""} ${unread?"unread":""}`;
      el.dataset.id = conv.id;
      el.dataset.uid = otherId;
      el.innerHTML = `
        <div class="conv-avatar">
          ${other.photoURL ? `<img src="${other.photoURL}">` : (other.initials||"?")}
        </div>
        <div style="flex:1;overflow:hidden">
          <div class="conv-name">${other.displayName||"User"}</div>
          <div class="conv-preview">${conv.lastMessage||""}</div>
        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px">
          <div class="conv-time">${conv.lastMessageAt ? timeAgo(conv.lastMessageAt.seconds*1000) : ""}</div>
          ${unread ? `<div class="unread-dot"></div>` : ""}
        </div>
      `;
      el.onclick = () => openChat(conv.id, otherId, other);
      convList.appendChild(el);
    }
  });
}

// ── OPEN CHAT ────────────────────────────────────────
async function openChat(cid, otherId, other) {
  if (unsubChat) unsubChat();
  activeConvId = cid;

  // mark as read
  await updateDoc(doc(db,"conversations",cid), {
    unreadBy: (await getDoc(doc(db,"conversations",cid))).data()?.unreadBy?.filter(u => u !== currentUser.uid) || []
  });
  // mark individual messages read
  const unreadMsgs = query(
    collection(db,"messages"),
    where("convId","==",cid),
    where("toUid","==",currentUser.uid),
    where("read","==",false)
  );
  const uSnap = await getDocs(unreadMsgs);
  const batch = writeBatch(db);
  uSnap.forEach(d => batch.update(d.ref, { read:true }));
  await batch.commit();

  // highlight active
  document.querySelectorAll(".conv-item").forEach(el => {
    el.classList.toggle("active", el.dataset.id === cid);
  });

  chatPanel.innerHTML = `
    <div class="chat-header">
      <div class="chat-header-avatar">
        ${other.photoURL ? `<img src="${other.photoURL}">` : (other.initials||"?")}
      </div>
      <div>
        <div class="chat-header-name">${other.displayName||"User"}</div>
        <div class="chat-header-sub">@${other.username||""}</div>
      </div>
      <a href="profile.html?uid=${otherId}" class="view-profile-link">View Profile →</a>
    </div>
    <div class="messages-area" id="messagesArea"></div>
    <div class="send-area">
      <input type="text" id="msgInput" placeholder="Type a message...">
      <button id="sendBtn">Send</button>
    </div>
  `;

  const messagesArea = document.getElementById("messagesArea");
  const msgInput = document.getElementById("msgInput");
  const sendBtn  = document.getElementById("sendBtn");

  sendBtn.onclick = () => sendMessage(cid, otherId, msgInput);
  msgInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(cid, otherId, msgInput); }
  });

  const q = query(
    collection(db,"messages"),
    where("convId","==",cid),
    orderBy("createdAt","asc")
  );
  unsubChat = onSnapshot(q, (snap) => {
    messagesArea.innerHTML = "";
    snap.forEach(d => {
      const m = d.data();
      const isMine = m.fromUid === currentUser.uid;
      const div = document.createElement("div");
      div.innerHTML = `
        <div class="msg-bubble ${isMine ? "msg-mine" : "msg-other"}">
          ${m.text}
          <div class="msg-time">${m.createdAt ? timeAgo(m.createdAt.seconds*1000) : "sending..."}</div>
        </div>
      `;
      messagesArea.appendChild(div);
    });
    messagesArea.scrollTop = messagesArea.scrollHeight;
  });
}

// ── SEND MESSAGE ─────────────────────────────────────
async function sendMessage(cid, toUid, input) {
  const text = input.value.trim();
  if (!text) return;
  input.value = "";

  const convRef = doc(db,"conversations",cid);
  const convSnap = await getDoc(convRef);

  if (!convSnap.exists()) {
    await setDoc(convRef, {
      participants: [currentUser.uid, toUid],
      lastMessage: text,
      lastMessageAt: serverTimestamp(),
      unreadBy: [toUid]
    });
  } else {
    await updateDoc(convRef, {
      lastMessage: text,
      lastMessageAt: serverTimestamp(),
      unreadBy: [toUid]
    });
  }

  await addDoc(collection(db,"messages"), {
    convId: cid,
    fromUid: currentUser.uid,
    toUid,
    text,
    read: false,
    createdAt: serverTimestamp()
  });
}

// ── OPEN/CREATE CONVERSATION ─────────────────────────
async function openOrCreateConversation(otherId) {
  const cid = convId(currentUser.uid, otherId);
  const otherSnap = await getDoc(doc(db,"users",otherId));
  const other = otherSnap.exists() ? otherSnap.data() : { displayName:"User", initials:"?", username:"" };
  openChat(cid, otherId, other);
}

// ── NEW MESSAGE MODAL ────────────────────────────────
newMsgBtn.onclick = async () => {
  newMsgModal.classList.add("open");
  modalSearch.value = "";
  if (!allUsersCache.length) {
    const snap = await getDocs(collection(db,"users"));
    snap.forEach(d => { if (d.id !== currentUser.uid) allUsersCache.push({ id:d.id, ...d.data() }); });
  }
  renderModalUsers(allUsersCache);
};
modalClose.onclick = () => newMsgModal.classList.remove("open");
newMsgModal.onclick = (e) => { if (e.target === newMsgModal) newMsgModal.classList.remove("open"); };

modalSearch.addEventListener("input", () => {
  const q = modalSearch.value.toLowerCase();
  renderModalUsers(allUsersCache.filter(u =>
    u.displayName?.toLowerCase().includes(q) || u.username?.toLowerCase().includes(q)
  ));
});

function renderModalUsers(users) {
  modalUserList.innerHTML = "";
  users.forEach(u => {
    const el = document.createElement("div");
    el.className = "modal-user";
    el.innerHTML = `
      <div class="modal-avatar">
        ${u.photoURL ? `<img src="${u.photoURL}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">` : (u.initials||"?")}
      </div>
      <div>
        <div style="font-weight:600">${u.displayName||"User"}</div>
        <div style="color:#64748b;font-size:13px">@${u.username||""}</div>
      </div>
    `;
    el.onclick = () => {
      newMsgModal.classList.remove("open");
      openOrCreateConversation(u.id);
    };
    modalUserList.appendChild(el);
  });
}

// ── CONV SEARCH ──────────────────────────────────────
convSearch.addEventListener("input", () => loadConversations(convSearch.value.trim()));

// ── BADGES ───────────────────────────────────────────
function watchBadges() {
  onSnapshot(
    query(collection(db,"notifications"), where("toUid","==",currentUser.uid), where("read","==",false)),
    (snap) => {
      notifBadge.textContent = snap.size>9?"9+":snap.size;
      notifBadge.classList.toggle("show", snap.size>0);
    }
  );
  onSnapshot(
    query(collection(db,"messages"), where("toUid","==",currentUser.uid), where("read","==",false)),
    (snap) => {
      msgBadge.textContent = snap.size>9?"9+":snap.size;
      msgBadge.classList.toggle("show", snap.size>0);
    }
  );
}

function timeAgo(ms) {
  const diff = Date.now() - ms;
  const m = Math.floor(diff/60000);
  if (m < 1)  return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m/60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h/24)}d ago`;
}
