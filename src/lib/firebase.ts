import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyDmPQzTSbJa-WVTcDnH1rC9gaUmNdmR4HU",
  authDomain: "cricauctionipl.firebaseapp.com",
  projectId: "cricauctionipl",
  storageBucket: "cricauctionipl.firebasestorage.app",
  messagingSenderId: "996209897930",
  appId: "1:996209897930:web:474f858ed82c34499cdf33",

};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const auth = getAuth(app);
