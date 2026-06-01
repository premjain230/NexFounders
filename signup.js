import { auth, db } from "./firebase.js";
import {
  createUserWithEmailAndPassword,
  sendEmailVerification
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
  doc,
  setDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

window.signup = async function () {
  const email = document.getElementById("signupEmail").value.trim();
  const password = document.getElementById("signupPassword").value;
  const name = document.getElementById("signupName").value.trim();

  if (!email || !password || !name) {
    alert("Please fill all fields.");
    return;
  }

  if (password.length < 6) {
    alert("Password must be at least 6 characters.");
    return;
  }

  try {
    const userCred = await createUserWithEmailAndPassword(
      auth,
      email,
      password
    );

    const user = userCred.user;
    const username = email.split("@")[0];

    await setDoc(doc(db, "users", user.uid), {
      email,
      displayName: name,
      username,
      initials: name.slice(0, 2).toUpperCase(),
      bio: "",
      photoURL: "",
      bannerURL: "",
      followers: [],
      following: [],
      connections: [],
      pendingConnections: [],
      sentConnections: [],
      emailVerified: false,
      createdAt: Date.now()
    });

    await sendEmailVerification(user);

    alert(
      "Verification email sent. Please check your inbox and verify your email before logging in."
    );

    await auth.signOut();

    window.location.href = "auth.html";

  } catch (error) {
    console.error(error);

    if (error.code === "auth/email-already-in-use") {
      alert("This email is already registered.");
    } else if (error.code === "auth/invalid-email") {
      alert("Invalid email address.");
    } else if (error.code === "auth/weak-password") {
      alert("Password is too weak.");
    } else {
      alert(error.message);
    }
  }
};
