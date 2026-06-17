import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';

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
export const storage = getStorage(app);
export const VAPID_KEY = 'BOPeyv-RELcdGnZ1NPMcxRG1jWoUGktD1eCzCD2MWIbzrS92g9b4uVEHaOYOBu31WSL1aMpMMYmqtPX08fHAQdc';

let messaging = null;
try {
  messaging = getMessaging(app);
} catch(e) {
  console.log('Messaging not supported:', e);
}

export { messaging, getToken, onMessage };
export default app;
