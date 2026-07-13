// ══ 藍新金流「定期定額」自動扣款 — 建立委託單 ════════════════
//
// 使用前準備（你需要自己做的事）：
// 1. 到 https://www.newebpay.com 申請「企業會員」帳號（需要公司登記資料，審核約1-3個工作天）
//    測試環境請先去 https://cwww.newebpay.com 註冊測試帳號（不用等審核，馬上能測）
// 2. 登入後台 →「商店管理」→ 申請「信用卡定期定額」功能（不是每個商店預設就有，要額外申請開通）
// 3. 開通後，商店管理頁面可以看到三組資料，記下來：
//    - 商店代號 MerchantID（例：MS1584716169）
//    - HashKey（32字元）
//    - HashIV（16字元）
// 4. 到 Netlify 後台「Site settings → Environment variables」新增：
//    NEWEBPAY_MERCHANT_ID = 你的商店代號
//    NEWEBPAY_HASH_KEY    = 你的 HashKey
//    NEWEBPAY_HASH_IV     = 你的 HashIV
//    NEWEBPAY_ENV         = test（測試環境）或 production（正式環境）
//
// ⚠️ 重要提醒（付款程式碼，請務必先在測試環境完整測試過一輪，確認扣款、通知都正常，才切換正式環境）：
// - 藍新的技術文件版本偶爾會更新，申請帳號後你會拿到一份官方 PDF「信用卡定期定額技術串接手冊」，
//   建議照那份文件核對一次欄位名稱、網址是否跟這支程式一致，避免文件版本落差導致串接失敗。
// - 下面的 API_URL 是目前（2026年）常見的串接位置，如果实际测试失败，
//   請以你申請帳號時後台顯示或 PDF 手冊上的網址為準。

const crypto = require('crypto');

const API_URL = {
  test: 'https://ccore.newebpay.com/MPG/period',
  production: 'https://core.newebpay.com/MPG/period',
};

function encrypt(plainText, hashKey, hashIV) {
  const cipher = crypto.createCipheriv('aes-256-cbc', hashKey, hashIV);
  let encrypted = cipher.update(plainText, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return encrypted;
}

function shaChecksum(encryptedHex, hashKey, hashIV) {
  const str = `HashKey=${hashKey}&${encryptedHex}&HashIV=${hashIV}`;
  return crypto.createHash('sha256').update(str).digest('hex').toUpperCase();
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const MERCHANT_ID = process.env.NEWEBPAY_MERCHANT_ID;
  const HASH_KEY = process.env.NEWEBPAY_HASH_KEY;
  const HASH_IV = process.env.NEWEBPAY_HASH_IV;
  const ENV = process.env.NEWEBPAY_ENV || 'test';

  if (!MERCHANT_ID || !HASH_KEY || !HASH_IV) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: '尚未設定藍新金流金鑰。請到 Netlify 環境變數新增 NEWEBPAY_MERCHANT_ID、NEWEBPAY_HASH_KEY、NEWEBPAY_HASH_IV 後重新部署。',
      }),
    };
  }

  try {
    // 前端是用真正的 HTML <form> POST 過來（因為最終要導去藍新，不是單純AJAX拿資料），
    // 所以這裡收到的是 application/x-www-form-urlencoded 格式，不是 JSON
    const body = new URLSearchParams(event.body || '');
    const companyName = body.get('companyName') || '';
    const email = body.get('email') || '';
    if (!email) {
      return { statusCode: 400, body: JSON.stringify({ error: '請提供 Email' }) };
    }

    const siteUrl = process.env.URL || 'https://ancase.tw';
    const timestamp = Math.floor(Date.now() / 1000);
    const merOrderNo = 'AC' + timestamp; // 商店訂單編號，限英數字，不可重複

    // 委託單參數（每月扣款 NT$1,280，第一期立即用 10 元授權驗證卡片有效，
    // 不是馬上扣整月費用，這是業界標準做法，確認卡片可用後才會照週期正式扣款）
    const params = {
      RespondType: 'JSON',
      TimeStamp: timestamp,
      Version: '1.5',
      MerOrderNo: merOrderNo,
      ProdDesc: '案場通全功能方案訂閱',
      PeriodAmt: 1280,
      PeriodType: 'M',           // M = 每月
      PeriodPoint: new Date().getDate().toString().padStart(2, '0'), // 每月幾號扣款：用今天的日期
      PeriodStartType: 1,        // 1 = 立即執行10元授權（驗證卡片），不是馬上收整月費用
      PeriodTimes: 999,          // 授權期數上限（信用卡到期會自動停止，不用擔心扣到天荒地老）
      PeriodFirstdate: new Date().toISOString().split('T')[0].replace(/-/g, '/'),
      PeriodMemo: companyName || '案場通訂閱',
      PayerEmail: email,
      EmailModify: 0,
      ReturnURL: siteUrl + '/signup-success.html',
      NotifyURL: siteUrl + '/.netlify/functions/newebpay-notify',
      BackURL: siteUrl + '/signup.html',
    };

    const queryString = Object.entries(params)
      .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
      .join('&');

    const postData = encrypt(queryString, HASH_KEY, HASH_IV);
    const tradeSha = shaChecksum(postData, HASH_KEY, HASH_IV);

    // 回傳一段會自動送出的 HTML 表單（藍新的委託單建立是用表單 POST 導頁完成，不是單純回 JSON 網址）
    const formHtml = `<!DOCTYPE html><html><body onload="document.forms[0].submit()">
      <form method="POST" action="${API_URL[ENV]}">
        <input type="hidden" name="MerchantID_" value="${MERCHANT_ID}">
        <input type="hidden" name="PostData_" value="${postData}">
        <input type="hidden" name="TradeSha" value="${tradeSha}">
      </form>
      <p style="font-family:sans-serif;text-align:center;margin-top:100px;color:#666">正在導向付款頁面，請稍候…</p>
    </body></html>`;

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
      body: formHtml,
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
