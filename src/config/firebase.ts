import admin from 'firebase-admin';

export const initializeFirebase = () => {
  if (admin.apps.length === 0) {
    if (process.env.NODE_ENV === 'production') {
      const serviceAccount = require('../../firebase-service-account.json');
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
    } else {
      admin.initializeApp({
        credential: admin.credential.applicationDefault(),
        projectId: process.env.FIREBASE_PROJECT_ID
      });
    }
  }
  return admin;
};

export const verifyFirebaseToken = async (token: string) => {
  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    return decodedToken;
  } catch (error) {
    throw new Error('Invalid token');
  }
};

export { admin };