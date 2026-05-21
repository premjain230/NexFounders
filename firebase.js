// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyBbdi0sSpzKAj4c96sp2YtbHVWDf-q8Soc",
  authDomain: "nexfounder-2422c.firebaseapp.com",
  projectId: "nexfounder-2422c",
  storageBucket: "nexfounder-2422c.firebasestorage.app",
  messagingSenderId: "306339131826",
  appId: "1:306339131826:web:6b021aef860db0ad5fb4ab",
  measurementId: "G-VZ5FHYBHTS"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);