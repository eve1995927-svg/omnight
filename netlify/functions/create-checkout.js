// ══ 建立 Stripe 訂閱結帳連結 ══════════════════════════════
// 使用前準備（你需要自己做的事）：
// 1. 到 https://dashboard.stripe.com 申請帳號（免費，審核通常1-2天）
// 2. 「產品目錄」建立一個訂閱商品，例如「案場通 全功能方案」，價格 NT$1,280/月，週期選「每月」
// 3. 複製這個價格對應的 Price ID（長得像 price_1AbCdEfGhIjK...）
// 4. 到 Netlify 後台「Site settings → Environment variables」新增：
//    STRIPE_SECRET_KEY = 你的 Stripe 密鑰（Dashboard → Developers → API keys → Secret key）
//    STRIPE_PRICE_ID   = 剛剛複製的 Price ID
// 5. 部署後，前端呼叫 /.netlify/functions/create-checkout 就會產生付款連結

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
  const STRIPE_PRICE_ID = process.env.STRIPE_PRICE_ID;

  if (!STRIPE_SECRET_KEY || !STRIPE_PRICE_ID) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: '尚未設定 Stripe 金鑰。請到 Netlify 後台 Environment variables 新增 STRIPE_SECRET_KEY 和 STRIPE_PRICE_ID 後重新部署。',
      }),
    };
  }

  try {
    const { customerEmail, companyName } = JSON.parse(event.body || '{}');
    const siteUrl = process.env.URL || 'https://ancase.tw';

    // 直接呼叫 Stripe REST API（不需要額外安裝 npm 套件，減少部署依賴問題）
    const params = new URLSearchParams();
    params.append('mode', 'subscription');
    params.append('line_items[0][price]', STRIPE_PRICE_ID);
    params.append('line_items[0][quantity]', '1');
    params.append('success_url', siteUrl + '/signup-success.html?session_id={CHECKOUT_SESSION_ID}');
    params.append('cancel_url', siteUrl + '/index.html#pricing');
    if (customerEmail) params.append('customer_email', customerEmail);
    if (companyName) params.append('metadata[company_name]', companyName);
    // 14天免費試用，不用先輸入信用卡也能開始（符合前面定案的「免費試用14天」策略）
    params.append('subscription_data[trial_period_days]', '14');

    const resp = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + STRIPE_SECRET_KEY,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    const session = await resp.json();
    if (!resp.ok) {
      return { statusCode: 400, body: JSON.stringify({ error: session.error?.message || '建立付款連結失敗' }) };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ url: session.url }),
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
