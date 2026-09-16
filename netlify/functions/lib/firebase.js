// 後端共用：Firebase Admin + 社群訊息設定／寫入
const admin = require('firebase-admin');

function getAdminApp() {
  if (admin.apps.length) return admin.app();
  const svcJson = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!svcJson) throw new Error('尚未設定 FIREBASE_SERVICE_ACCOUNT 環境變數');
  const serviceAccount = typeof svcJson === 'string' ? JSON.parse(svcJson) : svcJson;
  return admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: 'https://zeju-62388-default-rtdb.asia-southeast1.firebasedatabase.app',
  });
}

function getDb() {
  return getAdminApp().database();
}

function newMsgId() {
  return Date.now() * 1000 + Math.floor(Math.random() * 1000);
}

async function loadInboxConfig(db) {
  const fromEnv = {
    lineChannelSecret: process.env.LINE_CHANNEL_SECRET || '',
    lineChannelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN || '',
    metaPageToken: process.env.META_PAGE_TOKEN || '',
    metaAppSecret: process.env.META_APP_SECRET || '',
    metaVerifyToken: process.env.META_VERIFY_TOKEN || '',
    instagramPageToken: process.env.INSTAGRAM_PAGE_TOKEN || '',
    threadsAccessToken: process.env.THREADS_ACCESS_TOKEN || '',
    threadsUserId: process.env.THREADS_USER_ID || '',
    appSharedSecret: process.env.APP_SHARED_SECRET || '',
  };
  try {
    const snap = await db.ref('zeju_data/omnichannel_config').once('value');
    const saved = snap.val() || {};
    const merged = { ...fromEnv };
    Object.keys(fromEnv).forEach((k) => {
      if (saved[k]) merged[k] = saved[k];
    });
    return merged;
  } catch (e) {
    console.warn('讀取 omnichannel_config 失敗，改用環境變數：', e.message);
    return fromEnv;
  }
}

async function saveOmnichannelMessage(db, record) {
  const id = record._id || newMsgId();
  const row = {
    ...record,
    _id: id,
    _ts: record._ts || new Date().toLocaleString('zh-TW'),
  };
  await db.ref('zeju_data/omnichannel_messages/' + id).set(row);
  return row;
}

module.exports = {
  getAdminApp,
  getDb,
  newMsgId,
  loadInboxConfig,
  saveOmnichannelMessage,
};
