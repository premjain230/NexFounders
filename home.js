import { auth, db } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
    collection,
    addDoc,
    getDocs,
    getDoc,
    doc,
    query,
    orderBy,
    serverTimestamp,
    updateDoc,
    arrayUnion,
    arrayRemove
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

let currentUser = null;
let currentUserData = null;

const postInput   = document.getElementById("postInput");
const postBtn     = document.getElementById("postBtn");
const feedEl      = document.getElementById("feed");
const navAvatar   = document.getElementById("navAvatar");
const navName     = document.getElementById("navName");
const searchInput = document.getElementById("searchInput");
const searchResults = document.getElementById("searchResults");

// ── Auth ──────────────────────────────────────────────────────
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
        navName.textContent   = currentUserData.displayName || "You";
    }

    loadFeed();
});

// ── Create Post ───────────────────────────────────────────────
postBtn.addEventListener("click", async () => {
    const text = postInput.value.trim();
    if (!text) return;

    postBtn.disabled = true;
    postBtn.textContent = "Posting...";

    await addDoc(collection(db, "posts"), {
        text,
        uid:         currentUser.uid,
        displayName: currentUserData.displayName,
        username:    currentUserData.username,
        initials:    currentUserData.initials,
        likes:       [],
        createdAt:   serverTimestamp()
    });

    postInput.value = "";
    postBtn.disabled = false;
    postBtn.textContent = "Post";
    loadFeed();
});

// ── Load Feed ─────────────────────────────────────────────────
async function loadFeed() {
    feedEl.innerHTML = `<div style="color:#71767b;text-align:center;padding:40px;">Loading...</div>`;

    const q = query(collection(db, "posts"), orderBy("createdAt", "desc"));
    const snap = await getDocs(q);

    if (snap.empty) {
        feedEl.innerHTML = `<div style="color:#71767b;text-align:center;padding:40px;">No posts yet. Be the first!</div>`;
        return;
    }

    feedEl.innerHTML = "";

    snap.forEach(docSnap => {
        const post = docSnap.data();
        const id   = docSnap.id;
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
                    <div class="post-name">
                        <a href="profile.html?uid=${post.uid}" class="profile-link">${post.displayName}</a>
                    </div>
                    <div class="post-username">@${post.username} · <span class="post-time">${time}</span></div>
                </div>
            </div>
            <div class="post-text">${post.text}</div>
            <div class="post-actions">
                <button class="like-btn ${liked ? 'liked' : ''}" data-id="${id}">
                    ${liked ? '❤️' : '🤍'} <span>${likeCount}</span>
                </button>
            </div>
        `;

        el.querySelector(".like-btn").addEventListener("click", () => toggleLike(id, post.likes || []));
        feedEl.appendChild(el);
    });
}

// ── Like / Unlike ─────────────────────────────────────────────
async function toggleLike(postId, currentLikes) {
    const ref = doc(db, "posts", postId);
    const liked = currentLikes.includes(currentUser.uid);

    if (liked) {
        await updateDoc(ref, { likes: arrayRemove(currentUser.uid) });
    } else {
        await updateDoc(ref, { likes: arrayUnion(currentUser.uid) });
    }

    loadFeed();
}

// ── Search Users ──────────────────────────────────────────────
searchInput.addEventListener("input", async () => {
    const q = searchInput.value.trim().toLowerCase();
    searchResults.innerHTML = "";

    if (!q) {
        searchResults.style.display = "none";
        return;
    }

    const snap = await getDocs(collection(db, "users"));
    const matches = [];

    snap.forEach(d => {
        const u = d.data();
        if (
            u.displayName?.toLowerCase().includes(q) ||
            u.username?.toLowerCase().includes(q)
        ) {
            matches.push({ id: d.id, ...u });
        }
    });

    if (matches.length === 0) {
        searchResults.style.display = "none";
        return;
    }

    searchResults.style.display = "block";

    matches.forEach(u => {
        const el = document.createElement("div");
        el.className = "search-result";
        el.innerHTML = `
            <div class="search-avatar">${u.initials || "?"}</div>
            <div>
                <div style="font-weight:600">${u.displayName}</div>
                <div style="color:#71767b;font-size:13px">@${u.username}</div>
            </div>
        `;
        el.addEventListener("click", () => {
            window.location.href = `profile.html?uid=${u.id}`;
        });
        searchResults.appendChild(el);
    });
});

// Close search on outside click
document.addEventListener("click", (e) => {
    if (!searchInput.contains(e.target) && !searchResults.contains(e.target)) {
        searchResults.style.display = "none";
    }
});