// 社群訊息畫面按「送出」時呼叫。
// 依 platform 把回覆推回 LINE / Facebook Messenger / Instagram / Threads，
// 成功後再寫一筆 direction:'out' 進 omnichannel_messages。
//
// 前端要帶 secret，必須跟隱藏設定窗的「回覆密碼」一樣（APP_SHARED_SECRET）。

const { loadInboxConfig, saveOmnichannelMessage, getAllMessages } = require('./lib/firebase');

function cors(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
    },
    body: JSON.stringify(body),
  };
}

async function sendLine(config, recipientId, text) {
  const r = await fetch('https://api.line.me/v2/bot/message/push', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + config.lineChannelAccessToken,
    },
    body: JSON.stringify({ to: recipientId, messages: [{ type: 'text', text }] }),
  });
  const detail = await r.text();
  if (!r.ok) throw new Error('LINE 回傳錯誤：' + detail);
}

async function sendMetaMessage(token, recipientId, text) {
  if (!token) throw new Error('尚未設定 Page Access Token');
  const r = await fetch('https://graph.facebook.com/v21.0/me/messages?access_token=' + encodeURIComponent(token), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      recipient: { id: recipientId },
      messaging_type: 'RESPONSE',
      message: { text },
    }),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error && data.error.message ? data.error.message : 'Meta 送出失敗');
}

async function sendThreadsReply(config, mediaId, text) {
  const userId = config.threadsUserId || 'me';
  const token = config.threadsAccessToken;
  if (!token) throw new Error('尚未設定 Threads Access Token');
  const createRes = await fetch('https://graph.threads.net/v1.0/' + encodeURIComponent(userId) + '/threads?access_token=' + encodeURIComponent(token), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ media_type: 'TEXT', text, reply_to_id: mediaId }),
  });
  const createData = await createRes.json().catch(() => ({}));
  if (!createRes.ok || !createData.id) {
    throw new Error((createData.error && createData.error.message) || 'Threads 建立回覆失敗');
  }
  const pubRes = await fetch('https://graph.threads.net/v1.0/' + encodeURIComponent(userId) + '/threads_publish?access_token=' + encodeURIComponent(token), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ creation_id: createData.id }),
  });
  const pubData = await pubRes.json().catch(() => ({}));
  if (!pubRes.ok) {
    throw new Error((pubData.error && pubData.error.message) || 'Threads 發佈回覆失敗');
  }
}

async function sendThreadsDm(config, recipientId, text) {
  const token = config.threadsAccessToken;
  if (!token) throw new Error('尚未設定 Threads Access Token');
  const r = await fetch('https://graph.threads.net/v1.0/me/messages?access_token=' + encodeURIComponent(token), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ recipient: { id: recipientId }, message: { text } }),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((data.error && data.error.message) || 'Threads 私訊送出失敗');
}

async function latestThreadsMediaId(recipientId, threadId) {
  const all = Object.values((await getAllMessages()) || {});
  const inbound = all
    .filter((m) => m.platform === 'threads' && m.direction === 'in' && m.mediaId && (m.senderId === recipientId || m.threadId === threadId))
    .sort((a, b) => Number(b._id) - Number(a._id));
  return inbound[0] ? inbound[0].mediaId : '';
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return cors(200, { ok: true });
  if (event.httpMethod !== 'POST') return cors(405, { error: 'Method Not Allowed' });

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch (e) {
    return cors(400, { error: 'bad json' });
  }

  const { platform, recipientId, text, secret, threadId } = body;
  if (!platform || !recipientId || !text) {
    return cors(400, { error: '缺少 platform、recipientId 或 text' });
  }

  let config;
  try {
    config = await loadInboxConfig();
  } catch (e) {
    return cors(500, { error: '資料庫尚未設定' });
  }

  if (!config.appSharedSecret || secret !== config.appSharedSecret) {
    return cors(401, { error: '回覆密碼不對，請打開右上角「連線設定」再填一次' });
  }

  try {
    if (platform === 'line') {
      if (!config.lineChannelAccessToken) throw new Error('尚未設定 LINE Channel Access Token');
      await sendLine(config, recipientId, text);
    } else if (platform === 'messenger') {
      await sendMetaMessage(config.metaPageToken, recipientId, text);
    } else if (platform === 'instagram') {
      await sendMetaMessage(config.instagramPageToken || config.metaPageToken, recipientId, text);
    } else if (platform === 'threads') {
      const mediaId = await latestThreadsMediaId(recipientId, threadId);
      if (mediaId) await sendThreadsReply(config, mediaId, text);
      else await sendThreadsDm(config, recipientId, text);
    } else {
      throw new Error('不支援的平台：' + platform);
    }

    const out = {
      platform,
      threadId: threadId || (platform + ':' + recipientId),
      senderId: recipientId,
      senderName: '澤居',
      direction: 'out',
      type: 'text',
      text,
      read: true,
    };
    if (platform === 'line') out.lineUserId = recipientId;
    await saveOmnichannelMessage(out);

    return cors(200, { ok: true });
  } catch (e) {
    console.error('send-reply 失敗：', e.message);
    return cors(502, { error: e.message });
  }
};
