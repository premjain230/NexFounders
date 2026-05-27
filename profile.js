import { auth, db } from "./firebase.js";

import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
  collection,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  writeBatch,
  query,
  orderBy,
  onSnapshot,
  where,
  addDoc,
  arrayUnion,
  arrayRemove,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

/* STATE */
let currentUser = null;
let currentUserData = null;

let notifUnsub = null;
let notifBadgeUnsub = null;
let msgBadgeUnsub = null;

/* DOM */
const notifList =
  document.getElementById("notifList");

const markAllBtn =
  document.getElementById("markAllBtn");

const notifBadge =
  document.getElementById("notifBadge");

const msgBadge =
  document.getElementById("msgBadge");

/* AUTH */
onAuthStateChanged(auth, async(user)=>{

  if(!user){

    location.href =
      "index.html";

    return;

  }

  currentUser = user;

  try{

    const snap =
      await getDoc(
        doc(
          db,
          "users",
          user.uid
        )
      );

    if(snap.exists()){

      currentUserData =
        snap.data();

      setNavAvatar();

    }

    loadNotifications();

    watchBadges();

  }catch(error){

    console.error(error);

  }

});

/* HELPERS */
function escapeHTML(str){

  if(!str) return "";

  return str
    .replace(/&/g,"&amp;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;")
    .replace(/'/g,"&#039;");

}

function timeAgo(ms){

  const diff =
    Date.now() - ms;

  const m =
    Math.floor(diff/60000);

  if(m < 1)
    return "just now";

  if(m < 60)
    return `${m}m ago`;

  const h =
    Math.floor(m/60);

  if(h < 24)
    return `${h}h ago`;

  return `${Math.floor(h/24)}d ago`;

}

/* NAV */
function setNavAvatar(){

  const el =
    document.getElementById(
      "navAvatar"
    );

  document.getElementById(
    "navName"
  ).textContent =
    currentUserData
      ?.displayName || "You";

  if(currentUserData?.photoURL){

    el.innerHTML = `

      <img
      src="${currentUserData.photoURL}"
      style="
        width:100%;
        height:100%;
        object-fit:cover;
        border-radius:50%;
      ">

    `;

  }else{

    el.textContent =
      currentUserData
        ?.initials || "?";

  }

}

/* LOAD NOTIFICATIONS */
function loadNotifications(){

  const q = query(
    collection(
      db,
      "notifications"
    ),
    where(
      "toUid",
      "==",
      currentUser.uid
    ),
    orderBy(
      "createdAt",
      "desc"
    )
  );

  notifUnsub =
    onSnapshot(q,(snap)=>{

      notifList.innerHTML = "";

      if(snap.empty){

        notifList.innerHTML = `

          <div class="empty-state">

            <div>🔔</div>

            No notifications yet

          </div>

        `;

        return;

      }

      snap.forEach((d)=>{

        renderNotif(d);

      });

    });

}

/* RENDER */
function renderNotif(docSnap){

  const n =
    docSnap.data();

  const id =
    docSnap.id;

  const time =
    n.createdAt
    ? timeAgo(
        n.createdAt.seconds * 1000
      )
    : "";

  const iconMap = {

    like:"❤️",

    comment:"💬",

    connect_request:"🤝",

    connect_accepted:"✅",

    follow:"👤"

  };

  const textMap = {

    like:
      `<b>${escapeHTML(n.fromName)}</b> liked your post`,

    comment:
      `<b>${escapeHTML(n.fromName)}</b> commented on your post`,

    connect_request:
      `<b>${escapeHTML(n.fromName)}</b> sent you a connection request`,

    connect_accepted:
      `<b>${escapeHTML(n.fromName)}</b> accepted your connection request`,

    follow:
      `<b>${escapeHTML(n.fromName)}</b> started following you`

  };

  const el =
    document.createElement(
      "div"
    );

  el.className =
    `notif-item ${
      n.read
      ? ""
      : "unread"
    }`;

  el.innerHTML = `

    <div class="notif-avatar">

      ${
        n.fromPhoto
        ? `<img src="${n.fromPhoto}">`
        : escapeHTML(
            n.fromName
            ?.slice(0,2) || "?"
          )
      }

    </div>

    <div class="notif-body">

      <div class="notif-text">

        ${
          textMap[n.type]
          || escapeHTML(n.type)
        }

      </div>

      ${
        n.postText
        ? `

        <div class="notif-subtext">

          "${escapeHTML(
            n.postText.slice(0,80)
          )}"

        </div>

        `
        : ""
      }

      ${
        n.commentText
        ? `

        <div class="notif-subtext">

          Comment:
          "${escapeHTML(
            n.commentText.slice(0,80)
          )}"

        </div>

        `
        : ""
      }

      <div class="notif-time">

        ${time}

      </div>

      ${
        n.type ===
        "connect_request"

        ?

        `

        <div class="accept-row">

          <button
          class="accept-btn">

            Accept

          </button>

          <button
          class="decline-btn">

            Decline

          </button>

        </div>

        `

        : ""
      }

    </div>

    <div class="notif-icon">

      ${
        iconMap[n.type]
        || "🔔"
      }

    </div>

  `;

  const acceptBtn =
    el.querySelector(
      ".accept-btn"
    );

  const declineBtn =
    el.querySelector(
      ".decline-btn"
    );

  if(acceptBtn){

    acceptBtn.onclick =
      async(e)=>{

        e.stopPropagation();

        acceptBtn.disabled =
          true;

        declineBtn.disabled =
          true;

        await acceptConnect(
          n.fromUid,
          id
        );

      };

  }

  if(declineBtn){

    declineBtn.onclick =
      async(e)=>{

        e.stopPropagation();

        acceptBtn.disabled =
          true;

        declineBtn.disabled =
          true;

        await declineConnect(
          n.fromUid,
          id
        );

      };

  }

  el.onclick = async()=>{

    try{

      if(!n.read){

        await markRead(id);

      }

      if(n.fromUid){

        location.href =
          `profile.html?uid=${n.fromUid}`;

      }

    }catch(error){

      console.error(error);

    }

  };

  notifList.appendChild(el);

}

/* MARK READ */
async function markRead(id){

  try{

    await updateDoc(
      doc(
        db,
        "notifications",
        id
      ),
      {
        read:true
      }
    );

  }catch(error){

    console.error(error);

  }

}

/* MARK ALL */
markAllBtn.onclick =
  async()=>{

    try{

      markAllBtn.disabled =
        true;

      const q = query(
        collection(
          db,
          "notifications"
        ),
        where(
          "toUid",
          "==",
          currentUser.uid
        ),
        where(
          "read",
          "==",
          false
        )
      );

      const snap =
        await getDocs(q);

      const batch =
        writeBatch(db);

      snap.forEach((d)=>{

        batch.update(
          d.ref,
          {
            read:true
          }
        );

      });

      await batch.commit();

    }catch(error){

      console.error(error);

    }

    markAllBtn.disabled =
      false;

  };

/* ACCEPT */
async function acceptConnect(
  fromUid,
  notifId
){

  try{

    const myRef =
      doc(
        db,
        "users",
        currentUser.uid
      );

    const fromRef =
      doc(
        db,
        "users",
        fromUid
      );

    await updateDoc(
      myRef,
      {
        pendingConnections:
          arrayRemove(
            fromUid
          ),

        connections:
          arrayUnion(
            fromUid
          )
      }
    );

    await updateDoc(
      fromRef,
      {
        sentConnections:
          arrayRemove(
            currentUser.uid
          ),

        connections:
          arrayUnion(
            currentUser.uid
          )
      }
    );

    await markRead(
      notifId
    );

    await addDoc(
      collection(
        db,
        "notifications"
      ),
      {
        toUid:
          fromUid,

        fromUid:
          currentUser.uid,

        fromName:
          currentUserData
            ?.displayName || "",

        fromUsername:
          currentUserData
            ?.username || "",

        fromPhoto:
          currentUserData
            ?.photoURL || "",

        type:
          "connect_accepted",

        read:false,

        createdAt:
          serverTimestamp()
      }
    );

  }catch(error){

    console.error(error);

    alert(
      "Failed to accept request"
    );

  }

}

/* DECLINE */
async function declineConnect(
  fromUid,
  notifId
){

  try{

    const myRef =
      doc(
        db,
        "users",
        currentUser.uid
      );

    const fromRef =
      doc(
        db,
        "users",
        fromUid
      );

    await updateDoc(
      myRef,
      {
        pendingConnections:
          arrayRemove(
            fromUid
          )
      }
    );

    await updateDoc(
      fromRef,
      {
        sentConnections:
          arrayRemove(
            currentUser.uid
          )
      }
    );

    await markRead(
      notifId
    );

  }catch(error){

    console.error(error);

    alert(
      "Failed to decline request"
    );

  }

}

/* BADGES */
function watchBadges(){

  notifBadgeUnsub =
    onSnapshot(

      query(
        collection(
          db,
          "notifications"
        ),
        where(
          "toUid",
          "==",
          currentUser.uid
        ),
        where(
          "read",
          "==",
          false
        )
      ),

      (snap)=>{

        notifBadge.textContent =
          snap.size > 9
          ? "9+"
          : snap.size;

        notifBadge.classList
          .toggle(
            "show",
            snap.size > 0
          );

      }

    );

  msgBadgeUnsub =
    onSnapshot(

      query(
        collection(
          db,
          "messages"
        ),
        where(
          "toUid",
          "==",
          currentUser.uid
        ),
        where(
          "read",
          "==",
          false
        )
      ),

      (snap)=>{

        msgBadge.textContent =
          snap.size > 9
          ? "9+"
          : snap.size;

        msgBadge.classList
          .toggle(
            "show",
            snap.size > 0
          );

      }

    );

}

/* CLEANUP */
window.addEventListener(
  "beforeunload",
  ()=>{

    if(notifUnsub)
      notifUnsub();

    if(notifBadgeUnsub)
      notifBadgeUnsub();

    if(msgBadgeUnsub)
      msgBadgeUnsub();

  }
);