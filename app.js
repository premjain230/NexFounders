import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
    getAuth,
    GoogleAuthProvider,
    signInWithEmailAndPassword,
    signInWithPopup
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
    getFirestore,
    doc,
    setDoc,
    getDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBbdi0sSpzKAj4c96sp2YtbHVWDf-q8Soc",
  authDomain: "nexfounder-2422c.firebaseapp.com",
  projectId: "nexfounder-2422c",
  storageBucket: "nexfounder-2422c.firebasestorage.app",
  messagingSenderId: "306339131826",
  appId: "1:306339131826:web:6b021aef860db0ad5fb4ab"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// ── Google Login ──────────────────────────────────────────────
window.googleLogin = async function () {
    try {
        const provider = new GoogleAuthProvider();
        const result = await signInWithPopup(auth, provider);
        const user = result.user;

        const ref = doc(db, "users", user.uid);
        const snap = await getDoc(ref);

        // Only create doc if it doesn't exist yet
        if (!snap.exists()) {
            const name = user.displayName || user.email.split("@")[0];
            const username = user.email.split("@")[0];
            await setDoc(ref, {
                email: user.email,
                displayName: name,
                username: username,
                initials: name.slice(0, 2).toUpperCase(),
                bio: "",
                followers: [],
                following: []
            });
        }

        window.location.href = "home.html";
    } catch (error) {
        alert(error.message);
    }
};

// ── Email Login ───────────────────────────────────────────────
window.emailLogin = async function () {
    const email    = document.getElementById("emailInput").value.trim();
    const password = document.getElementById("passwordInput").value;

    if (!email || !password) {
        alert("Please enter email and password.");
        return;
    }

    try {
        await signInWithEmailAndPassword(auth, email, password);
        window.location.href = "home.html";
    } catch (error) {
        alert(error.message);
    }
};
