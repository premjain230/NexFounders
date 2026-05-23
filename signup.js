import { auth, db } from "./firebase.js";
import { createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { doc, setDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

window.signup = async function () {
  const email    = document.getElementById("signupEmail").value.trim();
  const password = document.getElementById("signupPassword").value;
  const name     = document.getElementById("signupName").value.trim();
  if (!email || !password || !name) { alert("Fill all fields"); return; }
  try {
    const userCred = await createUserWithEmailAndPassword(auth, email, password);
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
      sentConnections: []
    });
    window.location.href = "home.html";
  } catch (error) {
    alert(error.message);
  }
};
