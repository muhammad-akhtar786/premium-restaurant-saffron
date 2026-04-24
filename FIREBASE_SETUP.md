# Firebase Setup for Saffron Flame

The website works locally in demo mode with `localStorage`. Demo mode is useful for portfolio walkthroughs in one browser, but it is not production storage.

For real restaurant use across devices, configure Firebase Firestore:

1. Create a Firebase project.
2. Enable Firestore Database.
3. Open `JS/firebase.js`.
4. Replace the placeholder values in `firebaseConfig` with the web app config from Firebase.
5. Deploy to Netlify again.

Collections used:

- `menuItems`
- `orders`
- `reservations`

The Firebase adapter uses real-time listeners for menu items, orders, and reservations. Once configured, menu changes from the admin dashboard can appear on the public menu across devices.

For production, replace the demo admin login in `JS/admin.js` with Firebase Auth and secure Firestore rules. The current demo credentials are:

- Username: `admin`
- Password: `admin123`
