const {onDocumentCreated} = require("firebase-functions/v2/firestore");
const {initializeApp} = require("firebase-admin/app");
const {getFirestore} = require("firebase-admin/firestore");
const {getMessaging} = require("firebase-admin/messaging");

initializeApp();

const ADMIN_NOTIF_TYPES = ['new_member','new_request','new_volunteer','new_class_registration','new_report'];

exports.sendAdminNotification = onDocumentCreated("notifications/{notifId}", async (event) => {
  const data = event.data.data();

  if (!ADMIN_NOTIF_TYPES.includes(data.type)) return;

  const db = getFirestore();
  const messaging = getMessaging();

  const membersSnap = await db.collection('members').where('role','==','admin').get();
  const tokens = [];
  membersSnap.forEach(doc => {
    const t = doc.data().fcmToken;
    if (t) tokens.push(t);
  });

  if (tokens.length === 0) return;

  const titleMap = {
    new_member: 'Member Baru',
    new_request: 'Permohonan Baru',
    new_volunteer: 'Volunteer Baru',
    new_class_registration: 'Pendaftaran Kelas',
    new_report: 'Laporan Baru'
  };

  const message = {
    notification: {
      title: titleMap[data.type] || 'Notifikasi Baru',
      body: `${data.userName || ''} - ${data.reqType || data.reportType || data.className || ''}`.trim()
    },
    tokens: tokens
  };

  try {
    await messaging.sendEachForMulticast(message);
  } catch (e) {
    console.error('Error sending notification:', e);
  }
});
