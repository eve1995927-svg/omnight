// netlify/functions/line-webhook.js
// LINE 官方帳號收到訊息時，LINE 會呼叫這支程式（Webhook）。
// 這支程式負責：1) 驗證訊息真的是 LINE 傳來的（不是別人假冒的）2) 把訊息存進你們的資料庫，
// 讓「客戶諮詢」畫面看得到。
//
// 需要在 Netlify 環境變數設定：
//   LINE_CHANNEL_SECRET        （LINE Developers 後台 → Basic settings）
//   FIREBASE_SERVICE_ACCOUNT   （Firebase 服務帳號金鑰，整包 JSON 內容貼進來，設定方式見下方說明）
//
// ── 怎麼拿 FIREBASE_SERVICE_ACCOUNT ──
// 1. 打開 Firebase 主控台 → 選你們的專案（zeju-62388）
// 2. 左上角齒輪 → 專案設定 → 服務帳戶（Service Accounts）分頁
// 3. 點「產生新的私密金鑰」，會下載一個 .json 檔案
// 4. 打開那個 json 檔案，把「整包內容」（包含最外層的大括號）複製起來
// 5. 到 Netlify → Site configuration → Environment variables → 新增一筆
//    Key: FIREBASE_SERVICE_ACCOUNT　Value: 貼上剛剛複製的整包 JSON 內容
// 這組金鑰權限很高（可以讀寫整個資料庫），保管方式跟 LINE 的金鑰一樣：
// 絕對不要放進程式碼檔案裡上傳 GitHub，只能貼在 Netlify 的環境變數裡。

const crypto = require('crypto');
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

// 驗證這個請求真的是 LINE 平台送來的，不是別人偽造的（LINE 官方文件規定的簽章驗證方式）
function verifySignature(body, signature, channelSecret) {
  const hash = crypto.createHmac('SHA256', channelSecret).update(body).digest('base64');
  return hash === signature;
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const channelSecret = process.env.LINE_CHANNEL_SECRET;
  if (!channelSecret) {
    console.error('缺少 LINE_CHANNEL_SECRET 環境變數');
    return { statusCode: 500, body: 'server not configured' };
  }

  const signature = event.headers['x-line-signature'] || event.headers['X-Line-Signature'];
  if (!signature || !verifySignature(event.body, signature, channelSecret)) {
    console.warn('LINE webhook 簽章驗證失敗，拒絕這個請求');
    return { statusCode: 401, body: 'invalid signature' };
  }

  let payload;
  try {
    payload = JSON.parse(event.body);
  } catch (e) {
    return { statusCode: 400, body: 'bad json' };
  }

  const events = payload.events || [];
  if (!events.length) {
    // LINE 驗證 Webhook 網址時會送一個空事件，正常回 200 就好
    return { statusCode: 200, body: 'ok' };
  }

  let db;
  try {
    const app = getAdminApp();
    db = app.database();
  } catch (e) {
    console.error('Firebase 初始化失敗：', e.message);
    return { statusCode: 500, body: 'db init failed' };
  }

  for (const ev of events) {
    try {
      const lineUserId = ev.source && ev.source.userId;
      if (!lineUserId) continue;

      if (ev.type === 'message' && ev.message) {
        const msg = ev.message;
        const id = Date.now() + '_' + Math.random().toString(36).slice(2, 8);
        const record = {
          _id: id,
          platform: 'line',
          lineUserId,
          direction: 'in', // in = 客戶傳來的；out = 我們回覆的
          type: msg.type, // text / image / sticker / ...
          text: msg.type === 'text' ? (msg.text || '') : '',
          _ts: new Date().toLocaleString('zh-TW'),
          read: false,
        };
        await db.ref('zeju_data/omnichannel_messages/' + id).set(record);

        // 順便更新／建立這位客戶的基本資料，讓「客戶總覽」看得到是同一個人
        const clientsSnap = await db.ref('zeju_data/clients').orderByChild('lineUserId').equalTo(lineUserId).once('value');
        if (!clientsSnap.exists()) {
          // 抓客戶的 LINE 顯示名稱，讓畫面上看得懂是誰，不是只有一串 ID
          let displayName = 'LINE 好友';
          try {
            const profileRes = await fetch('https://api.line.me/v2/bot/profile/' + lineUserId, {
              headers: { Authorization: 'Bearer ' + process.env.LINE_CHANNEL_ACCESS_TOKEN },
            });
            if (profileRes.ok) {
              const profile = await profileRes.json();
              displayName = profile.displayName || displayName;
            }
          } catch (e) { /* 抓不到名字就用預設值，不影響訊息記錄 */ }

          const newClientId = Date.now();
          await db.ref('zeju_data/clients/' + newClientId).set({
            _id: newClientId,
            name: displayName,
            lineUserId,
            phone: '',
            addr: '',
            _ts: new Date().toLocaleString('zh-TW'),
          });
        }
      }
    } catch (e) {
      console.error('處理單一事件失敗：', e.message);
      // 單一事件失敗不影響其他事件繼續處理
    }
  }

  return { statusCode: 200, body: 'ok' };
};
