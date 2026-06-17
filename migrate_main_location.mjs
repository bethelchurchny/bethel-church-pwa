import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, getDocs, query, where } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyAaYwTeqt6vKXhPACWkY4TI6FyOyEfjCRU",
  authDomain: "bethelchurchny-d7fe8.firebaseapp.com",
  projectId: "bethelchurchny-d7fe8",
  storageBucket: "bethelchurchny-d7fe8.firebasestorage.app",
  messagingSenderId: "997624553119",
  appId: "1:997624553119:web:0bb079959565612ecbccaa"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const existing = await getDocs(query(collection(db,'locations'), where('isMain','==',true)));
if(!existing.empty){
  console.log('Main Sanctuary already migrated, doc id:', existing.docs[0].id);
} else {
  const ref = await addDoc(collection(db,'locations'), {
    name:'Main Sanctuary',
    address:'87-07 Justice Ave, Elmhurst, NY 11373',
    lat:40.7375701,
    lng:-73.8761094,
    radiusM:100,
    isMain:true,
    createdAt:new Date().toISOString()
  });
  console.log('Migrated! New doc id:', ref.id);
}
process.exit(0);
