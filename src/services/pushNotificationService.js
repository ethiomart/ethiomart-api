const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Initialize Firebase Admin only if the service account key exists
// This prevents crashes if the user hasn't generated the google-services key yet
const serviceAccountPath = path.join(__dirname, '../../config/firebase-service-account.json');
let isFirebaseInitialized = false;

if (fs.existsSync(serviceAccountPath)) {
  try {
    const serviceAccount = require(serviceAccountPath);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    isFirebaseInitialized = true;
    console.log('Firebase Admin SDK initialized successfully.');
  } catch (error) {
    console.error('Failed to initialize Firebase Admin SDK:', error.message);
  }
} else {
  console.warn('Firebase Service Account Key not found. Push Notifications will be disabled. Check PUSH_NOTIFICATIONS_SETUP_GUIDE.md for setup instructions.');
}

/**
 * Send a notification to a specific device
 * @param {string} deviceToken - FCM Device Token
 * @param {string} title - Notification Title
 * @param {string} body - Notification Body
 * @param {object} data - Optional extra data to send
 */
const sendPushNotification = async (deviceToken, title, body, data = {}) => {
  if (!isFirebaseInitialized) {
    console.log(`[Push Notification Skipped] Title: ${title}, Body: ${body}`);
    return false;
  }

  if (!deviceToken) {
    return false;
  }

  try {
    const message = {
      notification: { title, body },
      data: data,
      token: deviceToken
    };

    const response = await admin.messaging().send(message);
    console.log('Successfully sent push notification:', response);
    return true;
  } catch (error) {
    console.error('Error sending push notification:', error);
    return false;
  }
};

module.exports = {
  sendPushNotification
};
