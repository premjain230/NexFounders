import { auth, db } from "./firebase.js";

import {
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
    doc,
    getDoc,
    setDoc,
    updateDoc,
    collection,
    query,
    where,
    orderBy,
    arrayUnion,
    arrayRemove,
    onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

let currentUser;
let profileData;
let targetUid;
let isOwnProfile;

// ───────────────── DOM ─────────────────

const avatar = document.getElementById("avatar");
const displayName = document.getElementById("displayName");
const displayUsername = document.getElementById("displayUsername");
const displayBio = document.getElementById("displayBio");
const displayEmail = document.getElementById("displayEmail");

const followersCount = document.getElementById("followersCount");
const followingCount = document.getElementById("followingCount");

const followBtn = document.getElementById("followBtn");
const editBtn = document.getElementById("openEditBtn");

const editModal = document.getElementById("editModal");
const cancelBtn = document.getElementById("cancelBtn");
const saveBtn = document.getElementById("saveBtn");

const inputName = document.getElementById("inputName");
const inputUsername = document.getElementById("inputUsername");
const inputBio = document.getElementById("inputBio");

const postsContainer = document.getElementById("userPosts");

// ───────────────── HELPERS ─────────────────

function initials(name = "") {
    return name
        .split(" ")
        .map(word => word[0])
        .join("")
        .toUpperCase();
}

function showLoadingPosts() {
    postsContainer.innerHTML = `
        <div class="skeleton-post"></div>
        <div class="skeleton-post"></div>
        <div class="skeleton-post"></div>
    `;
}

function escapeHTML(str = "") {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
}

function formatTime(timestamp) {
    if (!timestamp?.seconds) return "now";

    const date = new Date(timestamp.seconds * 1000);

    return date.toLocaleDateString([], {
        month: "short",
        day: "numeric"
    });
}

// ───────────────── AUTH ─────────────────

onAuthStateChanged(auth, async (user) => {

    if (!user) {
        location.href = "index.html";
        return;
    }

    currentUser = user;

    const params = new URLSearchParams(location.search);

    targetUid = params.get("uid") || user.uid;

    isOwnProfile = targetUid === user.uid;

    const userRef = doc(db, "users", targetUid);

    const snap = await getDoc(userRef);

    // CREATE USER IF NOT EXISTS

    if (!snap.exists()) {

        const name = user.email.split("@")[0];

        profileData = {
            displayName: name,
            username: name,
            bio: "",
            initials: initials(name),
            followers: [],
            following: [],
            email: user.email
        };

        await setDoc(userRef, profileData);

    }

    // REALTIME PROFILE LISTENER

    onSnapshot(userRef, (docSnap) => {

        if (!docSnap.exists()) return;

        profileData = docSnap.data();

        renderProfile();

    });

    loadPostsRealtime();

});

// ───────────────── PROFILE UI ─────────────────

function renderProfile() {

    profileData.followers = profileData.followers || [];
    profileData.following = profileData.following || [];

    displayName.textContent = profileData.displayName || "Unknown";

    displayUsername.textContent =
        "@" + (profileData.username || "user");

    displayBio.textContent = profileData.bio || "";

    if (displayEmail) {
        displayEmail.textContent = profileData.email || "";
    }

    avatar.textContent =
        profileData.initials || initials(profileData.displayName);

    followersCount.textContent = profileData.followers.length;

    followingCount.textContent = profileData.following.length;

    // OWN PROFILE

    if (isOwnProfile) {

        editBtn.style.display = "inline-flex";
        followBtn.style.display = "none";

    }

    // OTHER PROFILE

    else {

        editBtn.style.display = "none";
        followBtn.style.display = "inline-flex";

        const isFollowing =
            profileData.followers.includes(currentUser.uid);

        followBtn.textContent =
            isFollowing ? "Following" : "Follow";

        followBtn.classList.toggle("following", isFollowing);

    }

}

// ───────────────── FOLLOW SYSTEM ─────────────────

followBtn.onclick = async () => {

    if (!currentUser) return;

    const userRef = doc(db, "users", targetUid);
    const myRef = doc(db, "users", currentUser.uid);

    const isFollowing =
        (profileData.followers || []).includes(currentUser.uid);

    followBtn.disabled = true;

    // OPTIMISTIC UI

    followBtn.textContent = isFollowing
        ? "Follow"
        : "Following";

    followBtn.classList.toggle("following", !isFollowing);

    try {

        // UPDATE TARGET USER FOLLOWERS

        await updateDoc(userRef, {
            followers: isFollowing
                ? arrayRemove(currentUser.uid)
                : arrayUnion(currentUser.uid)
        });

        // UPDATE MY FOLLOWING

        await updateDoc(myRef, {
            following: isFollowing
                ? arrayRemove(targetUid)
                : arrayUnion(targetUid)
        });

    }

    catch (err) {

        console.error("Follow error:", err);

        alert("Something went wrong.");

    }

    followBtn.disabled = false;

};

// ───────────────── EDIT PROFILE ─────────────────

editBtn.onclick = () => {

    inputName.value = profileData.displayName || "";
    inputUsername.value = profileData.username || "";
    inputBio.value = profileData.bio || "";

    editModal.classList.add("open");

};

cancelBtn.onclick = () => {

    editModal.classList.remove("open");

};

saveBtn.onclick = async () => {

    const name = inputName.value.trim();
    const username = inputUsername.value.trim();
    const bio = inputBio.value.trim();

    if (!name || !username) {
        alert("Name and username required.");
        return;
    }

    saveBtn.disabled = true;
    saveBtn.textContent = "Saving...";

    try {

        const updated = {
            displayName: name,
            username,
            bio,
            initials: initials(name)
        };

        await updateDoc(
            doc(db, "users", currentUser.uid),
            updated
        );

        editModal.classList.remove("open");

    }

    catch (err) {

        console.error(err);

        alert("Could not update profile.");

    }

    saveBtn.disabled = false;
    saveBtn.textContent = "Save";

};

// ───────────────── POSTS REALTIME ─────────────────

function loadPostsRealtime() {

    showLoadingPosts();

    const q = query(
        collection(db, "posts"),
        where("uid", "==", targetUid),
        orderBy("createdAt", "desc")
    );

    onSnapshot(q, (snapshot) => {

        if (snapshot.empty) {

            postsContainer.innerHTML = `
                <div class="empty-posts">
                    <div class="empty-icon">✦</div>
                    <h3>No posts yet</h3>
                    <p>This profile has not shared anything.</p>
                </div>
            `;

            return;

        }

        postsContainer.innerHTML = "";

        snapshot.forEach((docSnap) => {

            const post = docSnap.data();

            renderPost(post);

        });

    });

}

// ───────────────── RENDER POST ─────────────────

function renderPost(post) {

    const div = document.createElement("div");

    div.className = "profile-post-card";

    const header = document.createElement("div");
    header.className = "profile-post-header";

    const postAvatar = document.createElement("div");
    postAvatar.className = "profile-post-avatar";
    postAvatar.textContent =
        profileData.initials || initials(profileData.displayName);

    const meta = document.createElement("div");
    meta.className = "profile-post-meta";

    const top = document.createElement("div");
    top.className = "profile-post-top";

    const name = document.createElement("strong");
    name.textContent = profileData.displayName || "Unknown";

    const username = document.createElement("span");
    username.textContent =
        "@" + (profileData.username || "user");

    const dot = document.createElement("span");
    dot.textContent = "·";

    const time = document.createElement("span");
    time.textContent = formatTime(post.createdAt);

    top.append(name, username, dot, time);

    const text = document.createElement("div");
    text.className = "profile-post-text";
    text.textContent = post.text || "";

    meta.append(top, text);

    header.append(postAvatar, meta);

    div.appendChild(header);

    // IMAGE

    if (post.imageUrl) {

        const img = document.createElement("img");

        img.src = post.imageUrl;
        img.className = "profile-post-image";
        img.loading = "lazy";

        div.appendChild(img);

    }

    // VIDEO

    if (post.videoUrl) {

        const video = document.createElement("video");

        video.src = post.videoUrl;
        video.controls = true;
        video.className = "profile-post-video";

        div.appendChild(video);

    }

    // ACTIONS

    const actions = document.createElement("div");
    actions.className = "profile-post-actions";

    actions.innerHTML = `
        <button>♡ Like</button>
        <button>💬 Comment</button>
        <button>↗ Share</button>
    `;

    div.appendChild(actions);

    postsContainer.appendChild(div);

}
