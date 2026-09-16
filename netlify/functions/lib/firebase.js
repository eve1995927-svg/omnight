// 後端共用：用跟網站一樣的匿名登入 + REST 讀寫 Firebase。
// 這樣不必再另外貼 FIREBASE_SERVICE_ACCOUNT，社群訊息設定窗存的金鑰，Webhook 才能讀到。

const DB_URL = 'https://zeju-62388-default-rtdb.asia-southeast1.firebasedatabase.app';
const API_KEY = 'AIzaSyCOvRcTbj0z9cPMOYxicnqbzHLsUP-jOHg';

let _idToken = '';
let _tokenExp = 0;

async function getIdToken() {
  if (_idToken && Date.now() < _tokenExp - 30000) return _idToken;
  const r = await fetch('https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=' + API_KEY, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ returnSecureToken: true }),
  });
  const data = await r.json();
  if (!data.idToken) throw new Error('Firebase 匿名登入失敗');
  _idToken = data.idToken;
  _tokenExp = Date.now() + Number(data.expiresIn || 3600) * 1000;
  return _idToken;
}

function dbUrl(path) {
  const clean = String(path || '').replace(/^\//, '').replace(/\.json$/, '');
  return DB_URL + '/' + clean + '.json';
}

async function fbGet(path) {
  const token = await getIdToken();
  const r = await fetch(dbUrl(path) + '?auth=' + encodeURIComponent(token));
  if (!r.ok) throw new Error('Firebase 讀取失敗 ' + r.status);
  return r.json();
}

async function fbPut(path, value) {
  const token = await getIdToken();
  const r = await fetch(dbUrl(path) + '?auth=' + encodeURIComponent(token), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(value),
  });
  if (!r.ok) throw new Error('Firebase 寫入失敗 ' + r.status);
  return r.json();
}

function newMsgId() {
  return Date.now() * 1000 + Math.floor(Math.random() * 1000);
}

async function loadInboxConfig() {
  const fromEnv = {
    lineChannelId: process.env.LINE_CHANNEL_ID || '',
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
    const saved = (await fbGet('zeju_data/omnichannel_config')) || {};
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

async function saveOmnichannelMessage(record) {
  const id = record._id || newMsgId();
  const row = {
    ...record,
    _id: id,
    _ts: record._ts || new Date().toLocaleString('zh-TW'),
  };
  await fbPut('zeju_data/omnichannel_messages/' + id, row);
  return row;
}

async function getAllMessages() {
  return (await fbGet('zeju_data/omnichannel_messages')) || {};
}

async function ensureLineClient(lineUserId, senderName) {
  const clients = (await fbGet('zeju_data/clients')) || {};
  const exists = Object.values(clients).some((c) => c && c.lineUserId === lineUserId);
  if (exists) return;
  const newClientId = Date.now();
  await fbPut('zeju_data/clients/' + newClientId, {
    _id: newClientId,
    name: senderName || 'LINE 好友',
    lineUserId,
    phone: '',
    addr: '',
    _ts: new Date().toLocaleString('zh-TW'),
  });
}

module.exports = {
  getIdToken,
  fbGet,
  fbPut,
  newMsgId,
  loadInboxConfig,
  saveOmnichannelMessage,
  getAllMessages,
  ensureLineClient,
};
