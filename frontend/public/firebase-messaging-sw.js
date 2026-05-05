importScripts("https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js");

const swUrl = new URL(self.location.href);
const firebaseConfig = {
  apiKey: swUrl.searchParams.get("apiKey") ?? "",
  authDomain: swUrl.searchParams.get("authDomain") ?? "",
  projectId: swUrl.searchParams.get("projectId") ?? "",
  storageBucket: swUrl.searchParams.get("storageBucket") ?? "",
  messagingSenderId: swUrl.searchParams.get("messagingSenderId") ?? "",
  appId: swUrl.searchParams.get("appId") ?? "",
};

const hasAllConfigValues = Object.values(firebaseConfig).every((value) => value && value.length > 0);

if (!hasAllConfigValues) {
  console.warn("Firebase service worker started without full config.");
} else {
  firebase.initializeApp(firebaseConfig);

  const messaging = firebase.messaging();

  messaging.onBackgroundMessage((payload) => {
    const title = payload.notification?.title ?? "New message";
    const options = {
      body: payload.notification?.body ?? "You have a new chat update.",
      icon: "/vite.svg",
      data: payload.data ?? {},
    };

    self.registration.showNotification(title, options);
  });
}
