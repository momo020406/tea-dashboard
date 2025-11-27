// firebase-messaging-sw.js
importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyBBZ3kaJdRJA26htneGlCxQWJHcGH6IDMQ",
  authDomain: "tea1234-82e1f.firebaseapp.com",
  projectId: "tea1234-82e1f",
  storageBucket: "tea1234-82e1f.firebasestorage.app",
  messagingSenderId: "444630451366",
  appId: "1:444630451366:web:595ec7e595a40a4528e067",
  measurementId: "G-CG5PBK0SW9"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log("[firebase-messaging-sw.js] Received background message ", payload);

  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: "https://img.icons8.com/color/96/tea.png"
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
