// ══ 接收 Stripe 付款/訂閱狀態通知 ═══════════════════════════
// 使用前準備：
// 1. Stripe Dashboard → Developers → Webhooks → 新增端點
//    網址填：https://你的網域/.netlify/functions/stripe-webhook
//    要監聽的事件勾選：checkout.session.completed、
//    customer.subscription.updated、customer.subscription.deleted
// 2. 建立後 Stripe 會給一組 Webhook Signing Secret（whsec_開頭）
// 3. 到 Netlify 環境變數新增 STRIPE_WEBHOOK_SECRET = 那組密鑰
//
// 這支 function 目前做的事：驗證真的是 Stripe 送來的通知（防止偽造），
// 並且把「新客戶付款成功」的通知記錄下來（可以接你自己的 Email/LINE 通知機制）。
// ⚠️ 重要：目前的系統架構是「一個客戶一個獨立 Firebase 專案」，
// 這支 function 沒辦法自動幫新客戶建立 Firebase 專案跟部署網站——
// 那個步驟目前還是需要你自己手動做（照之前給你的「新客戶開通 SOP」）。
// 這支 function 能幫你自動化的是「收到錢」跟「知道有新客戶要開通」，
// 不是「自動生出一個完整可用的新系統」，這點請認知清楚，避免期待落差。

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
  if (!STRIPE_WEBHOOK_SECRET) {
    return { statusCode: 500, body: '尚未設定 STRIPE_WEBHOOK_SECRET' };
  }

  // 驗證簽章（避免有人假冒 Stripe 發假通知）
  const sig = event.headers['stripe-signature'];
  let stripeEvent;
  try {
    stripeEvent = verifyStripeSignature(event.body, sig, STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return { statusCode: 400, body: '簽章驗證失敗：' + err.message };
  }

  switch (stripeEvent.type) {
    case 'checkout.session.completed': {
      const session = stripeEvent.data.object;
      // 新客戶付款成功／開始試用
      // TODO: 這裡可以接你自己的通知方式，例如打一個 webhook 到 LINE Notify，
      // 或寫進一個 Google試算表，提醒自己「有新客戶要手動開通」
      console.log('新客戶完成付款設定：', session.customer_email, session.metadata?.company_name);
      break;
    }
    case 'customer.subscription.deleted': {
      const sub = stripeEvent.data.object;
      // 客戶取消訂閱
      // TODO: 提醒自己該客戶已取消，之後可以考慮的動作（保留資料多久、要不要關閉存取等）由你自行決定
      console.log('訂閱已取消：', sub.customer);
      break;
    }
  }

  return { statusCode: 200, body: JSON.stringify({ received: true }) };
};

// 簡化版 Stripe 簽章驗證（HMAC-SHA256），不依賴額外的 stripe npm 套件
function verifyStripeSignature(payload, sigHeader, secret) {
  const crypto = require('crypto');
  if (!sigHeader) throw new Error('缺少 stripe-signature header');
  const parts = Object.fromEntries(sigHeader.split(',').map(p => p.split('=')));
  const timestamp = parts.t;
  const signature = parts.v1;
  const signedPayload = timestamp + '.' + payload;
  const expected = crypto.createHmac('sha256', secret).update(signedPayload).digest('hex');
  if (expected !== signature) throw new Error('簽章不符');
  return JSON.parse(payload);
}
