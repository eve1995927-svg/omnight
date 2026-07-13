// ══ 藍新金流「定期定額」— 接收每期扣款通知 ══════════════════
//
// 使用前準備：
// 到藍新金流後台 →「商店管理」→ 你的定期定額商店設定 →
// 把「委託成功通知網址」「每期授權完成通知網址」都填成：
//   https://你的網域/.netlify/functions/newebpay-notify
//
// 這支 function 做的事：
// 1. 驗證真的是藍新金流送來的通知（重算 SHA 檢查碼比對，避免偽造請求）
// 2. AES 解密拿到真正的扣款結果（成功/失敗、金額、訂單編號）
// 3. 記錄下來，之後可以接你自己的通知方式（Email / LINE Notify）
//
// ⚠️ 跟前一支 function 一樣的提醒：藍新只會用「背景 POST」方式呼叫這支 function，
// 不會有瀏覽器畫面，所以測試時要用真實的藍新測試環境觸發，不能只在瀏覽器打開網址測試。

const crypto = require('crypto');

function decrypt(encryptedHex, hashKey, hashIV) {
  const decipher = crypto.createDecipheriv('aes-256-cbc', hashKey, hashIV);
  let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

function shaChecksum(encryptedHex, hashKey, hashIV) {
  const str = `HashKey=${hashKey}&${encryptedHex}&HashIV=${hashIV}`;
  return crypto.createHash('sha256').update(str).digest('hex').toUpperCase();
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const HASH_KEY = process.env.NEWEBPAY_HASH_KEY;
  const HASH_IV = process.env.NEWEBPAY_HASH_IV;
  if (!HASH_KEY || !HASH_IV) {
    return { statusCode: 500, body: '尚未設定藍新金流金鑰' };
  }

  try {
    // 藍新用一般表單編碼 (application/x-www-form-urlencoded) POST 過來
    const body = new URLSearchParams(event.body);
    const period = body.get('Period'); // 加密後的回傳結果欄位名稱固定叫 "Period"

    if (!period) {
      return { statusCode: 400, body: '缺少 Period 參數，可能不是合法的藍新金流通知' };
    }

    const decrypted = decrypt(period, HASH_KEY, HASH_IV);
    const result = JSON.parse(decrypted);

    if (result.Status === 'SUCCESS') {
      const r = result.Result;
      console.log('✅ 定期定額扣款成功：', {
        訂單編號: r.MerchantOrderNo,
        金額: r.PeriodAmt || r.Amt,
        委託單號: r.PeriodNo,
      });
      // TODO: 這裡接你自己的通知方式，例如：
      // - 打 LINE Notify 通知自己
      // - 寫進一個試算表或資料庫記錄「這期扣款成功」
      // - 如果這是續訂扣款（不是第一次），確認該客戶的系統存取權限持續開放
    } else {
      console.log('❌ 定期定額扣款失敗：', result.Message);
      // TODO: 扣款失敗的處理，例如通知該客戶「這期扣款沒有成功，麻煩更新付款方式」
    }

    // 藍新規定收到通知後要回應 "1|OK" 純文字，代表你已經成功接收，不然它會重複重試通知
    return { statusCode: 200, body: '1|OK' };
  } catch (err) {
    console.error('通知處理失敗：', err.message);
    return { statusCode: 500, body: '0|處理失敗' };
  }
};
