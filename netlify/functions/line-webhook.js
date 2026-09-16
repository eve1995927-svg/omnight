// LINE 官方帳號 Webhook
// LINE 把客戶訊息打到這支，驗證簽章後寫進 omnichannel_messages，
// 前端「業務 → 社群訊息」就會即時看到。
//
// 金鑰優先讀 Firebase 的 zeju_data/omnichannel_config（社群訊息隱藏設定窗）。

const { loadInboxConfig, saveOmnichannelMessage, ensureLineClient } = require('./lib/firebase');
const crypto = require('crypto');

function rawBodyBuffer(event) {
  if (!event.body) return Buffer.from('', 'utf8');
  if (event.isBase64Encoded) return Buffer.from(event.body, 'base64');
  return Buffer.from(event.body, 'utf8');
}

function verifySignature(buf, signature, channelSecret) {
  const hash = crypto.createHmac('SHA256', channelSecret).update(buf).digest('base64');
  return hash === signature;
}

function lineText(msg) {
  if (!msg) return '';
  if (msg.type === 'text') return msg.text || '';
  if (msg.type === 'sticker') return '[貼圖]';
  if (msg.type === 'image') return '[圖片]';
  if (msg.type === 'video') return '[影片]';
  if (msg.type === 'audio') return '[語音]';
  if (msg.type === 'location') return '[位置] ' + (msg.address || '');
  if (msg.type === 'file') return '[檔案]';
  return '[' + (msg.type || '訊息') + ']';
}

async function fetchLineName(userId, accessToken) {
  if (!accessToken) return 'LINE 好友';
  try {
    const profileRes = await fetch('https://api.line.me/v2/bot/profile/' + userId, {
      headers: { Authorization: 'Bearer ' + accessToken },
    });
    if (!profileRes.ok) return 'LINE 好友';
    const profile = await profileRes.json();
    return profile.displayName || 'LINE 好友';
  } catch (e) {
    return 'LINE 好友';
  }
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  let config;
  try {
    config = await loadInboxConfig();
  } catch (e) {
    console.error('讀取連線設定失敗：', e.message);
    return { statusCode: 500, body: 'db init failed' };
  }

  if (!config.lineChannelSecret) {
    console.error('缺少 LINE Channel Secret');
    return { statusCode: 500, body: 'server not configured' };
  }

  const buf = rawBodyBuffer(event);
  const signature = event.headers['x-line-signature'] || event.headers['X-Line-Signature'];
  if (!signature || !verifySignature(buf, signature, config.lineChannelSecret)) {
    console.warn('LINE webhook 簽章驗證失敗', {
      isBase64Encoded: !!event.isBase64Encoded,
      bodyLen: (event.body || '').length,
    });
    return { statusCode: 401, body: 'invalid signature' };
  }

  let payload;
  try {
    payload = JSON.parse(buf.toString('utf8') || '{}');
  } catch (e) {
    return { statusCode: 400, body: 'bad json' };
  }

  const events = payload.events || [];
  if (!events.length) {
    return { statusCode: 200, body: 'ok' };
  }

  for (const ev of events) {
    try {
      const lineUserId = ev.source && ev.source.userId;
      if (!lineUserId) continue;

      if (ev.type === 'follow') {
        const senderName = await fetchLineName(lineUserId, config.lineChannelAccessToken);
        await saveOmnichannelMessage({
          platform: 'line',
          threadId: 'line:' + lineUserId,
          senderId: lineUserId,
          senderName,
          lineUserId,
          direction: 'in',
          type: 'follow',
          text: '已加入官方帳號好友',
          read: false,
        });
        await ensureLineClient(lineUserId, senderName);
        continue;
      }

      if (ev.type !== 'message' || !ev.message) continue;

      const senderName = await fetchLineName(lineUserId, config.lineChannelAccessToken);
      await saveOmnichannelMessage({
        platform: 'line',
        threadId: 'line:' + lineUserId,
        senderId: lineUserId,
        senderName,
        lineUserId,
        direction: 'in',
        type: ev.message.type,
        text: lineText(ev.message),
        read: false,
      });
      await ensureLineClient(lineUserId, senderName);
    } catch (e) {
      console.error('處理單一 LINE 事件失敗：', e.message);
    }
  }

  return { statusCode: 200, body: 'ok' };
};
