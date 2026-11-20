import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getDatabase } from 'firebase/database';
import { getStorage } from 'firebase/storage';

// Configuración pública del mismo proyecto Firebase utilizado por la app web.
// Las credenciales privadas de administrador nunca deben incorporarse a la aplicación.
export const firebaseConfig = {
  apiKey: 'AIzaSyCjZL41FcM4MOrqnHITA5Ko3QJmCqyjtjc',
  authDomain: 'autoridadpolitica.firebaseapp.com',
  projectId: 'autoridadpolitica',
  storageBucket: 'autoridadpolitica.firebasestorage.app',
  messagingSenderId: '1019448161527',
  appId: '1:1019448161527:web:78aa0c23dd96c6d008cff2'
};

export const firebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(firebaseApp);
export const db = getFirestore(firebaseApp);
export const rtdb = getDatabase(firebaseApp, 'https://autoridadpolitica-default-rtdb.firebaseio.com');
export const storage = getStorage(firebaseApp);
