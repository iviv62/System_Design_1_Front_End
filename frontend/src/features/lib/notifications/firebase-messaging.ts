import { initializeApp, getApps } from "firebase/app";
import { getMessaging, getToken, isSupported } from "firebase/messaging";
import { registerNotificationToken } from "./notification-token-api";

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
let currentPushToken: string | null = null;

function normalizeVapidKey(raw: string): string {
  const trimmed = raw.trim();

  // Avoid common .env mistakes like wrapping values in quotes.
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim();
  }

  return trimmed;
}

function isLikelyValidVapidPublicKey(key: string): boolean {
  // Web Push public keys are URL-safe base64 strings (typically ~87 chars for 65 bytes).
  return key.length >= 80 && /^[A-Za-z0-9_-]+$/.test(key);
}

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

  const normalizedVapidKey = normalizeVapidKey(vapidKey);
  if (!isLikelyValidVapidPublicKey(normalizedVapidKey)) {
    console.error(
      "Invalid VITE_FIREBASE_VAPID_KEY format. Use the Web Push public key from Firebase Cloud Messaging without quotes or extra spaces.",
    );
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

  let token: string | null;
  try {
    token = await getToken(messaging, {
      vapidKey: normalizedVapidKey,
      serviceWorkerRegistration: registration,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "InvalidAccessError") {
      console.error(
        "Push subscribe failed: VAPID key is invalid for this Firebase project. Re-copy the Web Push public key from Firebase Console -> Cloud Messaging.",
      );
      return null;
    }
    throw error;
  }

  if (!token) {
    console.warn("Firebase returned an empty token.");
    return null;
  }

  currentPushToken = token;

  return token;
}

export function getCurrentPushToken(): string | null {
  return currentPushToken;
}

export async function initFirebasePushAndRegister(
  username: string,
) {
  const trimmed = username.trim();
  if (!trimmed) return null;

  const token = await initFirebasePush();
  if (!token) return null;

  await registerNotificationToken({
    username: trimmed,
    token,
    provider: "fcm",
    userAgent: navigator.userAgent,
  });

  return token;
}
