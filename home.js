import { auth, db } from "./firebase.js";

import {
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
    collection,
    addDoc,
    doc,
    getDoc,
    getDocs,
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
const mediaInput = document.getElementById("mediaInput");

const feedEl = document.getElementById("feed");

const navAvatar = document.getElementById("navAvatar");
const navName = document.getElementById("navName");

const searchInput = document.getElementById("searchInput");
const searchResults = document.getElementById("searchResults");

// ───────────────── AUTH ─────────────────

onAuthStateChanged(auth, async (user) => {

    if (!user) {
        location.href = "index.html";
        return;
    }

    currentUser = user;

    const userSnap = await getDoc(doc(db, "users", user.uid));

    if (userSnap.exists()) {

        currentUserData = userSnap.data();

        // NAV AVATAR
        if(currentUserData.photoURL){

            navAvatar.innerHTML = `
                <img
                    src="${currentUserData.photoURL}"
                    class="nav-avatar-img"
                >
            `;

        }else{

            navAvatar.textContent =
                currentUserData.initials || "?";
        }

        navName.textContent =
            currentUserData.displayName || "You";

        // CREATE AVATAR
        const createAvatar =
            document.getElementById("createAvatar");

        if (createAvatar) {

            if(currentUserData.photoURL){

                createAvatar.innerHTML = `
                    <img
                        src="${currentUserData.photoURL}"
                        class="nav-avatar-img"
                    >
                `;

            }else{

                createAvatar.textContent =
                    currentUserData.initials || "?";
            }
        }
    }

    loadFeedRealtime();
});

// ───────────────── CLOUDINARY ─────────────────

async function uploadToCloudinary(file) {

    const formData = new FormData();

    formData.append("file", file);

    formData.append(
        "upload_preset",
        "nexfounder_upload"
    );

    const response = await fetch(
        "https://api.cloudinary.com/v1_1/dr5uatib5/auto/upload",
        {
            method: "POST",
            body: formData
        }
    );

    const data = await response.json();

    return data.secure_url;
}

// ───────────────── CREATE POST ─────────────────

postBtn.addEventListener("click", async () => {

    const text = postInput.value.trim();

    if (!text && !mediaInput.files[0]) return;

    postBtn.disabled = true;
    postBtn.textContent = "Posting...";

    try {

        let imageUrl = "";
        let videoUrl = "";

        const file = mediaInput.files[0];

        if (file) {

            const uploadedUrl =
                await uploadToCloudinary(file);

            if (file.type.startsWith("image")) {
                imageUrl = uploadedUrl;
            }

            if (file.type.startsWith("video")) {
                videoUrl = uploadedUrl;
            }
        }

        await addDoc(collection(db, "posts"), {

            text,

            uid: currentUser.uid,

            displayName:
                currentUserData.displayName,

            username:
                currentUserData.username,

            initials:
                currentUserData.initials,

            photoURL:
                currentUserData.photoURL || "",

            likes: [],

            comments: [],

            imageUrl,

            videoUrl,

            createdAt: serverTimestamp()
        });

        postInput.value = "";
        mediaInput.value = "";

    } catch (error) {

        console.log(error);
        alert(error.message);
    }

    postBtn.disabled = false;
    postBtn.textContent = "Post";
});

// ───────────────── REALTIME FEED ─────────────────

function loadFeedRealtime() {

    const q = query(
        collection(db, "posts"),
        orderBy("createdAt", "desc")
    );

    onSnapshot(q, (snapshot) => {

        feedEl.innerHTML = "";

        if (snapshot.empty) {

            feedEl.innerHTML = `
                <div style="
                    padding:40px;
                    text-align:center;
                    color:#64748b;
                ">
                    No posts yet.
                </div>
            `;

            return;
        }

        snapshot.forEach((docSnap) => {

            const post = docSnap.data();
            const id = docSnap.id;

            const liked =
                (post.likes || []).includes(currentUser.uid);

            const likeCount =
                (post.likes || []).length;

            const comments =
                post.comments || [];

            const time = post.createdAt
                ? new Date(
                    post.createdAt.seconds * 1000
                  ).toLocaleString()
                : "Just now";

            const el = document.createElement("div");

            el.className = "post";

            el.innerHTML = `

                <div class="post-header">

                    <div class="post-avatar">

                        ${post.photoURL
                            ? `
                                <img
                                    src="${post.photoURL}"
                                    class="post-avatar-img"
                                >
                            `
                            : (post.initials || "?")
                        }

                    </div>

                    <div>

                        <div class="post-name">
                            <a href="profile.html?uid=${post.uid}"
                               class="profile-link">
                                ${post.displayName}
                            </a>
                        </div>

                        <div class="post-username">
                            @${post.username} · ${time}
                        </div>

                    </div>

                </div>

                <div class="post-text">
                    ${post.text || ""}
                </div>

                ${post.imageUrl ? `
                    <img
                        src="${post.imageUrl}"
                        class="post-image"
                    >
                ` : ""}

                ${post.videoUrl ? `
                    <video
                        src="${post.videoUrl}"
                        class="post-video"
                        controls
                    ></video>
                ` : ""}

                <div class="post-actions">

                    <button class="like-btn ${liked ? "liked" : ""}">
                        ${liked ? "❤️" : "🤍"}
                        ${likeCount}
                    </button>

                </div>

                <div class="comments-section">

                    <div class="comments-list">

                        ${comments.map(comment => `

                            <div class="comment">

                                <b>@${comment.username}</b>

                                ${comment.text}

                            </div>

                        `).join("")}

                    </div>

                    <div class="comment-input-wrap">

                        <input
                            type="text"
                            class="comment-input"
                            placeholder="Write a comment..."
                        >

                        <button class="comment-btn">
                            Post
                        </button>

                    </div>

                </div>
            `;

            // LIKE
            el.querySelector(".like-btn").onclick = () =>
                toggleLike(id, post.likes || []);

            // COMMENT
            const commentInput =
                el.querySelector(".comment-input");

            const commentBtn =
                el.querySelector(".comment-btn");

            commentBtn.onclick = async () => {

                const text = commentInput.value.trim();

                if (!text) return;

                await addComment(id, text);

                commentInput.value = "";
            };

            feedEl.appendChild(el);
        });
    });
}

// ───────────────── LIKE ─────────────────

async function toggleLike(postId, likes) {

    const ref = doc(db, "posts", postId);

    const liked =
        likes.includes(currentUser.uid);

    await updateDoc(ref, {

        likes: liked
            ? arrayRemove(currentUser.uid)
            : arrayUnion(currentUser.uid)
    });
}

// ───────────────── COMMENT ─────────────────

async function addComment(postId, text) {

    const ref = doc(db, "posts", postId);

    await updateDoc(ref, {

        comments: arrayUnion({

            uid: currentUser.uid,

            username:
                currentUserData.username,

            text: text
        })
    });
}

// ───────────────── SEARCH USERS ─────────────────

searchInput.addEventListener("input", async () => {

    const qText =
        searchInput.value.trim().toLowerCase();

    searchResults.innerHTML = "";

    if (!qText) {

        searchResults.style.display = "none";
        return;
    }

    const snap = await getDocs(collection(db, "users"));

    const matches = [];

    snap.forEach((d) => {

        const u = d.data();

        if (
            u.displayName?.toLowerCase().includes(qText) ||
            u.username?.toLowerCase().includes(qText)
        ) {
            matches.push({
                id: d.id,
                ...u
            });
        }
    });

    if (matches.length === 0) {

        searchResults.style.display = "none";
        return;
    }

    searchResults.style.display = "block";

    matches.forEach((u) => {

        const el = document.createElement("div");

        el.className = "search-result";

        el.innerHTML = `

            <div class="search-avatar">

                ${u.photoURL
                    ? `
                        <img
                            src="${u.photoURL}"
                            class="post-avatar-img"
                        >
                    `
                    : (u.initials || "?")
                }

            </div>

            <div>

                <div style="font-weight:600">
                    ${u.displayName}
                </div>

                <div style="
                    color:#71767b;
                    font-size:13px;
                ">
                    @${u.username}
                </div>

            </div>
        `;

        el.onclick = () => {
            location.href = `profile.html?uid=${u.id}`;
        };

        searchResults.appendChild(el);
    });
});

// ───────────────── CLOSE SEARCH ─────────────────

document.addEventListener("click", (e) => {

    if (
        !searchInput.contains(e.target) &&
        !searchResults.contains(e.target)
    ) {
        searchResults.style.display = "none";
    }
});
