importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyAaYwTeqt6vKXhPACWkY4TI6FyOyEfjCRU",
  authDomain: "bethelchurchny-d7fe8.firebaseapp.com",
  projectId: "bethelchurchny-d7fe8",
  storageBucket: "bethelchurchny-d7fe8.firebasestorage.app",
  messagingSenderId: "997624553119",
  appId: "1:997624553119:web:0bb079959565612ecbccaa"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title || 'Bethel Int\'l Church';
  const options = {
    body: payload.notification?.body || '',
    icon: '/logo.png',
    badge: '/logo.png'
  };
  self.registration.showNotification(title, options);
});
