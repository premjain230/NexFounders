import { auth, db } from "./firebase.js";

import {
onAuthStateChanged
}
from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
doc,
getDoc
}
from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

onAuthStateChanged(auth, async (user) => {

    if(user){

        const docRef =
        doc(db, "users", user.uid);

        const docSnap =
        await getDoc(docRef);

        if(docSnap.exists()){

            let data = docSnap.data();

            document.querySelector(".name")
            .innerText = data.displayName;

            document.querySelector(".username")
            .innerText = data.username;

            document.querySelector(".profilepic")
            .innerText = data.initials;

        }

    }

    else{

        alert("Please Login");

        window.location.href = "index.html";

    }

});
