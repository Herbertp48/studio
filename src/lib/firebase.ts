import { initializeApp, getApp, getApps } from 'firebase/app';
import { getDatabase } from 'firebase/database';
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  projectId: 'studio-8627034361-8b608',
  appId: '1:523488629195:web:907711d5a1b8096f40264e',
  apiKey: 'AIzaSyDrPWMT1270jfcUFzNSJNfjqMFyPkNl5Uk',
  authDomain: 'studio-8627034361-8b608.firebaseapp.com',
  databaseURL: 'https://studio-8627034361-8b608-default-rtdb.firebaseio.com'
};

// Initialize Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const database = getDatabase(app);
const auth = getAuth(app);

export { app, database, auth };
