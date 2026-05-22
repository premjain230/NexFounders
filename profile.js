import { auth, db } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
    doc,
    getDoc,
    setDoc,
    updateDoc,
    collection,
    query,
    where,
    orderBy,
    getDocs,
    arrayUnion,
    arrayRemove
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

let currentUser;
let profileData;
let targetUid;
let isOwnProfile;

// DOM
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

function initials(name = "") {
    return name.split(" ").map(w => w[0]).join("").toUpperCase();
}

onAuthStateChanged(auth, async (user) => {
    if (!user) return (location.href = "index.html");

    currentUser = user;

    const params = new URLSearchParams(location.search);
    targetUid = params.get("uid") || user.uid;

    isOwnProfile = targetUid === user.uid;

    const ref = doc(db, "users", targetUid);
    const snap = await getDoc(ref);

    if (!snap.exists()) {
        const name = user.email.split("@")[0];

        profileData = {
            displayName: name,
            username: name,
            bio: "",
            initials: initials(name),
            followers: [],
            following: []
        };

        await setDoc(ref, profileData);
    } else {
        profileData = snap.data();
    }

    renderProfile();
    loadPosts();
});

function renderProfile() {
    profileData.followers = profileData.followers || [];
    profileData.following = profileData.following || [];

    displayName.textContent = profileData.displayName;
    displayUsername.textContent = "@" + profileData.username;
    displayBio.textContent = profileData.bio || "";
    avatar.textContent = profileData.initials;

    followersCount.textContent = profileData.followers.length;
    followingCount.textContent = profileData.following.length;

    if (isOwnProfile) {
        editBtn.style.display = "inline-block";
        followBtn.style.display = "none";
    } else {
        editBtn.style.display = "none";
        followBtn.style.display = "inline-block";

        const isFollowing = profileData.followers.includes(currentUser.uid);

        followBtn.textContent = isFollowing ? "Following" : "Follow";
    }
}

followBtn.onclick = async () => {
    const userRef = doc(db, "users", targetUid);
    const myRef = doc(db, "users", currentUser.uid);

    const isFollowing = profileData.followers.includes(currentUser.uid);

    await updateDoc(userRef, {
        followers: isFollowing
            ? arrayRemove(currentUser.uid)
            : arrayUnion(currentUser.uid)
    });

    await updateDoc(myRef, {
        following: isFollowing
            ? arrayRemove(targetUid)
            : arrayUnion(targetUid)
    });

    profileData.followers = isFollowing
        ? profileData.followers.filter(id => id !== currentUser.uid)
        : [...profileData.followers, currentUser.uid];

    renderProfile();
};

async function loadPosts() {
    postsContainer.innerHTML = "Loading...";

    const q = query(
        collection(db, "posts"),
        where("uid", "==", targetUid),
        orderBy("createdAt", "desc")
    );

    const snap = await getDocs(q);

    if (snap.empty) {
        postsContainer.innerHTML = "No posts yet.";
        return;
    }

    postsContainer.innerHTML = "";

    snap.forEach(doc => {
        const post = doc.data();

        const div = document.createElement("div");
        div.className = "post";
        div.innerHTML = `
            <div class="post-text">${post.text}</div>
        `;

        postsContainer.appendChild(div);
    });
}
