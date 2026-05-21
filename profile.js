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
arrayRemove,
deleteDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

let currentUser = null;
let profileData = null;
let targetUid = null;
let isOwnProfile = false;

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
const name = user.displayName || user.email.split("@")[0];

profileData = {
displayName: name,
username: user.email.split("@")[0],
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
displayName.textContent = profileData.displayName;
displayUsername.textContent = "@" + profileData.username;
displayBio.textContent = profileData.bio || "";
displayEmail.textContent = isOwnProfile ? currentUser.email : "";
avatar.textContent = profileData.initials;

const followers = profileData.followers || [];
const following = profileData.following || [];

followersCount.textContent = followers.length;
followingCount.textContent = following.length;

if (isOwnProfile) {
editBtn.style.display = "inline-block";
followBtn.style.display = "none";
} else {
editBtn.style.display = "none";
followBtn.style.display = "inline-block";

const isFollowing = followers.includes(currentUser.uid);

followBtn.textContent = isFollowing ? "Following" : "Follow";
followBtn.classList.toggle("following", isFollowing);
}
}

followBtn.onclick = async () => {
const userRef = doc(db, "users", targetUid);
const myRef = doc(db, "users", currentUser.uid);

const isFollowing = (profileData.followers || []).includes(currentUser.uid);

if (isFollowing) {
await updateDoc(userRef, {
followers: arrayRemove(currentUser.uid)
});
await updateDoc(myRef, {
following: arrayRemove(targetUid)
});
profileData.followers = profileData.followers.filter(id => id !== currentUser.uid);
} else {
await updateDoc(userRef, {
followers: arrayUnion(currentUser.uid)
});
await updateDoc(myRef, {
following: arrayUnion(targetUid)
});
profileData.followers.push(currentUser.uid);
}

renderProfile();
};

editBtn.onclick = () => {
inputName.value = profileData.displayName;
inputUsername.value = profileData.username;
inputBio.value = profileData.bio;

editModal.classList.add("open");
};

cancelBtn.onclick = () => {
editModal.classList.remove("open");
};

saveBtn.onclick = async () => {
const name = inputName.value;
const username = inputUsername.value;
const bio = inputBio.value;

const updated = {
displayName: name,
username,
bio,
initials: initials(name)
};

await updateDoc(doc(db, "users", currentUser.uid), updated);

profileData = { ...profileData, ...updated };

editModal.classList.remove("open");
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

snap.forEach(docSnap => {
const post = docSnap.data();

const div = document.createElement("div");
div.innerHTML = `
<p>${post.text}</p>
<hr>
`;
postsContainer.appendChild(div);
});
}
