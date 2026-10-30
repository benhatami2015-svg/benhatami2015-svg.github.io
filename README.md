# Daybook homework planner

Daybook is a phone-friendly homework planner hosted as a static site on GitHub Pages. It uses Firebase Authentication for email/password accounts and requires email verification before opening the planner.

## Turn on sign-up and sign-in

The site owner needs to connect the site to a Firebase project once:

1. Open the [Firebase console](https://console.firebase.google.com/) and create a project. The Spark plan can be used without adding billing details for Firebase Authentication.
2. In **Build → Authentication**, choose **Get started**, then enable **Email/Password** as a sign-in provider.
3. In **Project settings → General → Your apps**, register a **Web app** and copy its config values.
4. Put the `apiKey`, `authDomain`, `projectId`, and `appId` values into `firebase-config.js` in this repository. These web config values identify the Firebase project; do not put a service-account JSON key or a user's password in the repository.
5. In **Authentication → Settings → Authorized domains**, add `benhatami2015-svg.github.io`.
6. Commit the change. GitHub Pages will publish it, and the account form will become active.

Visitors can then choose **Sign up**, enter their email and password, and use the verification link Firebase emails them. Signing in with an unverified address sends another verification email and keeps the homework hidden. Verified users sign in with the same email and password.

## Homework storage

Assignments and photos are kept in browser storage on the device being used. The account login protects access to the planner, but homework does not sync between phones or browsers. Firebase Authentication handles accounts and verification; it does not store homework or photos.

## Optional AI photo titles

AI naming is not enabled on GitHub Pages and needs a separately hosted server and an OpenAI API key with API billing. The planner works without it: take or upload a photo and type the assignment title yourself. Never put an OpenAI secret key in this repository or in browser code.

