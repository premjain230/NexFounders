import { auth, db } from "./firebase.js";

import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

/* STATE */
let currentUser = null;
let conversations = [];
let allUsers = [];

/* DOM */
const convList =
  document.getElementById("convList");

const searchInput =
  document.getElementById("searchInput");

const modal =
  document.getElementById("modal");

const newMsgBtn =
  document.getElementById("newMsgBtn");

const closeModal =
  document.getElementById("closeModal");

const modalSearch =
  document.getElementById("modalSearch");

const modalList =
  document.getElementById("modalList");

/* AUTH */
onAuthStateChanged(auth, async(user)=>{

  if(!user){

    location.href = "index.html";
    return;

  }

  currentUser = user;

  loadConversations();
  loadUsers();

});

/* HELPERS */
function formatTime(ts){

  if(!ts?.toDate) return "";

  return ts.toDate().toLocaleTimeString([],{
    hour:"2-digit",
    minute:"2-digit"
  });

}

function escapeHTML(str){

  if(!str) return "";

  return str
    .replace(/&/g,"&amp;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;");

}

/* LOAD CONVERSATIONS */
function loadConversations(filter=""){

  const q = query(
    collection(db,"conversations"),
    where(
      "participants",
      "array-contains",
      currentUser.uid
    ),
    orderBy("lastMessageAt","desc")
  );

  onSnapshot(q, async(snap)=>{

    convList.innerHTML = "";

    conversations = [];

    for(const d of snap.docs){

      const conv = {
        id:d.id,
        ...d.data()
      };

      const otherId =
        conv.participants.find(
          p => p !== currentUser.uid
        );

      if(!otherId) continue;

      const otherSnap =
        await getDoc(doc(db,"users",otherId));

      const other =
        otherSnap.exists()
        ? otherSnap.data()
        : {
          displayName:"User",
          initials:"?"
        };

      if(
        filter &&
        !other.displayName
        ?.toLowerCase()
        .includes(filter.toLowerCase())
      ){
        continue;
      }

      conversations.push({
        conv,
        other,
        otherId
      });

    }

    renderConversations();

  });

}

/* RENDER CONVERSATIONS */
function renderConversations(){

  if(conversations.length===0){

    convList.innerHTML = `

      <div class="empty">

        <div>💬</div>

        <p>No conversations found</p>

      </div>

    `;

    return;

  }

  conversations.forEach(item=>{

    const {
      conv,
      other,
      otherId
    } = item;

    const unread =
      conv.unreadBy?.includes(
        currentUser.uid
      );

    const a =
      document.createElement("a");

    a.className = "conv-item";

    a.href =
      `chat.html?uid=${otherId}`;

    a.innerHTML = `

      <div class="conv-avatar">

        ${
          other.photoURL
          ? `<img src="${other.photoURL}">`
          : (other.initials || "?")
        }

      </div>

      <div class="conv-content">

        <div class="conv-name">
          ${other.displayName || "User"}
        </div>

        <div class="conv-preview">
          ${escapeHTML(conv.lastMessage || "")}
        </div>

      </div>

      <div class="conv-right">

        <div class="conv-time">
          ${formatTime(conv.lastMessageAt)}
        </div>

        ${
          unread
          ? `<div class="unread-dot"></div>`
          : ""
        }

      </div>

    `;

    convList.appendChild(a);

  });

}

/* SEARCH CONVERSATIONS */
searchInput.addEventListener("input",(e)=>{

  loadConversations(e.target.value);

});

/* LOAD USERS */
async function loadUsers(filter=""){

  const snap =
    await getDocs(collection(db,"users"));

  modalList.innerHTML = "";

  allUsers = [];

  snap.forEach(d=>{

    if(d.id===currentUser.uid) return;

    const u = d.data();

    if(
      filter &&
      !u.displayName
      ?.toLowerCase()
      .includes(filter.toLowerCase())
    ){
      return;
    }

    allUsers.push({
      id:d.id,
      ...u
    });

  });

  renderUsers();

}

/* RENDER USERS */
function renderUsers(){

  if(allUsers.length===0){

    modalList.innerHTML = `
      <div style="
      padding:20px;
      text-align:center;
      color:#64748b">
        No users found
      </div>
    `;

    return;

  }

  allUsers.forEach(u=>{

    const div =
      document.createElement("div");

    div.className =
      "modal-user";

    div.onclick = ()=>{

      location.href =
        `chat.html?uid=${u.id}`;

    };

    div.innerHTML = `

      <div class="modal-avatar">

        ${
          u.photoURL
          ? `<img src="${u.photoURL}">`
          : (u.initials || "?")
        }

      </div>

      <div>

        <div class="modal-name">
          ${u.displayName || "User"}
        </div>

        <div class="modal-username">
          @${u.username || "user"}
        </div>

      </div>

    `;

    modalList.appendChild(div);

  });

}

/* SEARCH USERS */
modalSearch.addEventListener("input",(e)=>{

  loadUsers(e.target.value);

});

/* MODAL */
newMsgBtn.onclick = ()=>{

  modal.classList.add("open");

};

closeModal.onclick = ()=>{

  modal.classList.remove("open");

};

window.onclick = (e)=>{

  if(e.target===modal){

    modal.classList.remove("open");

  }

};
