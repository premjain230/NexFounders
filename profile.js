import { auth, db } from "./firebase.js";
 
import {
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
 
import {
    doc,
    getDoc,
    updateDoc,
    arrayUnion,
    arrayRemove,
    setDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
 
// ── DOM refs ─────────────────────────────────────────────────
 
const avatar          = document.getElementById("avatar");
const displayName     = document.getElementById("displayName");
const displayUsername = document.getElementById("displayUsername");
const displayBio      = document.getElementById("displayBio");
const displayEmail    = document.getElementById("displayEmail");
 
const followersCount  = document.getElementById("followersCount");
const followingCount  = document.getElementById("followingCount");
 
const followBtn       = document.getElementById("followBtn");
const openEditBtn     = document.getElementById("openEditBtn");
const editModal       = document.getElementById("editModal");
const cancelBtn       = document.getElementById("cancelBtn");
const saveBtn         = document.getElementById("saveBtn");
 
const inputName       = document.getElementById("inputName");
const inputUsername   = document.getElementById("inputUsername");
const inputBio        = document.getElementById("inputBio");
 
// ── State ─────────────────────────────────────────────────────
 
let currentUser = null;
let profileData = null;
 
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
}
 
// ── Auth listener ─────────────────────────────────────────────
 
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = "index.html";
        return;
    }
 
    currentUser = user;
 
    const ref  = doc(db, "users", user.uid);
    const snap = await getDoc(ref);
 
    if (snap.exists()) {
        profileData = snap.data();
    } else {
        // First time — create the user doc from auth data
        const name = user.displayName || "New User";
        profileData = {
            displayName: name,
            username:    user.email.split("@")[0],
            bio:         "",
            initials:    initials(name),
            followers:   [],
            following:   []
        };
        await setDoc(ref, profileData);
    }
 
    renderProfile(profileData, user.email);
});
 
// ── Edit Profile ──────────────────────────────────────────────
 
openEditBtn.addEventListener("click", () => {
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
 
saveBtn.addEventListener("click", async () => {
    const name     = inputName.value.trim()                    || "No Name";
    const username = inputUsername.value.trim().replace("@","") || "username";
    const bio      = inputBio.value.trim();
 
    const updated = {
        displayName: name,
        username:    username,
        bio:         bio,
        initials:    initials(name)
    };
 
    try {
        await updateDoc(doc(db, "users", currentUser.uid), updated);
 
        // merge into local state and re-render
        profileData = { ...profileData, ...updated };
        renderProfile(profileData, currentUser.email);
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
    }
});
 
