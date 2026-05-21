import { auth, db } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
    doc,
    getDoc,
    getDocs,
    updateDoc,
    setDoc,
    collection,
    query,
    where,
    orderBy,
    arrayUnion,
    arrayRemove,
    deleteDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
 
// ── URL param: whose profile? ─────────────────────────────────
const params     = new URLSearchParams(window.location.search);
const profileUid = params.get("uid");   // null = own profile
 
let currentUser     = null;
let currentUserData = null;
let profileData     = null;
let targetUid       = null;
let isOwnProfile    = false;
 
// ── DOM refs ──────────────────────────────────────────────────
const avatar          = document.getElementById("avatar");
const displayNameEl   = document.getElementById("displayName");
const displayUsername = document.getElementById("displayUsername");
const displayBio      = document.getElementById("displayBio");
const displayEmail    = document.getElementById("displayEmail");
const followersCount  = document.getElementById("followersCount");
const followingCount  = document.getElementById("followingCount");
const followBtn       = document.getElementById("followBtn");
const editBtn         = document.getElementById("openEditBtn");
const editModal       = document.getElementById("editModal");
const cancelBtn       = document.getElementById("cancelBtn");
const saveBtn         = document.getElementById("saveBtn");
const inputName       = document.getElementById("inputName");
const inputUsername   = document.getElementById("inputUsername");
const inputBio        = document.getElementById("inputBio");
const postsContainer  = document.getElementById("userPosts");
 
// ── Helpers ───────────────────────────────────────────────────
function initials(name = "") {
    return name.split(" ").map(w => w[0] || "").join("").slice(0, 2).toUpperCase() || "?";
}
 
function escapeHTML(str = "") {
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
 
// ── Auth ──────────────────────────────────────────────────────
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = "index.html";
        return;
    }
 
    currentUser = user;
 
    // Load current user's own data
    try {
        const mySnap = await getDoc(doc(db, "users", user.uid));
        if (mySnap.exists()) currentUserData = mySnap.data();
    } catch (err) {
        console.error("Failed to load current user data:", err);
    }
 
    // Decide whose profile to show
    targetUid    = profileUid || user.uid;
    isOwnProfile = (targetUid === user.uid);
 
    // Load target profile
    try {
        const ref  = doc(db, "users", targetUid);
        const snap = await getDoc(ref);
 
        if (snap.exists()) {
            profileData = snap.data();
        } else if (isOwnProfile) {
            // First-time own profile — create it
            const name     = user.displayName || user.email.split("@")[0];
            const username = user.email.split("@")[0];
            profileData = {
                email:       user.email,
                displayName: name,
                username:    username,
                initials:    initials(name),
                bio:         "",
                followers:   [],
                following:   []
            };
            await setDoc(ref, profileData);
        } else {
            // Someone navigated to a uid that doesn't exist
            postsContainer.innerHTML = `<div style="color:#64748b;text-align:center;padding:40px;">User not found.</div>`;
            return;
        }
    } catch (err) {
        console.error("Failed to load profile:", err);
        return;
    }
 
    renderProfile();
    loadUserPosts();
});
 
// ── Render Profile ────────────────────────────────────────────
function renderProfile() {
    displayNameEl.textContent  = profileData.displayName || "No Name";
    displayUsername.textContent = "@" + (profileData.username || "username");
    displayBio.textContent      = profileData.bio || "No bio added yet.";
 
    // FIX 1: only show email on own profile
    if (displayEmail) {
        displayEmail.textContent = isOwnProfile ? (currentUser.email || "") : "";
    }
 
    avatar.textContent = profileData.initials || initials(profileData.displayName);
 
    const followers = profileData.followers || [];
    const following = profileData.following || [];
    followersCount.textContent = followers.length;
    followingCount.textContent = following.length;
 
    if (isOwnProfile) {
        editBtn.style.display   = "inline-flex";
        followBtn.style.display = "none";
    } else {
        editBtn.style.display   = "none";
        followBtn.style.display = "inline-flex";
 
        const amFollowing = followers.includes(currentUser.uid);
        followBtn.textContent = amFollowing ? "Following" : "Follow";
        followBtn.classList.toggle("following", amFollowing);
    }
}
 
// ── Load This User's Posts ────────────────────────────────────
async function loadUserPosts() {
    postsContainer.innerHTML = `<div style="color:#64748b;text-align:center;padding:30px;">Loading posts...</div>`;
 
    try {
        const q = query(
            collection(db, "posts"),
            where("uid", "==", targetUid),
            orderBy("createdAt", "desc")
        );
        const snap = await getDocs(q);
 
        if (snap.empty) {
            postsContainer.innerHTML = `<div style="color:#64748b;text-align:center;padding:40px;">No posts yet.</div>`;
            return;
        }
 
        postsContainer.innerHTML = "";
 
        snap.forEach(docSnap => {
            const post = docSnap.data();
            const id   = docSnap.id;
            postsContainer.appendChild(buildPostEl(id, post));
        });
    } catch (err) {
        console.error("Failed to load posts:", err);
        postsContainer.innerHTML = `<div style="color:#f43f5e;text-align:center;padding:40px;">Failed to load posts. Please refresh.</div>`;
    }
}
 
// ── Build post element ────────────────────────────────────────
// FIX 2: shared builder so profile posts look consistent and use correct user data
function buildPostEl(id, post) {
    const liked     = (post.likes || []).includes(currentUser.uid);
    const likeCount = (post.likes || []).length;
    const time      = post.createdAt
        ? new Date(post.createdAt.seconds * 1000).toLocaleString()
        : "Just now";
 
    // FIX 3: use data stored ON the post (displayName, username, initials)
    // so the correct author is always shown, even when viewing someone else's profile
    const authorName     = post.displayName || profileData.displayName || "Unknown";
    const authorUsername = post.username    || profileData.username    || "user";
    const authorInitials = post.initials    || profileData.initials    || initials(authorName);
 
    const el = document.createElement("div");
    el.className  = "post-item";
    el.dataset.id = id;
 
    el.innerHTML = `
        <div class="pi-header">
            <div class="pi-avatar">${escapeHTML(authorInitials)}</div>
            <div>
                <div class="pi-name">
                    <a href="profile.html?uid=${post.uid}" class="profile-link">${escapeHTML(authorName)}</a>
                </div>
                <div class="pi-username">@${escapeHTML(authorUsername)} · <span class="pi-time">${time}</span></div>
            </div>
        </div>
        <div class="pi-text">${escapeHTML(post.text)}</div>
        <div class="pi-actions">
            <button class="pi-like ${liked ? "liked" : ""}" data-id="${id}">
                ${liked ? "❤️" : "🤍"} <span>${likeCount}</span>
            </button>
            ${isOwnProfile ? `<button class="pi-delete" data-id="${id}">🗑 Delete</button>` : ""}
        </div>
    `;
 
    // FIX 4: optimistic like (no full reload) — same pattern as home.js
    el.querySelector(".pi-like").addEventListener("click", (e) => {
        e.stopPropagation();
        toggleLike(id, post.likes || [], el);
    });
 
    if (isOwnProfile) {
        el.querySelector(".pi-delete").addEventListener("click", () => deletePost(id, el));
    }
 
    return el;
}
 
// ── Like / Unlike (optimistic, no reload) ────────────────────
async function toggleLike(postId, currentLikes, postEl) {
    const uid   = currentUser.uid;
    const liked = currentLikes.includes(uid);
    const ref   = doc(db, "posts", postId);
    const btn   = postEl.querySelector(".pi-like");
 
    // Optimistic update
    let newLikes;
    if (liked) {
        newLikes = currentLikes.filter(i => i !== uid);
        btn.classList.remove("liked");
        btn.innerHTML = `🤍 <span>${newLikes.length}</span>`;
    } else {
        newLikes = [...currentLikes, uid];
        btn.classList.add("liked");
        btn.innerHTML = `❤️ <span>${newLikes.length}</span>`;
    }
 
    // Re-bind with new likes array
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
        // Roll back on error
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
 
// ── Delete Post ───────────────────────────────────────────────
async function deletePost(postId, el) {
    if (!confirm("Delete this post?")) return;
    try {
        await deleteDoc(doc(db, "posts", postId));
        el.remove();
    } catch (err) {
        console.error("Delete failed:", err);
        alert("Could not delete post. Please try again.");
    }
}
 
// ── Follow / Unfollow ─────────────────────────────────────────
followBtn.addEventListener("click", async () => {
    const targetRef   = doc(db, "users", targetUid);
    const myRef       = doc(db, "users", currentUser.uid);
    const amFollowing = (profileData.followers || []).includes(currentUser.uid);
 
    // FIX 5: disable button during async to prevent double-clicks
    followBtn.disabled = true;
 
    try {
        if (amFollowing) {
            await updateDoc(targetRef, { followers: arrayRemove(currentUser.uid) });
            await updateDoc(myRef,     { following: arrayRemove(targetUid) });
            profileData.followers = profileData.followers.filter(id => id !== currentUser.uid);
        } else {
            await updateDoc(targetRef, { followers: arrayUnion(currentUser.uid) });
            await updateDoc(myRef,     { following: arrayUnion(targetUid) });
            profileData.followers = [...(profileData.followers || []), currentUser.uid];
        }
        renderProfile();
    } catch (err) {
        console.error("Follow/unfollow failed:", err);
        alert("Action failed. Please try again.");
    } finally {
        followBtn.disabled = false;
    }
});
 
// ── Edit Profile ──────────────────────────────────────────────
editBtn.addEventListener("click", () => {
    inputName.value     = profileData.displayName || "";
    inputUsername.value = profileData.username    || "";
    inputBio.value      = profileData.bio         || "";
    editModal.classList.add("open");
});
 
cancelBtn.addEventListener("click", () => editModal.classList.remove("open"));
editModal.addEventListener("click", e => {
    if (e.target === editModal) editModal.classList.remove("open");
});
 
saveBtn.addEventListener("click", async () => {
    const name     = inputName.value.trim()                     || "No Name";
    const username = inputUsername.value.trim().replace("@", "") || "username";
    const bio      = inputBio.value.trim();
 
    const updated = { displayName: name, username, bio, initials: initials(name) };
 
    saveBtn.disabled    = true;
    saveBtn.textContent = "Saving...";
 
    try {
        await updateDoc(doc(db, "users", currentUser.uid), updated);
 
        // FIX 6: keep profileData in sync so renderProfile() is immediately correct
        profileData = { ...profileData, ...updated };
 
        // FIX 7: update existing posts in the DOM with new display name / initials
        // (posts already saved to Firestore keep their snapshot; only DOM is refreshed here)
        document.querySelectorAll(".pi-name a").forEach(a => {
            if (a.getAttribute("href") === `profile.html?uid=${currentUser.uid}`) {
                a.textContent = name;
            }
        });
        document.querySelectorAll(".pi-username").forEach(el => {
            if (el.closest(".post-item")) {
                const link = el.closest(".post-item").querySelector(".pi-name a");
                if (link && link.getAttribute("href") === `profile.html?uid=${currentUser.uid}`) {
                    // Replace only the @username part, leave the time intact
                    const timeEl = el.querySelector(".pi-time");
                    el.innerHTML = `@${escapeHTML(username)} · <span class="pi-time">${timeEl ? timeEl.textContent : ""}</span>`;
                }
            }
        });
 
        renderProfile();
        editModal.classList.remove("open");
    } catch (err) {
        alert("Save failed: " + err.message);
    } finally {
        saveBtn.disabled    = false;
        saveBtn.textContent = "Save";
    }
});
