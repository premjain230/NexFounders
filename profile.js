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

let currentUser     = null;
let currentUserData = null;

const postInput     = document.getElementById("postInput");
const postBtn       = document.getElementById("postBtn");
const feedEl        = document.getElementById("feed");
const navAvatar     = document.getElementById("navAvatar");
const createAvatar  = document.getElementById("createAvatar");   // FIX 1: was never set
const navName       = document.getElementById("navName");
const searchInput   = document.getElementById("searchInput");
const searchResults = document.getElementById("searchResults");

// ── Auth ──────────────────────────────────────────────────────
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = "index.html";
        return;
    }
    currentUser = user;

    try {
        const snap = await getDoc(doc(db, "users", user.uid));
        if (snap.exists()) {
            currentUserData = snap.data();
        } else {
            // FIX 2: graceful fallback when Firestore user doc is missing
            currentUserData = {
                displayName: user.displayName || "Anonymous",
                username:    user.email?.split("@")[0] || "user",
                initials:    (user.displayName?.[0] || "?").toUpperCase()
            };
        }

        // FIX 1 (cont): populate both avatars
        navAvatar.textContent    = currentUserData.initials || "?";
        createAvatar.textContent = currentUserData.initials || "?";
        navName.textContent      = currentUserData.displayName || "You";
    } catch (err) {
        console.error("Failed to load user data:", err);
    }

    loadFeed();
});

// ── Create Post ───────────────────────────────────────────────
postBtn.addEventListener("click", async () => {
    const text = postInput.value.trim();
    if (!text || !currentUserData) return;

    postBtn.disabled    = true;
    postBtn.textContent = "Posting...";

    try {
        // FIX 3: capture the new doc ref so we can prepend it immediately
        const docRef = await addDoc(collection(db, "posts"), {
            text,
            uid:         currentUser.uid,
            displayName: currentUserData.displayName,
            username:    currentUserData.username,
            initials:    currentUserData.initials,
            likes:       [],
            createdAt:   serverTimestamp()
        });

        postInput.value = "";

        // FIX 4: prepend the new post to the top instantly (no full reload)
        prependPost(docRef.id, {
            text,
            uid:         currentUser.uid,
            displayName: currentUserData.displayName,
            username:    currentUserData.username,
            initials:    currentUserData.initials,
            likes:       []
            // createdAt intentionally omitted; we show "Just now"
        });

        // Remove the "no posts yet" placeholder if present
        const placeholder = feedEl.querySelector(".feed-empty");
        if (placeholder) placeholder.remove();

    } catch (err) {
        console.error("Failed to create post:", err);
        alert("Could not publish your post. Please try again.");
    } finally {
        // FIX 5: always re-enable the button even if addDoc threw
        postBtn.disabled    = false;
        postBtn.textContent = "Post";
    }
});

// ── Build a single post element ───────────────────────────────
function buildPostEl(id, post) {
    const liked     = (post.likes || []).includes(currentUser.uid);
    const likeCount = (post.likes || []).length;
    const time      = post.createdAt
        ? new Date(post.createdAt.seconds * 1000).toLocaleString()
        : "Just now";

    const el = document.createElement("div");
    el.className  = "post";
    el.dataset.id = id;

    el.innerHTML = `
        <div class="post-header">
            <div class="post-avatar">${post.initials || "?"}</div>
            <div>
                <div class="post-name">
                    <a href="profile.html?uid=${post.uid}" class="profile-link">${post.displayName || "Unknown"}</a>
                </div>
                <div class="post-username">@${post.username || "user"} · <span class="post-time">${time}</span></div>
            </div>
        </div>
        <div class="post-text">${escapeHTML(post.text)}</div>
        <div class="post-actions">
            <button class="like-btn ${liked ? "liked" : ""}" data-id="${id}">
                ${liked ? "❤️" : "🤍"} <span>${likeCount}</span>
            </button>
        </div>
    `;

    // FIX 6: update only THIS post's like button instead of reloading the whole feed
    el.querySelector(".like-btn").addEventListener("click", (e) => {
        e.stopPropagation();
        toggleLike(id, post.likes || [], el);
    });

    return el;
}

// ── Prepend one post to the top of the feed ───────────────────
function prependPost(id, post) {
    const el = buildPostEl(id, post);
    feedEl.insertBefore(el, feedEl.firstChild);
}

// ── Load Feed ─────────────────────────────────────────────────
async function loadFeed() {
    feedEl.innerHTML = `<div style="color:#71767b;text-align:center;padding:40px;">Loading...</div>`;

    try {
        const q    = query(collection(db, "posts"), orderBy("createdAt", "desc"));
        const snap = await getDocs(q);

        if (snap.empty) {
            feedEl.innerHTML = `<div class="feed-empty" style="color:#71767b;text-align:center;padding:40px;">No posts yet. Be the first!</div>`;
            return;
        }

        feedEl.innerHTML = "";
        snap.forEach(docSnap => {
            feedEl.appendChild(buildPostEl(docSnap.id, docSnap.data()));
        });
    } catch (err) {
        console.error("Failed to load feed:", err);
        feedEl.innerHTML = `<div style="color:#f43f5e;text-align:center;padding:40px;">Failed to load posts. Please refresh.</div>`;
    }
}

// ── Like / Unlike ─────────────────────────────────────────────
// FIX 6 (cont): update DOM directly — no full feed reload
async function toggleLike(postId, currentLikes, postEl) {
    const uid   = currentUser.uid;
    const liked = currentLikes.includes(uid);
    const ref   = doc(db, "posts", postId);
    const btn   = postEl.querySelector(".like-btn");

    // Optimistic UI update
    let newLikes;
    if (liked) {
        newLikes = currentLikes.filter(id => id !== uid);
        btn.classList.remove("liked");
        btn.innerHTML = `🤍 <span>${newLikes.length}</span>`;
    } else {
        newLikes = [...currentLikes, uid];
        btn.classList.add("liked");
        btn.innerHTML = `❤️ <span>${newLikes.length}</span>`;
    }

    // Re-bind with the updated likes array
    btn.onclick = (e) => {
        e.stopPropagation();
        toggleLike(postId, newLikes, postEl);
    };

    try {
        if (liked) {
            await updateDoc(ref, { likes: arrayRemove(uid) });
        } else {
            await updateDoc(ref, { likes: arrayUnion(uid) });
        }
    } catch (err) {
        console.error("Like failed:", err);
        // Roll back optimistic update on error
        btn.classList.toggle("liked", liked);
        btn.innerHTML = liked
            ? `❤️ <span>${currentLikes.length}</span>`
            : `🤍 <span>${currentLikes.length}</span>`;
        btn.onclick = (e) => {
            e.stopPropagation();
            toggleLike(postId, currentLikes, postEl);
        };
    }
}

// ── Search Users ──────────────────────────────────────────────
searchInput.addEventListener("input", async () => {
    const q = searchInput.value.trim().toLowerCase();
    searchResults.innerHTML = "";

    if (!q) {
        searchResults.style.display = "none";
        return;
    }

    try {
        const snap   = await getDocs(collection(db, "users"));
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
                    <div style="font-weight:600">${escapeHTML(u.displayName)}</div>
                    <div style="color:#71767b;font-size:13px">@${escapeHTML(u.username)}</div>
                </div>
            `;
            el.addEventListener("click", () => {
                searchResults.style.display = "none";   // FIX 7: close results on click
                searchInput.value = "";
                window.location.href = `profile.html?uid=${u.id}`;
            });
            searchResults.appendChild(el);
        });
    } catch (err) {
        console.error("Search failed:", err);
    }
});

// Close search on outside click
document.addEventListener("click", (e) => {
    if (!searchInput.contains(e.target) && !searchResults.contains(e.target)) {
        searchResults.style.display = "none";
    }
});

// ── Helpers ───────────────────────────────────────────────────
// FIX 8: prevent XSS — always escape user-generated text before injecting as HTML
function escapeHTML(str = "") {
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
