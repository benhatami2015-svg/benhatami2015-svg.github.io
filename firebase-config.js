// Paste the web app config from Firebase Console > Project settings > Your apps.
// These values identify your Firebase project; they are not service-account secrets.
export const firebaseConfig = {
  apiKey: "",
  authDomain: "",
  projectId: "",
  appId: ""
};

export const firebaseConfigured = Object.values(firebaseConfig).every(value => value.trim());

