import { auth, db } from "./firebase.js";

import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  query,
  orderBy,
  limit,
  onSnapshot,
  where,
  arrayUnion,
  arrayRemove,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

/* STATE */
let currentUser = null;
let currentUserData = null;
let allUsers = [];

let notifUnsub = null;
let msgUnsub = null;
let trendingUnsub = null;

/* DOM */
const peopleGrid =
  document.getElementById("peopleGrid");

const trendingEl =
  document.getElementById("trendingPosts");

const searchInput =
  document.getElementById("searchInput");

const notifBadge =
  document.getElementById("notifBadge");

const msgBadge =
  document.getElementById("msgBadge");

/* AUTH */
onAuthStateChanged(auth, async(user)=>{

  if(!user){

    location.href = "index.html";
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

    await loadPeople();

    loadTrendingPosts();

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

function debounce(fn,delay=300){

  let timeout;

  return (...args)=>{

    clearTimeout(timeout);

    timeout = setTimeout(()=>{

      fn(...args);

    },delay);

  };

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

/* LOAD PEOPLE */
async function loadPeople(){

  try{

    peopleGrid.innerHTML = `

      <div
      class="empty-state"
      style="grid-column:1/-1">

        <div>⏳</div>

        Loading founders...

      </div>

    `;

    const snap =
      await getDocs(
        query(
          collection(db,"users"),
          limit(50)
        )
      );

    allUsers = [];

    snap.forEach((d)=>{

      if(
        d.id === currentUser.uid
      ) return;

      allUsers.push({
        id:d.id,
        ...d.data()
      });

    });

    renderPeople();

  }catch(error){

    console.error(error);

    peopleGrid.innerHTML = `

      <div
      class="empty-state"
      style="grid-column:1/-1">

        <div>⚠️</div>

        Failed to load founders

      </div>

    `;

  }

}

/* RENDER PEOPLE */
function renderPeople(filter=""){

  peopleGrid.innerHTML = "";

  const q =
    filter.toLowerCase();

  const filtered =
    filter
    ? allUsers.filter((u)=>

        u.displayName
          ?.toLowerCase()
          .includes(q)

        ||

        u.username
          ?.toLowerCase()
          .includes(q)

        ||

        u.bio
          ?.toLowerCase()
          .includes(q)

      )
    : allUsers;

  if(!filtered.length){

    peopleGrid.innerHTML = `

      <div
      class="empty-state"
      style="grid-column:1/-1">

        <div>😕</div>

        No founders found

      </div>

    `;

    return;

  }

  filtered.forEach((u)=>{

    const myData =
      currentUserData || {};

    const connections =
      myData.connections || [];

    const pending =
      myData.sentConnections || [];

    const incoming =
      myData.pendingConnections || [];

    let btnClass =
      "default";

    let btnText =
      "Connect";

    if(
      connections.includes(u.id)
    ){

      btnClass =
        "connected";

      btnText =
        "✓ Connected";

    }

    else if(
      pending.includes(u.id)
    ){

      btnClass =
        "pending";

      btnText =
        "Request Sent";

    }

    else if(
      incoming.includes(u.id)
    ){

      btnClass =
        "connected";

      btnText =
        "Accept";

    }

    const card =
      document.createElement(
        "div"
      );

    card.className =
      "person-card";

    card.innerHTML = `

      <div class="person-avatar">

        ${
          u.photoURL
          ? `<img src="${u.photoURL}">`
          : escapeHTML(
              u.initials || "?"
            )
        }

      </div>

      <div class="person-name">

        ${
          escapeHTML(
            u.displayName || "Unknown"
          )
        }

      </div>

      <div class="person-username">

        @${escapeHTML(
          u.username || ""
        )}

      </div>

      ${
        u.bio
        ? `

        <div class="person-bio">

          ${escapeHTML(
            u.bio.slice(0,80)
          )}

          ${
            u.bio.length>80
            ? "..."
            : ""
          }

        </div>

        `
        : ""
      }

      <button
      class="connect-btn ${btnClass}"
      data-class="${btnClass}">

        ${btnText}

      </button>

      <a
      href="profile.html?uid=${u.id}"
      class="view-profile-btn">

        View Profile →

      </a>

    `;

    const btn =
      card.querySelector(
        ".connect-btn"
      );

    btn.onclick = ()=>{

      handleConnect(
        btn,
        u
      );

    };

    peopleGrid.appendChild(card);

  });

}

/* CONNECT */
async function handleConnect(
  btn,
  targetUser
){

  const state =
    btn.dataset.class;

  if(
    state === "pending"
  ) return;

  btn.disabled = true;

  try{

    const myRef =
      doc(
        db,
        "users",
        currentUser.uid
      );

    const targetRef =
      doc(
        db,
        "users",
        targetUser.id
      );

    if(
      btn.textContent
      .includes("Accept")
    ){

      await updateDoc(
        myRef,
        {
          pendingConnections:
            arrayRemove(
              targetUser.id
            ),

          connections:
            arrayUnion(
              targetUser.id
            )
        }
      );

      await updateDoc(
        targetRef,
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

      btn.textContent =
        "✓ Connected";

      btn.className =
        "connect-btn connected";

      btn.dataset.class =
        "connected";

    }

    else if(
      state === "connected"
    ){

      await updateDoc(
        myRef,
        {
          connections:
            arrayRemove(
              targetUser.id
            )
        }
      );

      await updateDoc(
        targetRef,
        {
          connections:
            arrayRemove(
              currentUser.uid
            )
        }
      );

      btn.textContent =
        "Connect";

      btn.className =
        "connect-btn default";

      btn.dataset.class =
        "default";

    }

    else{

      await updateDoc(
        myRef,
        {
          sentConnections:
            arrayUnion(
              targetUser.id
            )
        }
      );

      await updateDoc(
        targetRef,
        {
          pendingConnections:
            arrayUnion(
              currentUser.uid
            )
        }
      );

      await addDoc(
        collection(
          db,
          "notifications"
        ),
        {
          toUid:
            targetUser.id,

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
            "connect_request",

          read:false,

          createdAt:
            serverTimestamp()
        }
      );

      btn.textContent =
        "Request Sent";

      btn.className =
        "connect-btn pending";

      btn.dataset.class =
        "pending";

    }

  }catch(error){

    console.error(error);

    alert(
      "Action failed"
    );

  }

  btn.disabled = false;

}

/* TRENDING */
function loadTrendingPosts(){

  const q = query(
    collection(db,"posts"),
    orderBy(
      "createdAt",
      "desc"
    ),
    limit(15)
  );

  trendingUnsub =
    onSnapshot(q,(snap)=>{

      const posts = [];

      snap.forEach((d)=>{

        posts.push({
          id:d.id,
          ...d.data()
        });

      });

      posts.sort((a,b)=>

        (
          b.likes?.length || 0
        )

        -

        (
          a.likes?.length || 0
        )

      );

      trendingEl.innerHTML = "";

      posts
      .slice(0,10)
      .forEach((post)=>{

        const div =
          document.createElement(
            "div"
          );

        div.className =
          "trending-post";

        const time =
          post.createdAt
          ?.toDate
          ? post.createdAt
              .toDate()
              .toLocaleDateString()
          : "";

        div.innerHTML = `

          <div class="tp-meta">

            @${escapeHTML(
              post.username || ""
            )}

            · ${time}

          </div>

          <div class="tp-text">

            ${escapeHTML(
              (
                post.text || ""
              ).slice(0,200)
            )}

          </div>

          <div class="tp-stats">

            <span>
              ❤️ ${
                post.likes?.length || 0
              }
            </span>

            <span>
              💬 ${
                post.comments
                ?.length || 0
              }
            </span>

          </div>

        `;

        div.onclick = ()=>{

          location.href =
            `profile.html?uid=${post.uid}`;

        };

        trendingEl
          .appendChild(div);

      });

    });

}

/* SEARCH */
searchInput.addEventListener(
  "input",
  debounce((e)=>{

    renderPeople(
      e.target.value.trim()
    );

  },250)
);

/* BADGES */
function watchBadges(){

  notifUnsub =
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

  msgUnsub =
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

    if(msgUnsub)
      msgUnsub();

    if(trendingUnsub)
      trendingUnsub();

  }
);