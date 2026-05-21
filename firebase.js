import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBbdi0sSpzKAj4c96sp2YtbHVWDf-q8Soc",
  authDomain: "nexfounder-2422c.firebaseapp.com",
  projectId: "nexfounder-2422c",
  storageBucket: "nexfounder-2422c.firebasestorage.app",
  messagingSenderId: "306339131826",
  appId: "1:306339131826:web:6b021aef860db0ad5fb4ab"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
