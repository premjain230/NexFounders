import { auth, db } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
    collection,
    addDoc,
    doc,
    getDoc,
    query,
    orderBy,
    serverTimestamp,
    updateDoc,
    arrayUnion,
    arrayRemove,
    onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

let currentUser = null;
let currentUserData = null;

const postInput = document.getElementById("postInput");
const postBtn = document.getElementById("postBtn");
const feedEl = document.getElementById("feed");
const navAvatar = document.getElementById("navAvatar");
const navName = document.getElementById("navName");
const searchInput = document.getElementById("searchInput");
const searchResults = document.getElementById("searchResults");

// ── AUTH ─────────────────────────────
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = "index.html";
        return;
    }

    currentUser = user;

    const snap = await getDoc(doc(db, "users", user.uid));
    if (snap.exists()) {
        currentUserData = snap.data();
        navAvatar.textContent = currentUserData.initials || "?";
        navName.textContent = currentUserData.displayName || "You";
    }

    loadFeedRealtime(); // 🔥 REAL TIME
});

// ── POST ─────────────────────────────
postBtn.addEventListener("click", async () => {
    const text = postInput.value.trim();
    if (!text) return;

    postBtn.disabled = true;

    await addDoc(collection(db, "posts"), {
        text,
        uid: currentUser.uid,
        displayName: currentUserData.displayName,
        username: currentUserData.username,
        initials: currentUserData.initials,
        likes: [],
        createdAt: serverTimestamp()
    });

    postInput.value = "";
    postBtn.disabled = false;
});

// ── REAL-TIME FEED ────────────────────
function loadFeedRealtime() {
    const q = query(
        collection(db, "posts"),
        orderBy("createdAt", "desc")
    );

    onSnapshot(q, (snapshot) => {
        feedEl.innerHTML = "";

        if (snapshot.empty) {
            feedEl.innerHTML = "No posts yet.";
            return;
        }

        snapshot.forEach((docSnap) => {
            const post = docSnap.data();
            const id = docSnap.id;

            const liked = (post.likes || []).includes(currentUser.uid);
            const likeCount = (post.likes || []).length;

            const time = post.createdAt
                ? new Date(post.createdAt.seconds * 1000).toLocaleString()
                : "Just now";

            const el = document.createElement("div");
            el.className = "post";

            el.innerHTML = `
                <div class="post-header">
                    <div class="post-avatar">${post.initials || "?"}</div>
                    <div>
                        <div class="post-name">${post.displayName}</div>
                        <div class="post-username">@${post.username} · ${time}</div>
                    </div>
                </div>

                <div class="post-text">${post.text}</div>

                <div class="post-actions">
                    <button class="like-btn ${liked ? "liked" : ""}">
                        ${liked ? "❤️" : "🤍"} ${likeCount}
                    </button>
                </div>
            `;

            el.querySelector(".like-btn").onclick = () => toggleLike(id, post.likes || []);
            feedEl.appendChild(el);
        });
    });
}

// ── LIKE ─────────────────────────────
async function toggleLike(postId, likes) {
    const ref = doc(db, "posts", postId);
    const liked = likes.includes(currentUser.uid);

    await updateDoc(ref, {
        likes: liked
            ? arrayRemove(currentUser.uid)
            : arrayUnion(currentUser.uid)
    });
}
