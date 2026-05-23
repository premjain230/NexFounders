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

// ───────────────── CLOUDINARY ─────────────────

const CLOUD_NAME = "dr5uatib5";
const UPLOAD_PRESET = "nexfounder_upload";

async function uploadToCloudinary(file) {

    const url =
        `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`;

    const formData = new FormData();

    formData.append("file", file);

    formData.append(
        "upload_preset",
        UPLOAD_PRESET
    );

    const res = await fetch(url, {
        method: "POST",
        body: formData
    });

    const data = await res.json();

    return data.secure_url;
}

// ───────────────── STATE ─────────────────

let currentUser;
let profileData;
let targetUid;
let isOwnProfile;

// ───────────────── DOM ─────────────────

const avatar =
    document.getElementById("avatar");

const banner =
    document.getElementById("banner");

const avatarInput =
    document.getElementById("avatarInput");

const bannerInput =
    document.getElementById("bannerInput");

const displayName =
    document.getElementById("displayName");

const displayUsername =
    document.getElementById("displayUsername");

const displayBio =
    document.getElementById("displayBio");

const displayEmail =
    document.getElementById("displayEmail");

const followersCount =
    document.getElementById("followersCount");

const followingCount =
    document.getElementById("followingCount");

const followBtn =
    document.getElementById("followBtn");

const editBtn =
    document.getElementById("openEditBtn");

const editModal =
    document.getElementById("editModal");

const cancelBtn =
    document.getElementById("cancelBtn");

const saveBtn =
    document.getElementById("saveBtn");

const inputName =
    document.getElementById("inputName");

const inputUsername =
    document.getElementById("inputUsername");

const inputBio =
    document.getElementById("inputBio");

const postsContainer =
    document.getElementById("userPosts");

// ───────────────── OPEN FILE PICKERS ─────────────────

// PROFILE PIC CLICK
avatar?.addEventListener("click", () => {

    if (!isOwnProfile) return;

    avatarInput.click();

});

// BANNER CLICK
banner?.addEventListener("click", () => {

    if (!isOwnProfile) return;

    bannerInput.click();

});

// ───────────────── HELPERS ─────────────────

function initials(name = "") {

    return name
        .split(" ")
        .map(w => w[0])
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

function formatTime(timestamp) {

    if (!timestamp?.seconds)
        return "now";

    return new Date(
        timestamp.seconds * 1000
    ).toLocaleDateString();

}

// ───────────────── AUTH ─────────────────

onAuthStateChanged(auth, async (user) => {

    if (!user) {

        location.href = "index.html";

        return;

    }

    currentUser = user;

    const params =
        new URLSearchParams(location.search);

    targetUid =
        params.get("uid") || user.uid;

    isOwnProfile =
        targetUid === user.uid;

    const userRef =
        doc(db, "users", targetUid);

    const snap =
        await getDoc(userRef);

    // CREATE USER IF NOT EXISTS

    if (!snap.exists()) {

        const name =
            user.email.split("@")[0];

        profileData = {

            displayName: name,

            username: name,

            bio: "",

            initials: initials(name),

            followers: [],

            following: [],

            email: user.email,

            photoURL: "",

            bannerURL: ""

        };

        await setDoc(
            userRef,
            profileData
        );

    }

    // REALTIME LISTENER

    onSnapshot(userRef, (docSnap) => {

        if (!docSnap.exists())
            return;

        profileData =
            docSnap.data();

        renderProfile();

    });

    loadPostsRealtime();

});

// ───────────────── PROFILE UI ─────────────────

function renderProfile() {

    profileData.followers =
        profileData.followers || [];

    profileData.following =
        profileData.following || [];

    // TEXT

    displayName.textContent =
        profileData.displayName || "Unknown";

    displayUsername.textContent =
        "@" + (
            profileData.username || "user"
        );

    displayBio.textContent =
        profileData.bio || "";

    displayEmail.textContent =
        profileData.email || "";

    // COUNTS

    followersCount.textContent =
        profileData.followers.length;

    followingCount.textContent =
        profileData.following.length;

    // PROFILE PIC

    if (profileData.photoURL) {

        avatar.style.backgroundImage =
            `url(${profileData.photoURL})`;

        avatar.style.backgroundSize =
            "cover";

        avatar.style.backgroundPosition =
            "center";

        avatar.textContent = "";

    }

    else {

        avatar.style.backgroundImage = "";

        avatar.textContent =
            initials(profileData.displayName);

    }

    // BANNER

    if (
        profileData.bannerURL &&
        banner
    ) {

        banner.style.backgroundImage =
            `url(${profileData.bannerURL})`;

        banner.style.backgroundSize =
            "cover";

        banner.style.backgroundPosition =
            "center";

    }

    // OWN PROFILE

    if (isOwnProfile) {

        editBtn.style.display =
            "inline-flex";

        followBtn.style.display =
            "none";

    }

    // OTHER PROFILE

    else {

        editBtn.style.display =
            "none";

        followBtn.style.display =
            "inline-flex";

        const isFollowing =
            profileData.followers.includes(
                currentUser.uid
            );

        followBtn.textContent =
            isFollowing
                ? "Following"
                : "Follow";

        followBtn.classList.toggle(
            "following",
            isFollowing
        );

    }

}

// ───────────────── PROFILE PIC UPLOAD ─────────────────

avatarInput?.addEventListener(
    "change",
    async (e) => {

        const file =
            e.target.files[0];

        if (!file) return;

        try {

            avatar.style.opacity = "0.5";

            const url =
                await uploadToCloudinary(file);

            await updateDoc(
                doc(
                    db,
                    "users",
                    currentUser.uid
                ),
                {
                    photoURL: url
                }
            );

        }

        catch (err) {

            console.error(err);

            alert(
                "Failed to upload profile picture"
            );

        }

        avatar.style.opacity = "1";

    }
);

// ───────────────── BANNER UPLOAD ─────────────────

bannerInput?.addEventListener(
    "change",
    async (e) => {

        const file =
            e.target.files[0];

        if (!file) return;

        try {

            banner.style.opacity = "0.6";

            const url =
                await uploadToCloudinary(file);

            await updateDoc(
                doc(
                    db,
                    "users",
                    currentUser.uid
                ),
                {
                    bannerURL: url
                }
            );

        }

        catch (err) {

            console.error(err);

            alert(
                "Failed to upload banner"
            );

        }

        banner.style.opacity = "1";

    }
);

// ───────────────── FOLLOW SYSTEM ─────────────────

followBtn.onclick = async () => {

    const userRef =
        doc(db, "users", targetUid);

    const myRef =
        doc(db, "users", currentUser.uid);

    const isFollowing =
        (
            profileData.followers || []
        ).includes(currentUser.uid);

    followBtn.disabled = true;

    try {

        // TARGET USER

        await updateDoc(userRef, {

            followers: isFollowing

                ? arrayRemove(
                    currentUser.uid
                )

                : arrayUnion(
                    currentUser.uid
                )

        });

        // MY ACCOUNT

        await updateDoc(myRef, {

            following: isFollowing

                ? arrayRemove(
                    targetUid
                )

                : arrayUnion(
                    targetUid
                )

        });

    }

    catch (err) {

        console.error(err);

        alert(
            "Error following user"
        );

    }

    followBtn.disabled = false;

};

// ───────────────── EDIT PROFILE ─────────────────

editBtn.onclick = () => {

    inputName.value =
        profileData.displayName || "";

    inputUsername.value =
        profileData.username || "";

    inputBio.value =
        profileData.bio || "";

    editModal.classList.add("open");

};

cancelBtn.onclick = () => {

    editModal.classList.remove("open");

};

saveBtn.onclick = async () => {

    const name =
        inputName.value.trim();

    const username =
        inputUsername.value.trim();

    const bio =
        inputBio.value.trim();

    if (!name || !username) {

        alert(
            "Fill required fields"
        );

        return;

    }

    saveBtn.disabled = true;

    saveBtn.textContent =
        "Saving...";

    try {

        await updateDoc(
            doc(
                db,
                "users",
                currentUser.uid
            ),
            {

                displayName: name,

                username,

                bio,

                initials:
                    initials(name)

            }
        );

        editModal.classList.remove(
            "open"
        );

    }

    catch (err) {

        console.error(err);

        alert("Update failed");

    }

    saveBtn.disabled = false;

    saveBtn.textContent = "Save";

};

// ───────────────── POSTS ─────────────────

function loadPostsRealtime() {

    showLoadingPosts();

    const q = query(

        collection(db, "posts"),

        where(
            "uid",
            "==",
            targetUid
        ),

        orderBy(
            "createdAt",
            "desc"
        )

    );

    onSnapshot(q, (snapshot) => {

        // EMPTY

        if (snapshot.empty) {

            postsContainer.innerHTML = `
                <div class="empty">
                    No posts yet
                </div>
            `;

            return;

        }

        postsContainer.innerHTML = "";

        snapshot.forEach((docSnap) => {

            renderPost(
                docSnap.data()
            );

        });

    });

}

// ───────────────── RENDER POST ─────────────────

function renderPost(post) {

    const div =
        document.createElement("div");

    div.className =
        "profile-post-card";

    div.innerHTML = `

        <div style="
            background:#0f172a;
            border:1px solid #1e293b;
            border-radius:20px;
            padding:18px;
            margin-bottom:18px;
        ">

            <div style="
                display:flex;
                align-items:center;
                gap:12px;
                margin-bottom:12px;
            ">

                <div style="
                    width:46px;
                    height:46px;
                    border-radius:50%;
                    background:${
                        post.photoURL
                            ? `url(${post.photoURL}) center/cover`
                            : "#2563eb"
                    };
                    display:flex;
                    align-items:center;
                    justify-content:center;
                    font-weight:700;
                    overflow:hidden;
                ">

                    ${
                        post.photoURL
                            ? ""
                            : (
                                profileData.initials ||
                                "?"
                              )
                    }

                </div>

                <div>

                    <div style="
                        font-weight:700;
                        font-size:15px;
                    ">
                        ${
                            profileData.displayName
                        }
                    </div>

                    <div style="
                        color:#64748b;
                        font-size:13px;
                    ">
                        @${profileData.username}
                        ·
                        ${formatTime(post.createdAt)}
                    </div>

                </div>

            </div>

            <div style="
                color:#e2e8f0;
                line-height:1.6;
                font-size:15px;
            ">
                ${post.text || ""}
            </div>

            ${
                post.imageUrl
                    ? `
                    <img
                        src="${post.imageUrl}"
                        style="
                            width:100%;
                            margin-top:14px;
                            border-radius:16px;
                            border:1px solid #1e293b;
                            max-height:500px;
                            object-fit:cover;
                        "
                    >
                `
                    : ""
            }

            ${
                post.videoUrl
                    ? `
                    <video
                        src="${post.videoUrl}"
                        controls
                        style="
                            width:100%;
                            margin-top:14px;
                            border-radius:16px;
                            border:1px solid #1e293b;
                        "
                    ></video>
                `
                    : ""
            }

        </div>

    `;

    postsContainer.appendChild(div);

}
