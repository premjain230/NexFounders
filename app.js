import { auth, db } from "./firebase.js";
import {
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  signInWithPopup
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  doc, setDoc, getDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

window.googleLogin = async function () {
  try {
    const provider = new GoogleAuthProvider();
    const result = await signInWithPopup(auth, provider);
    const user = result.user;
    const ref = doc(db, "users", user.uid);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      const name = user.displayName || user.email.split("@")[0];
      const username = user.email.split("@")[0];
      await setDoc(ref, {
        email: user.email,
        displayName: name,
        username,
        initials: name.slice(0, 2).toUpperCase(),
        bio: "",
        photoURL: user.photoURL || "",
        bannerURL: "",
        followers: [],
        following: [],
        connections: [],
        pendingConnections: [],
        sentConnections: []
      });
    }
    window.location.href = "home.html";
  } catch (error) {
    alert(error.message);
  }
};

window.emailLogin = async function () {
  const email    = document.getElementById("emailInput").value.trim();
  const password = document.getElementById("passwordInput").value;
  if (!email || !password) { alert("Please enter email and password."); return; }
  try {
    await signInWithEmailAndPassword(auth, email, password);
    window.location.href = "home.html";
  } catch (error) {
    alert(error.message);
  }
};
