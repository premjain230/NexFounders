import { initializeApp }
from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

import {
getAuth,
GoogleAuthProvider,
signInWithPopup
}
from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
getFirestore,
doc,
setDoc
}
from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

/* YOUR FIREBASE CONFIG */

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

window.googleLogin = async function(){

    try{

        const provider =
        new GoogleAuthProvider();

        // Google popup login
        const result =
        await signInWithPopup(
            auth,
            provider
        );

        const user = result.user;

        // create username
        let name =
        user.email.split("@")[0];

        // save profile in firestore
        await setDoc(
            doc(db, "users", user.uid),
            {

                email: user.email,

                displayName:
                user.displayName || name,

                username:
                "@" + name,

                initials:
                name
                .slice(0,2)
                .toUpperCase()

            }
        );

        alert("Login Successful");

        // go to profile page
        window.location.href =
        "home.html";

    }

    catch(error){

        alert(error.message);

    }

}
