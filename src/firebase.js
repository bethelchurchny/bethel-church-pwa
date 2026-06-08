import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyAaYwTeqt6vKXhPACWkY4TI6FyOyEfjCRU",
  authDomain: "bethelchurchny-d7fe8.firebaseapp.com",
  projectId: "bethelchurchny-d7fe8",
  storageBucket: "bethelchurchny-d7fe8.firebasestorage.app",
  messagingSenderId: "997624553119",
  appId: "1:997624553119:web:0bb079959565612ecbccaa"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export default app;
