// Facebook Messenger / Instagram / Threads webhook
// Meta 驗證網址用 GET（hub.verify_token），真正訊息用 POST。
// 粉絲專頁私訊、IG 私訊、脆的留言／回覆，都寫進同一包 omnichannel_messages。
//
// 金鑰優先讀 Firebase zeju_data/omnichannel_config（社群訊息隱藏設定窗）。

const crypto = require('crypto');
const { getDb, loadInboxConfig, saveOmnichannelMessage } = require('./lib/firebase');

function verifyMetaSignature(rawBody, headerSig, appSecret) {
  if (!appSecret) return true;
  if (!headerSig) return false;
  const expected = 'sha256=' + crypto.createHmac('sha256', appSecret).update(rawBody || '').digest('hex');
  try {
    const a = Buffer.from(expected);
    const b = Buffer.from(headerSig);
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch (e) {
    return false;
  }
}

function attachmentText(attachments) {
  if (!attachments || !attachments.length) return '';
  const type = attachments[0].type || '檔案';
  const map = { image: '[圖片]', video: '[影片]', audio: '[語音]', file: '[檔案]', sticker: '[貼圖]', ig_reel: '[Reels]', reel: '[Reels]' };
  return map[type] || '[' + type + ']';
}

async function fetchMessengerName(psid, token) {
  if (!token || !psid) return 'Messenger 訪客';
  try {
    const r = await fetch('https://graph.facebook.com/v21.0/' + encodeURIComponent(psid) + '?fields=name,first_name,last_name&access_token=' + encodeURIComponent(token));
    if (!r.ok) return 'Messenger 訪客';
    const p = await r.json();
    return p.name || [p.first_name, p.last_name].filter(Boolean).join(' ') || 'Messenger 訪客';
  } catch (e) {
    return 'Messenger 訪客';
  }
}

async function fetchIgName(igid, token) {
  if (!token || !igid) return 'Instagram 訪客';
  try {
    const r = await fetch('https://graph.facebook.com/v21.0/' + encodeURIComponent(igid) + '?fields=name,username&access_token=' + encodeURIComponent(token));
    if (!r.ok) return 'Instagram 訪客';
    const p = await r.json();
    return p.name || p.username || 'Instagram 訪客';
  } catch (e) {
    return 'Instagram 訪客';
  }
}

async function saveMessagingEvent(db, platform, event, token, nameFallback, fetchName) {
  const msg = event.message;
  if (!msg) return;
  if (msg.is_echo) return;
  const senderId = event.sender && event.sender.id;
  if (!senderId) return;
  const text = msg.text || attachmentText(msg.attachments) || '[' + (msg.type || '訊息') + ']';
  const senderName = await fetchName(senderId, token);
  await saveOmnichannelMessage(db, {
    platform,
    threadId: platform + ':' + senderId,
    senderId,
    senderName: senderName || nameFallback,
    direction: 'in',
    type: msg.attachments ? (msg.attachments[0].type || 'file') : 'text',
    text,
    externalId: msg.mid || '',
    read: false,
  });
}

async function saveThreadsChange(db, change) {
  const field = change.field;
  const value = change.value || {};
  if (field !== 'replies' && field !== 'mentions') return;
  const mediaId = value.id;
  if (!mediaId) return;
  const from = value.from || {};
  const senderId = from.id || value.username || mediaId;
  const senderName = from.username || value.username || 'Threads 訪客';
  const rootId = (value.replied_to && value.replied_to.id) || mediaId;
  await saveOmnichannelMessage(db, {
    platform: 'threads',
    threadId: 'threads:' + senderId,
    senderId: String(senderId),
    senderName,
    direction: 'in',
    type: 'text',
    text: value.text || (field === 'mentions' ? '[標記了你]' : '[脆留言]'),
    mediaId,
    replyToId: rootId,
    externalId: mediaId,
    read: false,
  });
}

exports.handler = async (event) => {
  const qs = event.queryStringParameters || {};

  let db;
  let config;
  try {
    db = getDb();
    config = await loadInboxConfig(db);
  } catch (e) {
    console.error('Firebase 初始化失敗：', e.message);
    return { statusCode: 500, body: 'db init failed' };
  }

  if (event.httpMethod === 'GET') {
    if (qs['hub.mode'] === 'subscribe' && qs['hub.verify_token'] && qs['hub.verify_token'] === config.metaVerifyToken) {
      return { statusCode: 200, body: qs['hub.challenge'] || '' };
    }
    return { statusCode: 403, body: 'verify token mismatch' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const sig = event.headers['x-hub-signature-256'] || event.headers['X-Hub-Signature-256'] || '';
  if (!verifyMetaSignature(event.body || '', sig, config.metaAppSecret)) {
    console.warn('Meta webhook 簽章驗證失敗');
    return { statusCode: 401, body: 'invalid signature' };
  }

  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch (e) {
    return { statusCode: 400, body: 'bad json' };
  }

  const entries = payload.entry || [];
  const objectType = payload.object;

  for (const entry of entries) {
    try {
      if (objectType === 'threads' || (entry.changes && !entry.messaging)) {
        const changes = entry.changes || [];
        for (const change of changes) {
          await saveThreadsChange(db, change);
        }
        const messaging = entry.messaging || [];
        for (const ev of messaging) {
          await saveMessagingEvent(db, 'threads', ev, config.threadsAccessToken, 'Threads 訪客', async (id) => id);
        }
        continue;
      }

      if (objectType === 'instagram') {
        const token = config.instagramPageToken || config.metaPageToken;
        for (const ev of (entry.messaging || [])) {
          await saveMessagingEvent(db, 'instagram', ev, token, 'Instagram 訪客', fetchIgName);
        }
        continue;
      }

      for (const ev of (entry.messaging || [])) {
        await saveMessagingEvent(db, 'messenger', ev, config.metaPageToken, 'Messenger 訪客', fetchMessengerName);
      }
    } catch (e) {
      console.error('處理 Meta 事件失敗：', e.message);
    }
  }

  return { statusCode: 200, body: 'ok' };
};
