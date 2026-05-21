import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

import {
getAuth,
GoogleAuthProvider,
signInWithPopup
}

from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

/* PASTE YOUR FIREBASE CONFIG BELOW */

const firebaseConfig = {

apiKey: "AIzaSyCjctNsRXjkVcmMqRYk7qwqWy1h7cLbbjE",
authDomain: "nexfounder-2422c.firebaseapp.com",
projectId: "nexfounder-2422c",
appId: "1:306339131826:web:2a6974010f4730c35fb4ab"

};

const app = initializeApp(firebaseConfig);

const auth = getAuth(app);

window.googleLogin = function(){

const provider = new GoogleAuthProvider();

signInWithPopup(auth, provider)

.then(() => {

alert("Login Successful");

window.location.href = "home.html";

})

.catch((error) => {

alert(error.message);

});

}
