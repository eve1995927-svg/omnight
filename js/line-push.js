// netlify/functions/line-push.js
// 從你們系統的「客戶諮詢」畫面按送出時，呼叫這支程式，把訊息推播到客戶的 LINE。
//
// 需要在 Netlify 環境變數設定：
//   LINE_CHANNEL_ACCESS_TOKEN  （LINE Developers 後台 → Messaging API 分頁）
//   FIREBASE_SERVICE_ACCOUNT   （同 line-webhook.js，已經設定過的話不用重複設定）
//
// 前端呼叫方式（之後會接在客戶諮詢畫面的送出按鈕上）：
//   fetch('/.netlify/functions/line-push', {
//     method: 'POST',
//     headers: {'Content-Type':'application/json'},
//     body: JSON.stringify({ lineUserId: '客戶的LINE ID', text: '要傳送的訊息內容' })
//   });

const admin = require('firebase-admin');

function getAdminApp() {
  if (admin.apps.length) return admin.app();
  const svcJson = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!svcJson) throw new Error('尚未設定 FIREBASE_SERVICE_ACCOUNT 環境變數');
  const serviceAccount = JSON.parse(svcJson);
  return admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: 'https://zeju-62388-default-rtdb.asia-southeast1.firebasedatabase.app',
  });
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const accessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!accessToken) {
    return { statusCode: 500, body: JSON.stringify({ error: '尚未設定 LINE_CHANNEL_ACCESS_TOKEN' }) };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ error: 'bad json' }) };
  }

  const { lineUserId, text } = body;
  if (!lineUserId || !text) {
    return { statusCode: 400, body: JSON.stringify({ error: '缺少 lineUserId 或 text' }) };
  }

  try {
    const r = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + accessToken,
      },
      body: JSON.stringify({
        to: lineUserId,
        messages: [{ type: 'text', text }],
      }),
    });

    if (!r.ok) {
      const errBody = await r.text();
      console.error('LINE push 失敗：', r.status, errBody);
      return { statusCode: 502, body: JSON.stringify({ error: 'LINE 回傳錯誤', detail: errBody }) };
    }

    // 推播成功後，把這則「我們回覆的訊息」也記錄進資料庫，客戶諮詢畫面才看得到完整對話
    try {
      const app = getAdminApp();
      const db = app.database();
      const id = Date.now() + '_' + Math.random().toString(36).slice(2, 8);
      await db.ref('zeju_data/omnichannel_messages/' + id).set({
        _id: id,
        platform: 'line',
        lineUserId,
        direction: 'out',
        type: 'text',
        text,
        _ts: new Date().toLocaleString('zh-TW'),
        read: true,
      });
    } catch (dbErr) {
      // 訊息已經送到客戶手機了，記錄失敗不算整個操作失敗，只記個警告
      console.warn('訊息已送達，但記錄存檔失敗：', dbErr.message);
    }

    return { statusCode: 200, body: JSON.stringify({ ok: true }) };
  } catch (e) {
    console.error('line-push 發生錯誤：', e.message);
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
