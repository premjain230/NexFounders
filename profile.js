import { auth, db } from "./firebase.js";
 
import {
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
 
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
    setDoc
    deleteDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
 
// ── DOM refs ─────────────────────────────────────────────────
 

// ── URL param: whose profile? ─────────────────────────────────
const params     = new URLSearchParams(window.location.search);
const profileUid = params.get("uid"); // null = own profile

let currentUser = null;
let currentUserData = null;
let profileData = null;
let targetUid   = null;
let isOwnProfile = false;

// ── DOM refs ──────────────────────────────────────────────────
const avatar          = document.getElementById("avatar");
const displayName     = document.getElementById("displayName");
const displayUsername = document.getElementById("displayUsername");
const displayBio      = document.getElementById("displayBio");
const displayEmail    = document.getElementById("displayEmail");
 
const followersCount  = document.getElementById("followersCount");
const followingCount  = document.getElementById("followingCount");
 
const followBtn       = document.getElementById("followBtn");
const openEditBtn     = document.getElementById("openEditBtn");
const editBtn         = document.getElementById("openEditBtn");
const editModal       = document.getElementById("editModal");
const cancelBtn       = document.getElementById("cancelBtn");
const saveBtn         = document.getElementById("saveBtn");
 
const inputName       = document.getElementById("inputName");
const inputUsername   = document.getElementById("inputUsername");
const inputBio        = document.getElementById("inputBio");
 
// ── State ─────────────────────────────────────────────────────
 
let currentUser = null;
let profileData = null;
 
const postsContainer  = document.getElementById("userPosts");

// ── Helpers ───────────────────────────────────────────────────
 
function initials(name) {
    return (name || "?")
        .split(" ")
        .map(w => w[0])
        .join("")
        .slice(0, 2)
        .toUpperCase();
}
 
function renderProfile(data, email) {
    displayName.textContent     = data.displayName  || "No Name";
    displayUsername.textContent = "@" + (data.username || "username");
    displayBio.textContent      = data.bio          || "No bio added yet.";
    displayEmail.textContent    = email             || "";
    avatar.textContent          = data.initials     || initials(data.displayName);
 
    const followers = data.followers || [];
    const following = data.following || [];
 
    followersCount.textContent = followers.length;
    followingCount.textContent = following.length;
 
    // follow button state — if current user is in their own following list
    if (following.includes(currentUser.uid)) {
        followBtn.textContent = "Following";
        followBtn.classList.add("following");
    } else {
        followBtn.textContent = "Follow";
        followBtn.classList.remove("following");
    }
    return (name || "?").split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
}
 
// ── Auth listener ─────────────────────────────────────────────
 

// ── Auth ──────────────────────────────────────────────────────
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = "index.html";
        return;
    }
 

    currentUser = user;
 
    const ref  = doc(db, "users", user.uid);

    // Load current user's own data
    const mySnap = await getDoc(doc(db, "users", user.uid));
    if (mySnap.exists()) currentUserData = mySnap.data();

    // Decide whose profile to show
    targetUid    = profileUid || user.uid;
    isOwnProfile = (targetUid === user.uid);

    // Load target profile
    const ref  = doc(db, "users", targetUid);
    const snap = await getDoc(ref);
 

    if (snap.exists()) {
        profileData = snap.data();
    } else {
        // First time — create the user doc from auth data
        const name = user.displayName || "New User";
        // Own profile, first time
        const name     = user.displayName || user.email.split("@")[0];
        const username = user.email.split("@")[0];
        profileData = {
            email: user.email,
            displayName: name,
            username:    user.email.split("@")[0],
            bio:         "",
            initials:    initials(name),
            followers:   [],
            following:   []
            username: username,
            initials: initials(name),
            bio: "",
            followers: [],
            following: []
        };
        await setDoc(ref, profileData);
    }
 
    renderProfile(profileData, user.email);

    renderProfile();
    loadUserPosts();
});
 

// ── Render Profile ────────────────────────────────────────────
function renderProfile() {
    displayName.textContent     = profileData.displayName || "No Name";
    displayUsername.textContent = "@" + (profileData.username || "username");
    displayBio.textContent      = profileData.bio || "No bio added yet.";
    displayEmail.textContent    = isOwnProfile ? (currentUser.email || "") : "";
    avatar.textContent          = profileData.initials || initials(profileData.displayName);

    const followers = profileData.followers || [];
    const following = profileData.following || [];

    followersCount.textContent = followers.length;
    followingCount.textContent = following.length;

    // Show/hide edit vs follow button
    if (isOwnProfile) {
        editBtn.style.display    = "inline-flex";
        followBtn.style.display  = "none";
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
        const post  = docSnap.data();
        const id    = docSnap.id;
        const liked = (post.likes || []).includes(currentUser.uid);
        const time  = post.createdAt
            ? new Date(post.createdAt.seconds * 1000).toLocaleString()
            : "Just now";

        const el = document.createElement("div");
        el.className = "post-item";
        el.innerHTML = `
            <div class="pi-text">${post.text}</div>
            <div class="pi-meta">${time}</div>
            <div class="pi-actions">
                <button class="pi-like ${liked ? 'liked' : ''}" data-id="${id}">
                    ${liked ? '❤️' : '🤍'} ${(post.likes || []).length}
                </button>
                ${isOwnProfile ? `<button class="pi-delete" data-id="${id}">🗑 Delete</button>` : ''}
            </div>
        `;

        el.querySelector(".pi-like").addEventListener("click", () => toggleLike(id, post.likes || []));
        if (isOwnProfile) {
            el.querySelector(".pi-delete").addEventListener("click", () => deletePost(id, el));
        }

        postsContainer.appendChild(el);
    });
}

// ── Like ──────────────────────────────────────────────────────
async function toggleLike(postId, currentLikes) {
    const ref   = doc(db, "posts", postId);
    const liked = currentLikes.includes(currentUser.uid);
    if (liked) {
        await updateDoc(ref, { likes: arrayRemove(currentUser.uid) });
    } else {
        await updateDoc(ref, { likes: arrayUnion(currentUser.uid) });
    }
    loadUserPosts();
}

// ── Delete Post ───────────────────────────────────────────────
async function deletePost(postId, el) {
    if (!confirm("Delete this post?")) return;
    await deleteDoc(doc(db, "posts", postId));
    el.remove();
}

// ── Follow / Unfollow ─────────────────────────────────────────
followBtn.addEventListener("click", async () => {
    const targetRef  = doc(db, "users", targetUid);
    const myRef      = doc(db, "users", currentUser.uid);
    const amFollowing = (profileData.followers || []).includes(currentUser.uid);

    if (amFollowing) {
        // Unfollow
        await updateDoc(targetRef, { followers: arrayRemove(currentUser.uid) });
        await updateDoc(myRef,     { following: arrayRemove(targetUid) });
        profileData.followers = profileData.followers.filter(id => id !== currentUser.uid);
    } else {
        // Follow
        await updateDoc(targetRef, { followers: arrayUnion(currentUser.uid) });
        await updateDoc(myRef,     { following: arrayUnion(targetUid) });
        profileData.followers = [...(profileData.followers || []), currentUser.uid];
    }

    renderProfile();
});

// ── Edit Profile ──────────────────────────────────────────────
 
openEditBtn.addEventListener("click", () => {
editBtn.addEventListener("click", () => {
    inputName.value     = profileData.displayName || "";
    inputUsername.value = profileData.username    || "";
    inputBio.value      = profileData.bio         || "";
    editModal.classList.add("open");
});
 
cancelBtn.addEventListener("click", () => {
    editModal.classList.remove("open");
});
 
editModal.addEventListener("click", (e) => {
    if (e.target === editModal) editModal.classList.remove("open");
});
 

cancelBtn.addEventListener("click", () => editModal.classList.remove("open"));
editModal.addEventListener("click", e => { if (e.target === editModal) editModal.classList.remove("open"); });

saveBtn.addEventListener("click", async () => {
    const name     = inputName.value.trim()                    || "No Name";
    const name     = inputName.value.trim()                     || "No Name";
    const username = inputUsername.value.trim().replace("@","") || "username";
    const bio      = inputBio.value.trim();
 
    const updated = {
        displayName: name,
        username:    username,
        bio:         bio,
        initials:    initials(name)
    };
 

    const updated = { displayName: name, username, bio, initials: initials(name) };

    try {
        await updateDoc(doc(db, "users", currentUser.uid), updated);
 
        // merge into local state and re-render
        profileData = { ...profileData, ...updated };
        renderProfile(profileData, currentUser.email);
        renderProfile();
        editModal.classList.remove("open");
    } catch (err) {
        console.error("Save failed:", err);
        alert("Failed to save. Please try again.");
    }
});
 
// ── Follow / Unfollow ─────────────────────────────────────────
// For now this toggles following yourself (placeholder until
// you build a multi-user feed where you visit other profiles).
// When you build that, pass the TARGET user's uid here instead.
 
followBtn.addEventListener("click", async () => {
    const ref = doc(db, "users", currentUser.uid);
    const isFollowing = followBtn.classList.contains("following");
 
    try {
        if (isFollowing) {
            await updateDoc(ref, {
                following: arrayRemove(currentUser.uid)
            });
            profileData.following = (profileData.following || []).filter(id => id !== currentUser.uid);
        } else {
            await updateDoc(ref, {
                following: arrayUnion(currentUser.uid)
            });
            profileData.following = [...(profileData.following || []), currentUser.uid];
        }
        renderProfile(profileData, currentUser.email);
    } catch (err) {
        console.error("Follow failed:", err);
        alert("Save failed: " + err.message);
    }
});
