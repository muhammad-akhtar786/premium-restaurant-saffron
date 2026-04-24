import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  getFirestore,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "YOUR_FIREBASE_API_KEY",
  authDomain: "YOUR_FIREBASE_PROJECT.firebaseapp.com",
  projectId: "YOUR_FIREBASE_PROJECT_ID",
  storageBucket: "YOUR_FIREBASE_PROJECT.appspot.com",
  messagingSenderId: "YOUR_FIREBASE_SENDER_ID",
  appId: "YOUR_FIREBASE_APP_ID"
};

function hasFirebaseConfig(config) {
  return Object.values(config).every(value => value && !String(value).startsWith("YOUR_"));
}

function normalizeSnapshot(snapshot) {
  return snapshot.docs.map(documentSnapshot => ({
    id: documentSnapshot.id,
    ...documentSnapshot.data()
  }));
}

async function seedMenuIfEmpty(adapter) {
  const existingItems = await adapter.getMenuItems();
  if (existingItems.length) {
    return;
  }

  await Promise.all((window.SAFFRON_DEFAULT_MENU_ITEMS || []).map(item => adapter.saveMenuItem(item)));
}

if (hasFirebaseConfig(firebaseConfig) && window.SaffronStore) {
  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app);

  const adapter = {
    mode: "Firebase Firestore",

    async getMenuItems() {
      const snapshot = await getDocs(query(collection(db, "menuItems"), orderBy("name", "asc")));
      return normalizeSnapshot(snapshot);
    },

    async saveMenuItem(item) {
      const normalized = window.SaffronStore.normalizeMenuItem(item);
      await setDoc(doc(db, "menuItems", normalized.id), normalized, { merge: true });
      return normalized;
    },

    async deleteMenuItem(id) {
      await deleteDoc(doc(db, "menuItems", String(id)));
    },

    subscribeMenuItems(callback) {
      return onSnapshot(query(collection(db, "menuItems"), orderBy("name", "asc")), snapshot => {
        callback(normalizeSnapshot(snapshot));
      });
    },

    async getOrders() {
      const snapshot = await getDocs(query(collection(db, "orders"), orderBy("createdAt", "desc")));
      return normalizeSnapshot(snapshot);
    },

    async saveOrder(order) {
      const normalized = window.SaffronStore.normalizeOrder(order);
      await setDoc(doc(db, "orders", normalized.id), normalized, { merge: true });
      return normalized;
    },

    async updateOrderStatus(id, status) {
      await updateDoc(doc(db, "orders", String(id)), {
        status,
        updatedAt: new Date().toISOString()
      });
    },

    async deleteOrder(id) {
      await deleteDoc(doc(db, "orders", String(id)));
    },

    subscribeOrders(callback) {
      return onSnapshot(query(collection(db, "orders"), orderBy("createdAt", "desc")), snapshot => {
        callback(normalizeSnapshot(snapshot));
      });
    },

    async getReservations() {
      const snapshot = await getDocs(query(collection(db, "reservations"), orderBy("createdAt", "desc")));
      return normalizeSnapshot(snapshot);
    },

    async saveReservation(reservation) {
      const normalized = window.SaffronStore.normalizeReservation(reservation);
      await setDoc(doc(db, "reservations", normalized.id), normalized, { merge: true });
      return normalized;
    },

    async updateReservationStatus(id, status) {
      await updateDoc(doc(db, "reservations", String(id)), {
        status,
        updatedAt: new Date().toISOString()
      });
    },

    async deleteReservation(id) {
      await deleteDoc(doc(db, "reservations", String(id)));
    },

    subscribeReservations(callback) {
      return onSnapshot(query(collection(db, "reservations"), orderBy("createdAt", "desc")), snapshot => {
        callback(normalizeSnapshot(snapshot));
      });
    }
  };

  try {
    await seedMenuIfEmpty(adapter);
    window.SaffronStore.useRemoteAdapter(adapter);
    window.dispatchEvent(new CustomEvent("saffron-firebase-ready"));
  } catch (error) {
    console.warn("Firebase is configured but unavailable. The site will continue in localStorage demo mode.", error);
  }
} else {
  window.dispatchEvent(new CustomEvent("saffron-firebase-not-configured"));
}
