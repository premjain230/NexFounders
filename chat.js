import { auth, db } from "./firebase.js";

import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

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

/* STATE */
let currentUser = null;
let otherUser = null;
let activeConvId = null;
let unsubMessages = null;

/* DOM */
const chatAvatar =
  document.getElementById("chatAvatar");

const chatName =
  document.getElementById("chatName");

const chatUsername =
  document.getElementById("chatUsername");

const messagesArea =
  document.getElementById("messagesArea");

const msgInput =
  document.getElementById("msgInput");

const sendBtn =
  document.getElementById("sendBtn");

/* URL PARAM */
const params =
  new URLSearchParams(location.search);

const otherUid =
  params.get("uid");

/* AUTH */
onAuthStateChanged(auth, async(user)=>{

  if(!user){

    location.href = "index.html";
    return;

  }

  currentUser = user;

  if(!otherUid){

    location.href = "messages.html";
    return;

  }

  await loadOtherUser();

  activeConvId =
    convId(currentUser.uid, otherUid);

  openChat();

});

/* HELPERS */
function convId(uid1, uid2){

  return [uid1,uid2]
    .sort()
    .join("_");

}

function escapeHTML(str){

  if(!str) return "";

  return str
    .replace(/&/g,"&amp;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;");

}

function formatTime(ts){

  if(!ts?.toDate) return "";

  return ts.toDate().toLocaleTimeString([],{
    hour:"2-digit",
    minute:"2-digit"
  });

}

/* LOAD OTHER USER */
async function loadOtherUser(){

  const snap =
    await getDoc(doc(db,"users",otherUid));

  if(!snap.exists()){

    location.href = "messages.html";
    return;

  }

  otherUser = snap.data();

  /* UI */
  chatName.textContent =
    otherUser.displayName || "User";

  chatUsername.textContent =
    `@${otherUser.username || "user"}`;

  if(otherUser.photoURL){

    chatAvatar.innerHTML = `
      <img src="${otherUser.photoURL}">
    `;

  }else{

    chatAvatar.textContent =
      otherUser.initials || "?";

  }

}

/* OPEN CHAT */
async function openChat(){

  /* MARK READ */
  await updateDoc(
    doc(db,"conversations",activeConvId),
    {
      unreadBy:arrayRemove(currentUser.uid)
    }
  ).catch(()=>{});

  const q = query(
    collection(db,"messages"),
    where("convId","==",activeConvId),
    orderBy("createdAt","asc")
  );

  unsubMessages = onSnapshot(q,(snap)=>{

    messagesArea.innerHTML = "";

    if(snap.empty){

      messagesArea.innerHTML = `

        <div class="empty">

          <div>👋</div>

          <p>
            Start conversation with
            ${otherUser.displayName || "User"}
          </p>

        </div>

      `;

      return;

    }

    snap.forEach(d=>{

      const m = d.data();

      const wrap =
        document.createElement("div");

      wrap.className =
        m.fromUid===currentUser.uid
        ? "msg-wrap msg-mine"
        : "msg-wrap msg-other";

      wrap.innerHTML = `

        <div class="msg-bubble">

          ${escapeHTML(m.text)}

        </div>

        <div class="msg-time">

          ${formatTime(m.createdAt)}

        </div>

      `;

      messagesArea.appendChild(wrap);

    });

    /* AUTO SCROLL */
    messagesArea.scrollTop =
      messagesArea.scrollHeight;

  });

}

/* SEND MESSAGE */
async function sendMessage(){

  const text =
    msgInput.value.trim();

  if(!text) return;

  msgInput.value = "";

  /* SAVE MESSAGE */
  await addDoc(
    collection(db,"messages"),
    {
      convId:activeConvId,

      fromUid:currentUser.uid,

      toUid:otherUid,

      text,

      read:false,

      createdAt:serverTimestamp()
    }
  );

  /* UPDATE CONVERSATION */
  await setDoc(
    doc(db,"conversations",activeConvId),
    {
      participants:[
        currentUser.uid,
        otherUid
      ],

      lastMessage:text,

      lastMessageAt:serverTimestamp(),

      unreadBy:[otherUid]
    },
    {
      merge:true
    }
  );

}

/* SEND EVENTS */
sendBtn.onclick = sendMessage;

msgInput.addEventListener("keydown",(e)=>{

  if(e.key==="Enter"){

    sendMessage();

  }

});

/* CLEANUP */
window.addEventListener("beforeunload",()=>{

  if(unsubMessages){

    unsubMessages();

  }

});