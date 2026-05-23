import { auth, db } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  collection, doc, getDoc, updateDoc, writeBatch, query,
  orderBy, onSnapshot, where, addDoc, arrayUnion, arrayRemove, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

let currentUser = null;
let currentUserData = null;

const notifList  = document.getElementById("notifList");
const markAllBtn = document.getElementById("markAllBtn");
const notifBadge = document.getElementById("notifBadge");
const msgBadge   = document.getElementById("msgBadge");

onAuthStateChanged(auth, async (user) => {
  if (!user) { location.href="index.html"; return; }
  currentUser = user;
  const snap = await getDoc(doc(db,"users",user.uid));
  if (snap.exists()) {
    currentUserData = snap.data();
    setNavAvatar();
  }
  loadNotifications();
  watchBadges();
});

function setNavAvatar() {
  const el = document.getElementById("navAvatar");
  document.getElementById("navName").textContent = currentUserData.displayName||"You";
  if (currentUserData.photoURL) el.innerHTML=`<img src="${currentUserData.photoURL}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
  else el.textContent = currentUserData.initials||"?";
}

function loadNotifications() {
  const q = query(
    collection(db,"notifications"),
    where("toUid","==",currentUser.uid),
    orderBy("createdAt","desc")
  );

  onSnapshot(q, (snap) => {
    notifList.innerHTML = "";
    if (snap.empty) {
      notifList.innerHTML = `<div class="empty-state"><div>🔔</div>No notifications yet</div>`;
      return;
    }
    snap.forEach(d => renderNotif(d));
  });
}

function renderNotif(docSnap) {
  const n = docSnap.data();
  const id = docSnap.id;
  const time = n.createdAt ? timeAgo(n.createdAt.seconds*1000) : "";

  const iconMap = {
    like: "❤️",
    comment: "💬",
    connect_request: "🤝",
    connect_accepted: "✅",
    follow: "👤"
  };

  const textMap = {
    like:             `<b>${n.fromName}</b> liked your post`,
    comment:          `<b>${n.fromName}</b> commented on your post`,
    connect_request:  `<b>${n.fromName}</b> sent you a connection request`,
    connect_accepted: `<b>${n.fromName}</b> accepted your connection request`,
    follow:           `<b>${n.fromName}</b> started following you`
  };

  const el = document.createElement("div");
  el.className = `notif-item ${n.read ? "" : "unread"}`;
  el.innerHTML = `
    <div class="notif-avatar">
      ${n.fromPhoto ? `<img src="${n.fromPhoto}">` : (n.fromName?.slice(0,2)||"?")}
    </div>
    <div class="notif-body">
      <div class="notif-text">${textMap[n.type]||n.type}</div>
      ${n.postText ? `<div class="notif-subtext">"${n.postText}..."</div>` : ""}
      ${n.commentText ? `<div class="notif-subtext">Comment: "${n.commentText}"</div>` : ""}
      <div class="notif-time">${time}</div>
      ${n.type === "connect_request" ? `
        <div class="accept-row">
          <button class="accept-btn" data-id="${id}" data-from="${n.fromUid}">Accept</button>
          <button class="decline-btn" data-id="${id}" data-from="${n.fromUid}">Decline</button>
        </div>
      ` : ""}
    </div>
    <div class="notif-icon">${iconMap[n.type]||"🔔"}</div>
  `;

  // Mark read on click
  el.onclick = async (e) => {
    if (e.target.classList.contains("accept-btn")) {
      await acceptConnect(e.target.dataset.from, id);
    } else if (e.target.classList.contains("decline-btn")) {
      await declineConnect(e.target.dataset.from, id);
    } else {
      await markRead(id);
      if (n.fromUid) location.href=`profile.html?uid=${n.fromUid}`;
    }
  };

  notifList.appendChild(el);
}

async function markRead(id) {
  await updateDoc(doc(db,"notifications",id), { read:true });
}

markAllBtn.onclick = async () => {
  const q = query(
    collection(db,"notifications"),
    where("toUid","==",currentUser.uid),
    where("read","==",false)
  );
  const snap = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js")
    .then(m => m.getDocs(q));
  const batch = writeBatch(db);
  snap.forEach(d => batch.update(d.ref, { read:true }));
  await batch.commit();
};

async function acceptConnect(fromUid, notifId) {
  const myRef   = doc(db,"users",currentUser.uid);
  const fromRef = doc(db,"users",fromUid);
  await updateDoc(myRef, {
    pendingConnections: arrayRemove(fromUid),
    connections: arrayUnion(fromUid)
  });
  await updateDoc(fromRef, {
    sentConnections: arrayRemove(currentUser.uid),
    connections: arrayUnion(currentUser.uid)
  });
  await markRead(notifId);
  // notify sender
  await addDoc(collection(db,"notifications"), {
    toUid: fromUid,
    fromUid: currentUser.uid,
    fromName: currentUserData.displayName,
    fromUsername: currentUserData.username,
    fromPhoto: currentUserData.photoURL||"",
    type: "connect_accepted",
    read: false,
    createdAt: serverTimestamp()
  });
}

async function declineConnect(fromUid, notifId) {
  const myRef   = doc(db,"users",currentUser.uid);
  const fromRef = doc(db,"users",fromUid);
  await updateDoc(myRef,   { pendingConnections: arrayRemove(fromUid) });
  await updateDoc(fromRef, { sentConnections: arrayRemove(currentUser.uid) });
  await markRead(notifId);
}

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
