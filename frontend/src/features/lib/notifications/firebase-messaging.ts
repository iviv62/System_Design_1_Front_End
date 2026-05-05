import { initializeApp, getApps } from "firebase/app";
import { getMessaging, getToken, isSupported } from "firebase/messaging";

type FirebaseConfig = {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
};

const config: FirebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY ?? "",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ?? "",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID ?? "",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ?? "",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? "",
  appId: import.meta.env.VITE_FIREBASE_APP_ID ?? "",
};

const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY ?? "";

function hasRequiredFirebaseConfig() {
  return Object.values(config).every((value) => value.trim().length > 0) && vapidKey.trim().length > 0;
}

function registerFirebaseMessagingServiceWorker() {
  const swUrl = new URL("/firebase-messaging-sw.js", window.location.origin);
  swUrl.search = new URLSearchParams(config).toString();
  return navigator.serviceWorker.register(swUrl.toString());
}

export async function initFirebasePush() {
  if (!window.isSecureContext) {
    console.warn("Push notifications require HTTPS or localhost.");
    return null;
  }

  if (!("Notification" in window) || !("serviceWorker" in navigator)) {
    console.warn("Push notifications are not supported in this browser.");
    return null;
  }

  if (!hasRequiredFirebaseConfig()) {
    console.warn("Firebase push is not configured. Set VITE_FIREBASE_* variables.");
    return null;
  }

  if (!(await isSupported())) {
    console.warn("Firebase messaging is not supported in this browser.");
    return null;
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    console.warn("Notification permission was not granted.");
    return null;
  }

  const app = getApps().length ? getApps()[0] : initializeApp(config);
  const messaging = getMessaging(app);
  const registration = await registerFirebaseMessagingServiceWorker();

  const token = await getToken(messaging, {
    vapidKey,
    serviceWorkerRegistration: registration,
  });

  if (!token) {
    console.warn("Firebase returned an empty token.");
    return null;
  }

  return token;
}
