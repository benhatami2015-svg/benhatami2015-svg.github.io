// Paste the web app config from Firebase Console > Project settings > Your apps.
// These values identify your Firebase project; they are not service-account secrets.
export const firebaseConfig = {
  apiKey: "AIzaSyC-GDih3FqaFO7mtGD0y1pUA4MGM3Uqnxs",
  authDomain: "homework-eeab8.firebaseapp.com",
  projectId: "homework-eeab8",
  storageBucket: "homework-eeab8.firebasestorage.app",
  messagingSenderId: "562765026649",
  appId: "1:562765026649:web:4c9ace81431fb313dae848",
  measurementId: "G-1KGZD966XQ"
};

export const firebaseConfigured = Object.values(firebaseConfig).every(value => value.trim());

