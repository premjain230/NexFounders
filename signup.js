import { auth, db } from "./firebase.js";

import {
createUserWithEmailAndPassword
}
from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
doc,
setDoc
}
from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

window.signup = async function(){

    const email =
    document.getElementById("email").value;

    const password =
    document.getElementById("password").value;

    try{

        const userCredential =
        await createUserWithEmailAndPassword(
            auth,
            email,
            password
        );

        const user = userCredential.user;

        // 🔥 name from email
        let name = email.split("@")[0];

        // 🔥 save profile
        await setDoc(doc(db, "users", user.uid), {

            email: email,

            displayName: name,

            username: "@" + name,

            initials: name
            .slice(0,2)
            .toUpperCase()

        });

        alert("Account Created!");

        window.location.href =
        "profile.html";

    }

    catch(error){

        alert(error.message);

    }

}