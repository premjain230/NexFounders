import { auth, db } from "./firebase.js";
import { createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { doc, setDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

window.signup = async function () {
    const email    = document.getElementById("signupEmail").value.trim();
    const password = document.getElementById("signupPassword").value;
    const nameVal  = document.getElementById("signupName").value.trim();

    if (!email || !password || !nameVal) {
        alert("Please fill all fields.");
        return;
    }

    try {
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        const user = cred.user;
        const username = email.split("@")[0];

        await setDoc(doc(db, "users", user.uid), {
            email: email,
            displayName: nameVal,
            username: username,
            initials: nameVal.slice(0, 2).toUpperCase(),
            bio: "",
            followers: [],
            following: []
        });

        window.location.href = "home.html";
    } catch (error) {
        alert(error.message);
    }
};
