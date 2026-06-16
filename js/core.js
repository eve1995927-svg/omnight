

// ══ 全域變數宣告 ════════════
let ctImgUrl=null, ctEditId=null, ieId=null;
let invImgUrl=null, invIItems=[], ldItems=[], ldImgUrl=null;
let vItems=[], vCurrentFilter='all', curVType='image';
let curClientId=null, clientChats={};
let adSections=[], qSections=[], curQuoteMode='internal';
let _syncInterval=null, _punchSyncInterval=null;

// fileUrl 可能是字串（舊）或物件 {url,name,type}（新）
function getFileUrl(fileUrl){
  if(!fileUrl) return null;
  if(typeof fileUrl==='string') return fileUrl;
  if(typeof fileUrl==='object') return fileUrl.url||null;
  return null;
}
function isImageUrl(fileUrl){
  const url=getFileUrl(fileUrl);
  if(!url) return false;
  return url.startsWith('data:image')||url.match(/\.(jpg|jpeg|png|gif|webp)$/i);
}

// ══ CONFIG ════════════════════════════════════════════════
const ACCTS={
  owner:{user:'omnight',pass:'0923',name:'老闆',abbr:'老',role:'Owner · 最高權限',label:'老闆'},
  staff:{user:'member',pass:'zeju',name:'員工',abbr:'員',role:'Member',label:'員工'},
  punch:{user:'zeju1',pass:'zeju1',name:'公務',abbr:'公',role:'Punch',label:'打卡'},
  cs:{user:'member',pass:'zeju',name:'員工',abbr:'員',role:'Member',label:'員工'},
  mk:{user:'member',pass:'zeju',name:'員工',abbr:'員',role:'Member',label:'員工'},
  ad:{user:'member',pass:'zeju',name:'員工',abbr:'員',role:'Member',label:'員工'},
  ac:{user:'member',pass:'zeju',name:'員工',abbr:'員',role:'Member',label:'員工'},
};
const GROUPS={
  owner:[
    {l:'總覽',    items:[{id:'owner-dash',l:'儀表板',ic:'📊'}]},
    {l:'行銷(客服)',items:[{id:'cs-chat',l:'客戶諮詢',ic:'💬'},{id:'cs-quote',l:'快速報價',ic:'📐'},{id:'mk-post',l:'行銷小編',ic:'✨'}]},
    {l:'行政',     items:[{id:'ad-quote',l:'報價管理',ic:'📋'},{id:'ad-newquote',l:'新建報價',ic:'➕'},{id:'ad-vendor',l:'廠商報價',ic:'🏗️'},{id:'contract',l:'合約管理',ic:'📝'},{id:'ad-progress',l:'工程進度',ic:'🔧'}]},
    {l:'會計',     items:[{id:'ac-overview',l:'帳款總覽',ic:'💰'},{id:'ac-invoice',l:'發票管理',ic:'🧾'},{id:'ac-report',l:'財務報表',ic:'📊'},{id:'ac-billing',l:'AI 帳單',ic:'🧮'},{id:'ac-chat',l:'AI 對帳',ic:'🤖'}]},
    {l:'人資',     items:[{id:'hr-settings',l:'人資管理',ic:'👥'}]},
    {l:'系統',     items:[{id:'settings',l:'系統設定',ic:'🔧'}]},
  ],
  staff:[
    {l:'行銷(客服)',items:[{id:'cs-chat',l:'客戶諮詢',ic:'💬'},{id:'cs-quote',l:'快速報價',ic:'📐'},{id:'mk-post',l:'行銷小編',ic:'✨'}]},
    {l:'行政',     items:[{id:'ad-quote',l:'報價管理',ic:'📋'},{id:'ad-newquote',l:'新建報價',ic:'➕'},{id:'ad-vendor',l:'廠商報價',ic:'🏗️'},{id:'ad-progress',l:'工程進度',ic:'🔧'}]},
    {l:'系統',     items:[{id:'settings',l:'系統設定',ic:'🔧'}]},
  ],
  punch:[
    {l:'打卡',    items:[{id:'punch-clock',l:'上下班打卡',ic:'🕐'}]},
  ],
};
const SYS={
  owner:'你是澤居室內裝修的 AI 老闆助理。澤居是台灣在地統包裝修公司，服務台北、新北、桃園、三峽。電話：03-2605199，IG：@zeju0923，LINE：@zj8888。掌握全部資訊，以專業精準方式回應，繁體中文，主動提供建議。',
  cs:'你是澤居室內裝修的 AI 客服助理「小澤」。統包裝修，台北、新北、桃園、三峽。全室翻新每坪18,000–28,000元，廚房15–35萬，浴室8–20萬，老屋加20%。工期：全室45–60天，局部2–3週。付款：簽約30%/開工30%/七成完工30%/驗收10%。若有上傳照片請描述空間並給具體建議與初步報價。語氣溫暖親切，給具體數字，繁體中文。',
  mk:'你是澤居室內裝修的 AI 行銷小編。IG @zeju0923，LINE @zj8888。生成貼文：吸引人開頭、描述空間氛圍、Emoji≤5個、3–5個Hashtag含#澤居室內裝修、結尾CTA。120–200字，繁體中文，語氣溫暖質感。',
  ad:'你是澤居室內裝修的 AI 行政助理。電話：03-2605199，信箱：zeju0923@gmail.com。可協助：工程進度查詢、起草合約、整理廠商報價、安排排程。付款：簽約30%/開工30%/七成完工30%/驗收10%。繁體中文，專業嚴謹。',
  ac:'你是澤居室內裝修的 AI 會計助理。毛利=對外報價−廠商成本−管理費8%。目標毛利率28–35%。協助：帳款整理、毛利計算、成本分析、催款通知。數字精準，繁體中文，語氣專業嚴謹。',
};

// ══ DB ════════════════════════════════════════════════════
// ══ DB：雲端同步版本（window.storage）══════════════════════
// 記憶體 cache（同步讀取用）
// ══ Firebase 設定 ═══════════════════════════════════════
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyCOvRcTbj0z9cPMOYxicnqbzHLsUP-jOHg",
  authDomain: "zeju-62388.firebaseapp.com",
  databaseURL: "https://zeju-62388-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "zeju-62388",
  storageBucket: "zeju-62388.firebasestorage.app",
  messagingSenderId: "424082469080",
  appId: "1:424082469080:web:247e960d4b604b7c11a7ad"
};
let _fbDB = null;
let _fbReady = false;

function setSyncStatus(status){
  const ico=document.getElementById('syncIco');
  const txt=document.getElementById('syncTxt');
  const dot=document.getElementById('syncDot2');
  const wrap=document.getElementById('syncDot');
  if(!ico||!txt)return;
  const map={
    syncing:{i:'⏳',t:'同步中',c:'var(--g400)',dc:'var(--warn)',bc:'var(--g200)'},
    ok:     {i:'☁️',t:'已同步',c:'var(--ok)',  dc:'var(--ok)', bc:'rgba(34,197,94,.2)'},
    offline:{i:'💾',t:'本機模式',c:'var(--warn)',dc:'var(--warn)',bc:'rgba(245,158,11,.2)'},
    error:  {i:'⚠️',t:'同步失敗',c:'var(--bad)', dc:'var(--bad)', bc:'rgba(239,68,68,.2)'},
  };
  const cfg=map[status]||map.offline;
  ico.textContent=cfg.i;
  txt.textContent=cfg.t;
  txt.style.color=cfg.c;
  if(dot){dot.style.background=cfg.dc;}
  if(wrap){wrap.style.borderColor=cfg.bc;}
  // 儲存最後狀態
  window._lastSyncStatus=status;
  window._lastSyncTime=new Date().toLocaleTimeString('zh-TW',{hour12:false});
}

function initFirebase(){
  try{
    if(typeof firebase==='undefined'){
      console.warn('Firebase SDK not loaded');
      setSyncStatus('offline');
      return false;
    }
    if(!firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);
    _fbDB = firebase.database();
    _fbReady = true;
    setSyncStatus('syncing');
    return true;
  }catch(e){
    console.warn('Firebase:',e.message);
    setSyncStatus('error');
    return false;
  }
}

const _cache = {};
const _KEYS = ['quotes','vendors','invoices','contracts','progress','ledger','billing',
               'employees','punch_recs','punch_requests','clients','zeju_quotes',
               'chat_mk','chat_cs','chat_ac','chat_ad','post_history','reports'];

// 初始化：從雲端載入所有資料到 cache
async function initCloudDB(){
  // 先嘗試 Firebase
  if(initFirebase()){
    return new Promise(res=>{
      _fbDB.ref('zeju_data').once('value', snap=>{
        const data=snap.val()||{};
        _KEYS.forEach(k=>{
          if(data[k]){
            // 確保是陣列格式
            _cache[k]=Array.isArray(data[k])?data[k]:Object.values(data[k]).filter(x=>x&&typeof x==='object');
          }
          else{try{const v=localStorage.getItem('z7_'+k);if(v)_cache[k]=JSON.parse(v);}catch{}}
        });
        console.log('✅ Firebase data loaded');
        setSyncStatus('ok');
        res(true);
      }, ()=>{
        _KEYS.forEach(k=>{try{const v=localStorage.getItem('z7_'+k);if(v)_cache[k]=JSON.parse(v);}catch{}});
        setSyncStatus('offline');
        res(false);
      });
    });
  }
  // Fallback: localStorage
  _KEYS.forEach(k=>{try{const v=localStorage.getItem('z7_'+k);if(v)_cache[k]=JSON.parse(v);}catch{}});
  setSyncStatus('offline');
  return false;
}

// 同步寫入雲端
function _cloudSet(k, arr){
  // localStorage 備份
  try{localStorage.setItem('z7_'+k, JSON.stringify(arr));}catch{}
  // Firebase 即時同步
  if(_fbDB&&_fbReady){
    _fbDB.ref('zeju_data/'+k).set(arr).catch(e=>console.warn('FB write:',k,e.message));
  }
}

const DB={
  getAll(k){
    // 先從 cache 取（包含已刪除項目）
    if(_cache[k]!==undefined){
      const v=_cache[k];
      if(Array.isArray(v)) return [...v];
      // Firebase 有時回傳物件 {0:item, 1:item}，轉成陣列
      if(v&&typeof v==='object') return Object.values(v).filter(x=>x&&typeof x==='object');
      return [];
    }
    // 降級用 localStorage
    try{
      const raw=localStorage.getItem('z7_'+k);
      if(!raw)return[];
      const parsed=JSON.parse(raw);
      return Array.isArray(parsed)?parsed:[];
    }catch{return[];}
  },
  get(k){
    // 預設過濾已軟刪除的項目
    return DB.getAll(k).filter(r=>!r.deleted);
  },
  getDeleted(k){
    return DB.getAll(k).filter(r=>r.deleted);
  },
  set(k,v){
    _cache[k]=v;
    _cloudSet(k,v);
    // 同時也存 localStorage 備份
    try{localStorage.setItem('z7_'+k,JSON.stringify(v))}catch{}
  },
  push(k,item){
    const a=DB.getAll(k);
    a.unshift({...item,_id:Date.now(),_ts:new Date().toLocaleString('zh-TW')});
    if(a.length>500)a.pop();
    DB.set(k,a);
    return a;
  },
  del(k,id){
    // 永久刪除
    const a=DB.getAll(k).filter(r=>r._id!==id);
    DB.set(k,a);
    return a;
  },
  softDel(k,id){
    // 軟刪除（移到垃圾桶）
    const a=DB.getAll(k).map(r=>r._id===id?{...r,deleted:true,deletedAt:new Date().toLocaleString('zh-TW'),deletedBy:curRole||'unknown'}:r);
    DB.set(k,a);
    return a;
  },
  restore(k,id){
    // 從垃圾桶復原
    const a=DB.getAll(k).map(r=>{
      if(r._id!==id)return r;
      const {deleted,deletedAt,deletedBy,...rest}=r;
      return rest;
    });
    DB.set(k,a);
    return a;
  },
  upd(k,id,patch){
    const a=DB.getAll(k).map(r=>r._id===id?{...r,...patch}:r);
    DB.set(k,a);
    return a;
  },
};

// ── 垃圾桶可支援的資料類型 ──────────────────────────────
const TRASH_TYPES={
  contracts:{label:'合約',icon:'📄',name:r=>r.name||r.title||'未命名合約'},
  vendors:{label:'廠商報價',icon:'🏗️',name:r=>(r.vendor||'未命名廠商')+' / '+(r.cat||'')},
  ledger:{label:'帳款',icon:'💰',name:r=>r.summary||r.desc||'未命名帳款'},
};

function renderTrashBin(){
  const c=document.getElementById('trashList');if(!c)return;
  c.innerHTML='';
  let total=0;
  Object.keys(TRASH_TYPES).forEach(k=>{
    const meta=TRASH_TYPES[k];
    const items=DB.getDeleted(k);
    if(!items.length)return;
    items.forEach(item=>{
      total++;
      const row=document.createElement('div');
      row.className='card';
      row.style.cssText='display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:8px;padding:12px 14px';
      const left=document.createElement('div');
      left.style.cssText='flex:1;min-width:0';
      left.innerHTML='<div style="font-size:.85rem;font-weight:700">'+meta.icon+' '+esc(meta.name(item))+'</div>'+
        '<div style="font-size:.72rem;color:var(--g400);margin-top:2px">'+meta.label+' · 刪除於 '+(item.deletedAt||'')+'（'+(item.deletedBy||'')+'）</div>';
      const btns=document.createElement('div');
      btns.style.cssText='display:flex;gap:6px;flex-shrink:0';
      const restoreBtn=document.createElement('button');
      restoreBtn.className='btn bg bsm';restoreBtn.textContent='↩️ 復原';
      restoreBtn.addEventListener('click',()=>{
        DB.restore(k,item._id);
        showToast('✅ 已復原');
        renderTrashBin();
        // 重新整理對應列表
        if(k==='contracts'&&typeof renderContracts==='function'){renderContracts();updContractStats();}
        if(k==='vendors'&&typeof renderVendors==='function'){renderVendors(vCurrentFilter);updStats();}
        if(k==='ledger'&&typeof renderLedger==='function'){renderLedger();updLedgerStats();}
      });
      const permaBtn=document.createElement('button');
      permaBtn.className='btn bo bsm';permaBtn.style.color='var(--bad)';permaBtn.textContent='🗑️ 永久刪除';
      permaBtn.addEventListener('click',()=>{
        if(!confirm('確定永久刪除「'+meta.name(item)+'」？此動作無法復原！'))return;
        DB.del(k,item._id);
        showToast('✅ 已永久刪除');
        renderTrashBin();
      });
      btns.appendChild(restoreBtn);btns.appendChild(permaBtn);
      row.appendChild(left);row.appendChild(btns);
      c.appendChild(row);
    });
  });
  if(!total){
    c.innerHTML='<div class="empty-state"><div class="es-ic">🗑️</div><div class="es-t">垃圾桶是空的</div></div>';
  }
  const cnt=document.getElementById('trashCount');
  if(cnt)cnt.textContent=total>0?('('+total+')'):'';
}

// ── 輪詢同步（每30秒從雲端重新載入，確保多裝置同步）──
function startCloudSync(){
  if(!_fbDB||!_fbReady){
    console.log('Firebase not ready, skip sync');
    setSyncStatus('offline');
    return;
  }
  setSyncStatus('syncing');
  // Firebase 即時監聽所有資料
  _fbDB.ref('zeju_data').on('value', snap=>{
    const data=snap.val()||{};
    let hasPunchChange=false, hasReqChange=false;
    _KEYS.forEach(k=>{
      if(data[k]){
        const oldLen=(_cache[k]||[]).length;
        const newArr=Array.isArray(data[k])?data[k]:Object.values(data[k]).filter(x=>x&&typeof x==='object');
        _cache[k]=data[k];
        if(k==='punch_recs'&&newArr.length!==oldLen) hasPunchChange=true;
        if(k==='punch_requests'&&newArr.length!==oldLen) hasReqChange=true;
      }
    });
    setSyncStatus&&setSyncStatus('ok');
    // 老闆端打卡有更新
    if(hasPunchChange&&curRole==='owner'){
      const pb=document.getElementById('hrb-punch');
      if(pb&&pb.classList.contains('on')){renderHRPanel();updHRStats&&updHRStats();}
      else updHRStats&&updHRStats();
    }
    if(hasReqChange&&curRole==='owner'){
      updateHRBadge();
      const hp=document.getElementById('p-hr-settings');
      if(hp&&hp.classList.contains('show'))renderHRPanel();
    }
  }, ()=>setSyncStatus&&setSyncStatus('error'));
  console.log('✅ Firebase realtime listener started');
}

// ── 備份/還原也寫入雲端 ──


// ══ API KEY ═══════════════════════════════════════════════
let API_KEY=localStorage.getItem('zeju_apikey')||'';
// API 透過後端 proxy 呼叫，不需要 key

// API key 存在 Netlify 環境變數，透過 proxy 呼叫
// ══ API KEY 頂層函式（直接呼叫，無依賴問題）════════════════
function apiSaveKey(){
  const inp = document.getElementById('apiInp');
  const v = inp ? inp.value.trim() : '';
  if(!v){ alert('⚠️ 請輸入 API Key'); return; }
  if(!v.startsWith('sk-ant-')){
    alert('⚠️ Key 格式不正確\n正確格式應以 sk-ant- 開頭'); return;
  }
  API_KEY = v;
  localStorage.setItem('zeju_apikey', v);
  // 更新狀態點
  const dot = document.getElementById('apiDot');
  if(dot){ dot.textContent='✅ 已設定'; dot.style.background='var(--ok-bg)'; dot.style.color='var(--ok)'; }
  alert('✅ API Key 已儲存！\nAI 功能全面啟用，可按「測試連線」確認。');
}

function apiClearKey(){
  if(!confirm('確定清除 API Key？\n清除後所有 AI 功能將停用。')) return;
  API_KEY = '';
  localStorage.removeItem('zeju_apikey');
  const inp = document.getElementById('apiInp'); if(inp) inp.value = '';
  const dot = document.getElementById('apiDot');
  if(dot){ dot.textContent='⚠️ 未設定'; dot.style.background='var(--warn-bg)'; dot.style.color='var(--warn)'; }
  const res = document.getElementById('apiTestResult'); if(res) res.style.display='none';
  alert('已清除 API Key。');
}

async function apiTestConn(){
  const res = document.getElementById('apiTestResult');
  const setRes = (bg, bd, color, html) => {
    if(!res) return;
    res.style.cssText = 'display:block;margin-top:12px;padding:14px 16px;border-radius:10px;font-size:.88rem;font-weight:600;line-height:1.7;background:'+bg+';border:1.5px solid '+bd+';color:'+color;
    res.innerHTML = html;
  };

  const btn = event.target;
  btn.textContent = '⏳ 測試中…'; btn.disabled = true;
  setRes('#EBF3FF','#A0C4F0','#1A5490','🔄 正在連線，請稍候…');

  try{
    const r = await fetch('/.netlify/functions/ai-proxy', { method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 3000,
        messages: [{ role:'user', content:'請用繁體中文回答：你好！' }]
      })
    });

    const d = await r.json();

    if(!r.ok){
      const msg = d.error?.message || '';
      if(r.status === 401)
        setRes('#FEF0F0','#F0A8A8','#B82828','❌ <strong>Key 錯誤或已失效</strong><br>請到 console.anthropic.com 取得新的 Key');
      else if(msg.includes('quota') || msg.includes('credit'))
        setRes('#FEF0F0','#F0A8A8','#B82828','❌ <strong>帳戶餘額不足</strong><br>請到 console.anthropic.com → Billing 儲值');
      else
        setRes('#FEF0F0','#F0A8A8','#B82828','❌ 連線失敗（'+r.status+'）：'+msg);
    } else {
      const reply = d.content?.[0]?.text || '連線成功';
      setRes('#EDFAF4','#98DEC0','#1E7A58','✅ <strong>連線成功！AI 正常運作</strong><br>AI 回覆：' + reply);
    }
  } catch(err){
    setRes('#FEF0F0','#F0A8A8','#B82828','❌ <strong>網路錯誤</strong><br>請確認網路連線是否正常<br><small>'+err.message+'</small>');
  }

  btn.textContent = '🔌 測試連線'; btn.disabled = false;
}





// ══ TOAST ════════════════════════════════════════════════
function openModal(id){const el=document.getElementById(id);if(el)el.classList.add('show');}
function closeModal(id){const el=document.getElementById(id);if(el)el.classList.remove('show');}

function showToast(msg,dur=2600){const t=document.getElementById('toast');if(!t)return;t.textContent=msg;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),dur);}

// ══ LIGHTBOX ═════════════════════════════════════════════
function openLB(src){document.getElementById('lbimg').src=src;document.getElementById('lb').classList.add('show');}

// ══ LOGIN ════════════════════════════════════════════════
let curRole='owner';
let curPunchUser='owner'; // 打卡識別用：個人帳號為 'emp_'+員工id，共用帳號為角色名

// ── 自動恢復登入狀態 ──────────────────────────────────────
(function autoRestore(){
  const savedRole = localStorage.getItem('zeju_session_role');
  const savedTs = parseInt(localStorage.getItem('zeju_session_ts')||'0');
  const EIGHT_HOURS = 8 * 60 * 60 * 1000;
  // session 8小時內有效
  if(savedRole && (Date.now()-savedTs) < EIGHT_HOURS){
    curRole = savedRole;
    // 等 DOM 完全載入後自動跳過登入
    window.addEventListener('DOMContentLoaded',()=>{
      const ls=document.getElementById('ls');
      const app=document.getElementById('app');
      if(!ls||!app)return;
      ls.style.display='none';
      app.style.display='flex';
      initCloudDB().then(()=>{
        startCloudSync();
        setupApp(curRole);
      });
    });
  }
})();
document.getElementById('lRoleGrid')?.addEventListener('click',e=>{
  const btn=e.target.closest('[data-role]');if(!btn)return;
  curRole=btn.dataset.role;
  document.querySelectorAll('.lrb').forEach(b=>b.classList.remove('on'));
  btn.classList.add('on');
  document.getElementById('lUser').value=ACCTS[curRole].user;
  // 公務角色：顯示員工個人打卡帳號欄位（選填）
  const empAccEl=document.getElementById('lEmpAccount');
  if(empAccEl){
    empAccEl.style.display=(curRole==='punch')?'block':'none';
    if(curRole!=='punch')empAccEl.value='';
  }
});
document.getElementById('lBtn').addEventListener('click',doLogin);
document.getElementById('lPass').addEventListener('keydown',e=>{if(e.key==='Enter')doLogin();});
let _punchEmployee=null; // 個人打卡帳號登入時，記錄對應員工資料

function doLogin(){
  const p=document.getElementById('lPass').value.trim();
  const err=document.getElementById('lErr');
  if(!p){err.style.display='block';err.textContent='請輸入密碼';return;}

  _punchEmployee=null;

  if(curRole==='punch'){
    const empAcc=(document.getElementById('lEmpAccount')?.value||'').trim();
    if(empAcc){
      // 員工個人打卡帳號登入
      const emp=DB.getAll('employees').find(e=>e.account===empAcc&&!e.deleted);
      if(!emp||emp.password!==p){
        err.style.display='block';
        err.textContent='打卡帳號或密碼不正確，請再試一次';
        return;
      }
      _punchEmployee=emp;
    } else {
      // 共用公務帳號
      if(p!=='zeju1'){
        err.style.display='block';
        err.textContent='密碼不正確，請重新輸入';
        return;
      }
    }
  } else {
    const pwMap={owner:'0923',staff:'zeju'};
    const correctPw=pwMap[curRole];
    if(!correctPw||p!==correctPw){
      err.style.display='block';
      err.textContent='密碼不正確，請重新輸入';
      return;
    }
  }
  err.style.display='none';
  // 儲存登入狀態
  localStorage.setItem('zeju_session_role', curRole);
  localStorage.setItem('zeju_session_ts', Date.now());
  if(_punchEmployee){
    localStorage.setItem('zeju_punch_emp_id', _punchEmployee._id);
    localStorage.setItem('zeju_punch_emp_name', _punchEmployee.name);
  } else {
    localStorage.removeItem('zeju_punch_emp_id');
    localStorage.removeItem('zeju_punch_emp_name');
  }
  const ls=document.getElementById('ls');
  ls.style.opacity='0';
  ls.style.transition='opacity .4s';
  const loadingEl=document.getElementById('lBtn');
  if(loadingEl){loadingEl.textContent='⏳ 同步資料中…';loadingEl.disabled=true;}
  initCloudDB().then(()=>{
    startCloudSync();
    ls.style.display='none';
    const app=document.getElementById('app');
    app.style.display='flex';
    setupApp(curRole);
  });
}


// ══ APP SETUP ════════════════════════════════════════════
function setupApp(role){
  const a = ACCTS[role];
  const nameMap = {owner:'老闆',staff:'員工',punch:'公務'};

  // 更新右上角
  const uDot=document.getElementById('uDot');
  const uName=document.getElementById('uName');
  const aName=document.getElementById('aName');
  const aRole=document.getElementById('aRole');
  // 個人打卡帳號登入：顯示員工本人姓名
  const empName=localStorage.getItem('zeju_punch_emp_name');
  const empId=localStorage.getItem('zeju_punch_emp_id');
  const displayName=(role==='punch'&&empName)?empName:(a?.name||nameMap[role]||role);
  curPunchUser=(role==='punch'&&empId)?('emp_'+empId):role;

  if(uDot)uDot.textContent=(role==='punch'&&empName)?empName.charAt(0):(a?.abbr||'?');
  if(uName)uName.textContent=displayName;
  if(aName)aName.textContent=displayName;
  if(aRole)aRole.textContent=(role==='punch'&&empName)?'員工打卡':(a?.role||'');

  // 公務帳號：只顯示打卡介面
  if(role==='punch'){
    buildTabs(role);
    buildSidebar(role,GROUPS[role]?.[0]?.l);
    buildBN(role);
    showPanel(GROUPS[role]?.[0]?.items?.[0]?.id||'punch-clock');
    initPunchClock();
    const pb=document.getElementById('ptsBar');if(pb)pb.style.display='none';
    return;
  }

  // 一般登入
  const pb=document.getElementById('ptsBar');if(pb)pb.style.display='';
  buildTabs(role);
  buildSidebar(role,GROUPS[role]?.[0]?.l);
  buildBN(role);
  showPanel(GROUPS[role]?.[0]?.items?.[0]?.id||'owner-dash');
  initAllChats();
  initApiCard();
  renderHistory();
  renderVendors('all');
  renderInvoices('');
  updStats();
  renderQTable();
  renderAdVendorPicker();
  renderContracts();
  updContractStats();
  renderLedger();
  updLedgerStats();
  // 初始化點數（第一次使用設為 76500）
  if(!localStorage.getItem('zeju_pts')) localStorage.setItem('zeju_pts','76500');
  updatePtsDisplay();
  renderBilling();
  initSettings();
  updVCaseFilter();
  renderProgress();
  renderEmployees();
  updHRStats();
  initAdQuote();
  initContractListeners();
  initMultiClientChat();
  initMobileNav(role);
  // 登入後：如果 Firebase 空但 localStorage 有資料，提示上傳
  setTimeout(()=>checkAndOfferUpload(), 2000);
  // Firebase 在 initCloudDB() 裡初始化
  checkPaymentTriggers();

  if(role==='owner'){
    renderHRPanel();
    const ba=localStorage.getItem('zeju_bank_acct');
    if(ba){const el=document.getElementById('bilBankAcct');if(el)el.textContent=ba;}
  }

  setTimeout(()=>{
    
  },600);
}
const IMAP={owner:'👑',cs:'💬',mk:'✨',ad:'📋',ac:'📊'};
function buildTabs(role){
  const tabs=document.getElementById('rTabs');tabs.innerHTML='';
  if(role==='punch')return;
  // 每個分組顯示一個 Tab，點了展開到第一個功能
  const grps=GROUPS[role]||[];
  grps.forEach(grp=>{
    const b=document.createElement('button');
    b.className='rtab';b.dataset.grp=grp.l;
    b.textContent=grp.l;
    b.addEventListener('click',()=>{
      showPanel(grp.items[0].id);
      document.querySelectorAll('.rtab').forEach(t=>t.classList.remove('on'));
      b.classList.add('on');
      // 同步側欄
      buildSidebar(role, grp.l);
    });
    tabs.appendChild(b);
  });
  // 預設選第一個
  if(tabs.firstChild)tabs.firstChild.classList.add('on');
}
function syncTabActive(panelId){
  // 找這個 panel 屬於哪個分組
  const role=curRole;const grps=GROUPS[role]||[];
  const grp=grps.find(g=>g.items.some(i=>i.id===panelId));
  if(!grp)return;
  document.querySelectorAll('.rtab').forEach(t=>t.classList.toggle('on',t.dataset.grp===grp.l));
  buildSidebar(role,grp.l);
}
function buildSidebar(role, activeGrp){
  const nav=document.getElementById('sNav');nav.innerHTML='';
  const grps=GROUPS[role]||[];
  // 只顯示當前分組的側欄項目
  const showGrp=activeGrp||grps[0]?.l;
  const grp=grps.find(g=>g.l===showGrp)||grps[0];
  if(!grp)return;
  const sec=document.createElement('div');sec.className='sb-sec';
  sec.innerHTML='<div class="sb-lbl">'+grp.l+'</div>';
  grp.items.forEach(item=>{
    const el=document.createElement('div');el.className='ni';el.id='nav-'+item.id;
    el.innerHTML='<span class="ic">'+item.ic+'</span>'+item.l;
    el.addEventListener('click',()=>showPanel(item.id));
    sec.appendChild(el);
  });
  nav.appendChild(sec);
  updateHRBadge();
}
function buildBN(role){
  const bn=document.getElementById('bn');bn.innerHTML='';
  GROUPS[role].flatMap(g=>g.items).slice(0,6).forEach(item=>{
    const b=document.createElement('button');b.className='bni';b.id='bn-'+item.id;
    b.innerHTML='<span class="bnic">'+item.ic+'</span><span>'+item.l.slice(0,4)+'</span>';
    b.addEventListener('click',()=>showPanel(item.id));bn.appendChild(b);
  });
  updateHRBadge();
}

// ── 老闆端：人資管理 待審核打卡申請 紅點通知 ──────────────
function updateHRBadge(){
  if(curRole!=='owner')return;
  let count=0;
  try{count=DB.get('punch_requests').filter(r=>r.status==='pending').length;}catch{}
  ['nav-hr-settings','bn-hr-settings'].forEach(id=>{
    const el=document.getElementById(id);if(!el)return;
    let badge=el.querySelector?el.querySelector('.hr-badge'):null;
    if(count>0){
      if(!badge){
        badge=document.createElement('span');badge.className='hr-badge';
        badge.style.cssText='background:var(--bad,#E04848);color:#fff;font-size:.65rem;font-weight:800;border-radius:10px;padding:1px 6px;margin-left:6px;vertical-align:middle';
        el.appendChild(badge);
      }
      badge.textContent=count;
    } else if(badge){badge.remove();}
  });
}
function switchRole(role){curRole=role;const a=ACCTS[role];document.getElementById('uDot').textContent=a.abbr;document.getElementById('uName').textContent=a.name;document.getElementById('aName').textContent=a.name;document.getElementById('aRole').textContent=a.role;buildTabs(role);buildSidebar(role,GROUPS[role]?.[0]?.l);buildBN(role);showPanel(GROUPS[role]?.[0]?.items[0]?.id||'owner-dash');}
function showPanel(id){
  if(id==='ac-billing') setTimeout(()=>renderBilling(),100);
  // 切換到新建報價時重設按鈕綁定
  if(id==='ad-settings'){
    const btn=document.getElementById('adSave');
    if(btn)btn._bound=false;
    setTimeout(()=>initAdQuote(),50);
  }document.querySelectorAll('.panel').forEach(p=>p.classList.remove('on'));document.querySelectorAll('.ni,.bni').forEach(n=>n.classList.remove('on'));document.getElementById('p-'+id)?.classList.add('on');document.getElementById('nav-'+id)?.classList.add('on');document.getElementById('bn-'+id)?.classList.add('on');document.querySelector('.ws')?.scrollTo(0,0);syncTabActive(id);}

// ══ HISTORY ══════════════════════════════════════════════
function renderHistory(){
  const hs=document.getElementById('histSec'),hl=document.getElementById('histList');if(!hs||!hl)return;
  let recs=[];['chat_cs','chat_mk','chat_ad','chat_ac','chat_owner','quotes','vendors','invoices'].forEach(k=>DB.get(k).forEach(r=>recs.push({...r,_k:k})));
  recs.sort((a,b)=>b._id-a._id);recs=recs.slice(0,20);
  if(!recs.length){hs.style.display='none';return;}
  hs.style.display='block';hl.innerHTML='';
  recs.forEach(r=>{const el=document.createElement('div');el.className='hi';el.innerHTML='<div class="hi-t">'+(r._ts||'').split(' ')[0]+'</div><div class="hi-x">'+(r.summary||'').slice(0,34)+'</div>';hl.appendChild(el);});
}

// ══ AI API ════════════════════════════════════════════════
const cHist={};
// ══ AI 錯誤訊息友善化 ════════════════════════════════════
function friendlyAIError(err){
  const msg=(err&&err.message)||'';
  if(msg==='network_err') return '⚠️ 網路連線異常，請檢查網路後再試一次';
  if(msg==='proxy_404') return '⚠️ AI服務尚未設定完成，請聯絡老闆檢查後台設定';
  if(msg==='auth_err') return '⚠️ AI服務驗證失敗，請聯絡老闆檢查 API 設定';
  if(msg==='quota_err') return '⚠️ AI使用額度已用完，請聯絡老闆儲值或稍後再試';
  if(msg.startsWith('api_err')) return '⚠️ AI服務暫時異常（'+msg.replace('api_err_','代碼')+'），請稍後再試';
  return '⚠️ AI暫時無法使用，請稍後再試或聯絡老闆';
}

async function callAI(role,content,maxTok=1200){
  if(!cHist[role])cHist[role]=[];
  const hist=cHist[role];
  hist.push({role:'user',content:typeof content==='string'?content:content});
  let r;
  try{
    r=await fetch('/.netlify/functions/ai-proxy',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({model:'claude-sonnet-4-6',max_tokens:maxTok,system:SYS[role],messages:hist})
    });
  }catch(netErr){
    throw new Error('network_err');
  }
  if(!r.ok){
    const e=await r.json().catch(()=>({}));
    if(r.status===404) throw new Error('proxy_404');
    if(r.status===401||r.status===403) throw new Error('auth_err');
    if(r.status===429||(e.error?.message||'').includes('credit')||(e.error?.message||'').includes('quota')) throw new Error('quota_err');
    throw new Error(e.error?.message||'api_err_'+r.status);
  }
  const d=await r.json();
  const rep=d.content?.map(c=>c.text||'').join('')||'';
  hist.push({role:'assistant',content:rep});if(hist.length>40)hist.splice(0,2);

  // ── 扣除點數 ──────────────────────────────────────────
  const tokUsed=(d.usage?.input_tokens||0)+(d.usage?.output_tokens||0);
  const pts=Math.min(500,Math.max(1,Math.round(tokUsed/20)));
  POINTS=Math.max(0,POINTS-pts);
  // 更新顯示
  const ptsEl=document.getElementById('ptsNum');if(ptsEl)ptsEl.textContent=POINTS.toLocaleString();
  // 存到 localStorage
  localStorage.setItem('zeju_pts',POINTS);
  // 同步到雲端
  if(typeof window.storage!=='undefined'){
    window.storage.set('zeju_pts',String(POINTS)).catch(()=>{});
  }
  // 記錄使用
  const roleNames={cs:'客服對話',mk:'行銷貼文',ad:'報價/廠商辨識',ac:'發票/帳款辨識'};
  const now=new Date();
  DB.push('billing',{
    summary:'AI '+( roleNames[role]||role)+' -'+pts+'點',
    desc:roleNames[role]||role,
    role,
    points:pts,
    tokens:tokUsed,
    user:curRole||'unknown',
    ts:now.toLocaleString('zh-TW'),
    month:now.getFullYear()+'-'+(now.getMonth()+1).toString().padStart(2,'0'),
    day:now.toLocaleDateString('zh-TW'),
  });

  return rep;
}
const FB={owner:'請告訴我您最想了解哪個面向。',cs:'感謝詢問！設計師將在24小時內聯繫您 🏠 急需請致電03-2605199',mk:'好的！請查看右側預覽，如需調整隨時告訴我。',ad:'收到！如需起草合約或文件，請告知細節。',ac:'已分析帳務。需要起草催款通知嗎？'};

// ══ CHAT ENGINE ════════════════════════════════════════════
const cSt={};
function initChat(cid,role,h,greet,quicks){
  const el=document.getElementById(cid);if(!el)return;
  cSt[cid]={role,imgs:[],files:[]};el.style.height='calc(100vh - 240px)';el.style.minHeight='320px';el.style.display='flex';el.style.flexDirection='column';el.style.resize='vertical';el.style.overflow='hidden';
  const msId='ms-'+cid,prId='pr-'+cid,inId='in-'+cid,fiId='fi-'+cid;
  const qh=quicks?.length?'<div class="qrw">'+quicks.map(q=>'<button class="qchip" data-q="'+encodeURIComponent(q)+'">'+q+'</button>').join('')+'</div>':'';
  el.innerHTML='<div class="chat-wrap" style="flex:1;display:flex;flex-direction:column;min-height:0;overflow:hidden"><div class="cms" id="'+msId+'" style="flex:1;min-height:0;overflow-y:auto"></div>'+qh+'<div class="cia"><div class="apr" id="'+prId+'"></div><div class="ir"><button class="attb" id="ab-'+cid+'">📎</button><input type="file" id="'+fiId+'" accept="image/*,.pdf" multiple style="display:none"><textarea class="cta" id="'+inId+'" rows="2" placeholder="輸入訊息，或點 📎 上傳照片…"></textarea><button class="sndb" id="sb-'+cid+'"><svg viewBox="0 0 24 24"><path d="M2 21l21-9L2 3v7l15 2-15 2z"/></svg></button></div></div></div>';
  el.querySelectorAll('.qchip').forEach(ch=>ch.addEventListener('click',()=>chatQ(cid,decodeURIComponent(ch.dataset.q))));
  document.getElementById('ab-'+cid).addEventListener('click',()=>document.getElementById(fiId).click());
  document.getElementById(fiId).addEventListener('change',ev=>{chatFiles(cid,ev,prId);ev.target.value='';});
  document.getElementById(inId).addEventListener('keydown',ev=>{if(ev.key==='Enter'&&!ev.shiftKey){ev.preventDefault();chatSend(cid);}});
  document.getElementById('sb-'+cid).addEventListener('click',()=>chatSend(cid));
  addBbl(cid,'ai',greet);
}
function chatFiles(cid,ev,prId){
  const st=cSt[cid];const prev=document.getElementById(prId);
  Array.from(ev.target.files).forEach(f=>{
    if(f.type.startsWith('image/')){
      const rd=new FileReader();rd.onload=e=>{const url=e.target.result;st.imgs.push({name:f.name,b64:url.split(',')[1],mime:f.type,url});const w=document.createElement('div');w.className='ithw';const img=document.createElement('img');img.className='ith';img.src=url;img.style.cssText='width:52px;height:52px';img.addEventListener('click',()=>openLB(url));const d=document.createElement('div');d.className='idel';d.textContent='✕';d.addEventListener('click',()=>{st.imgs=st.imgs.filter(i=>i.name!==f.name);w.remove();});w.appendChild(img);w.appendChild(d);prev.appendChild(w);};rd.readAsDataURL(f);
    }else{st.files.push({name:f.name});const t=document.createElement('div');t.style.cssText='font-size:.75rem;display:inline-flex;align-items:center;gap:6px;background:var(--info-bg);border:1px solid var(--info-bd);color:var(--info);padding:5px 12px;border-radius:20px;font-weight:700';t.textContent='📄 '+f.name;const d=document.createElement('span');d.style.cssText='cursor:pointer;color:var(--bad);font-weight:900;margin-left:2px';d.textContent=' ✕';d.addEventListener('click',()=>{st.files=st.files.filter(fi=>fi.name!==f.name);t.remove();});t.appendChild(d);prev.appendChild(t);}
  });
}
async function chatSend(cid){
  const st=cSt[cid];const inp=document.getElementById('in-'+cid);const text=inp.value.trim();if(!text&&!st.imgs.length&&!st.files.length)return;
  inp.value='';if(text)addBbl(cid,'user',text);st.imgs.forEach(i=>addImgBbl(cid,'user',i.url));st.files.forEach(f=>addFileBbl(cid,'user',f.name));document.getElementById('pr-'+cid).innerHTML='';
  const parts=[];st.imgs.forEach(i=>parts.push({type:'image',source:{type:'base64',media_type:i.mime,data:i.b64}}));st.files.forEach(f=>parts.push({type:'text',text:'[上傳：'+f.name+']'}));if(text)parts.push({type:'text',text});
  const sum=(text||(st.imgs.length?'上傳照片':'上傳檔案')).slice(0,60);st.imgs=[];st.files=[];
  const ty=addTyping(cid);
  try{const content=parts.length===1&&parts[0].type==='text'?text:parts;const rep=await callAI(st.role,content);ty.remove();addBbl(cid,'ai',rep);DB.push('chat_'+st.role,{summary:sum,reply:rep.slice(0,80)});renderHistory();}
  catch(err){ty.remove();addBbl(cid,'ai',friendlyAIError(err));console.error('chatSend err:',err);}
}
function chatQ(cid,text){document.getElementById('in-'+cid).value=text;chatSend(cid);}
function addBbl(cid,role,text){const ms=document.getElementById('ms-'+cid);if(!ms)return;const d=document.createElement('div');d.className='msg'+(role==='user'?' u':'');const esc=text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/\n/g,'<br>');d.innerHTML='<div class="av '+(role==='ai'?'avai':'avus')+'">'+(role==='ai'?'澤':'我')+'</div><div class="mi"><div class="bbl '+(role==='ai'?'bai':'bus')+'">'+esc+'</div></div>';ms.appendChild(d);ms.scrollTop=ms.scrollHeight;}
function addImgBbl(cid,role,src){const ms=document.getElementById('ms-'+cid);if(!ms)return;const d=document.createElement('div');d.className='msg'+(role==='user'?' u':'');d.innerHTML='<div class="av '+(role==='ai'?'avai':'avus')+'">'+(role==='ai'?'澤':'我')+'</div><div class="mi"><img class="mig" src="'+src+'" onclick="openLB(this.src)"></div>';ms.appendChild(d);ms.scrollTop=ms.scrollHeight;}
function addFileBbl(cid,role,name){const ms=document.getElementById('ms-'+cid);if(!ms)return;const d=document.createElement('div');d.className='msg'+(role==='user'?' u':'');d.innerHTML='<div class="av '+(role==='ai'?'avai':'avus')+'">'+(role==='ai'?'澤':'我')+'</div><div class="mi"><div style="font-size:.8rem;background:var(--info-bg);border:1px solid var(--info-bd);color:var(--info);padding:8px 12px;border-radius:var(--rs);font-weight:700">📄 '+name+'</div></div>';ms.appendChild(d);ms.scrollTop=ms.scrollHeight;}
function addTyping(cid){const ms=document.getElementById('ms-'+cid);if(!ms)return{remove:()=>{}};const d=document.createElement('div');d.className='msg';d.innerHTML='<div class="av avai">澤</div><div class="tdots"><div class="td"></div><div class="td"></div><div class="td"></div></div>';ms.appendChild(d);ms.scrollTop=ms.scrollHeight;return d;}
function initAllChats(){
  initChat('owner-chat','owner',240,'老闆好！我掌握公司全部資訊 👑\n可協助分析經營狀況、追蹤帳款、了解各部門進度。',['本月整體營運分析','哪個案子最需要關注？','本月毛利比較']);
  initChat('cs-chat','cs',280,'您好！我是澤居的 AI 客服小澤 🏠\n可協助您了解裝修費用、風格規劃及施工流程。也歡迎上傳現場照片！',['28坪全室翻新日式簡約預算80萬','廚房浴室改裝費用？','老屋30年要注意什麼？']);
  initChat('mk-chat','mk',200,'我是你的 AI 行銷小編 ✨\n生成貼文後可接著生成行銷圖片！',['改成更活潑的語氣','加入限時優惠資訊','幫我想更吸睛的開頭']);
  initChat('ad-chat','ad',460,'您好！我是行政 AI 助理 📋\n可協助查詢工程進度、起草合約、整理廠商資訊。',['本週工程進度摘要','幫我草擬合約','哪些工程快到付款節點？']);
  initChat('ac-chat','ac',460,'您好！我是會計 AI 助理 📊\n可協助：查詢收支、計算毛利率、起草催款通知。',['計算景平路案毛利','起草陳小姐催款通知','本月整體收支？']);
}

// ══ UPLOAD HELPER ══════════════════════════════════════════
const uSt={};
function initUpload(zId,fId,prevId,key){
  const z=document.getElementById(zId),f=document.getElementById(fId),p=document.getElementById(prevId);if(!z||!f)return;
  uSt[key]={imgs:[],files:[]};
  z.addEventListener('click',()=>f.click());
  f.addEventListener('change',e=>{addFiles(e.target.files,prevId,key);e.target.value='';});
  z.addEventListener('dragover',e=>{e.preventDefault();z.classList.add('drag');});
  z.addEventListener('dragleave',()=>z.classList.remove('drag'));
  z.addEventListener('drop',e=>{e.preventDefault();z.classList.remove('drag');addFiles(e.dataTransfer.files,prevId,key);});
}
function addFiles(files,prevId,key){
  const prev=document.getElementById(prevId);const st=uSt[key];if(!st)return;
  Array.from(files).forEach(f=>{
    if(f.type.startsWith('image/')){
      const rd=new FileReader();rd.onload=ev=>{const url=ev.target.result;st.imgs.push({name:f.name,url,b64:url.split(',')[1],mime:f.type});if(prev){const w=document.createElement('div');w.className='ithw';const img=document.createElement('img');img.className='ith';img.src=url;img.title='點擊放大';img.addEventListener('click',()=>openLB(url));const d=document.createElement('div');d.className='idel';d.textContent='✕';d.addEventListener('click',()=>{st.imgs=st.imgs.filter(i=>i.name!==f.name);w.remove();});w.appendChild(img);w.appendChild(d);prev.appendChild(w);}};rd.readAsDataURL(f);
    }else{st.files.push({name:f.name});if(prev){const t=document.createElement('div');t.style.cssText='display:inline-flex;align-items:center;gap:6px;background:var(--info-bg);border:1px solid var(--info-bd);color:var(--info);padding:5px 12px;border-radius:20px;font-size:.78rem;font-weight:700;margin:3px';t.textContent='📄 '+f.name;const d=document.createElement('span');d.style.cssText='cursor:pointer;color:var(--bad);font-weight:900;margin-left:2px';d.textContent=' ✕';d.addEventListener('click',()=>{st.files=st.files.filter(fi=>fi.name!==f.name);t.remove();});t.appendChild(d);prev.appendChild(t);}}
  });
}
function clearUpload(key,prevId){uSt[key]={imgs:[],files:[]};const p=document.getElementById(prevId);if(p)p.innerHTML='';}

// ══ CS REPLY ══════════════════════════════════════════════
const RFMT={
  line:'根據上面對話，用親切的LINE訊息格式整理給業主的回覆。含問候、核心資訊（坪數/報價/工期）、下一步行動。150字以內。',
  email:'根據對話，用專業Email格式整理回覆，含主旨、正文、簽名（澤居室內裝修 03-2605199）。',
  sms:'根據對話整理簡訊，100字以內，含03-2605199。',
  'quote-summary':'根據對話整理報價摘要：【澤居室內裝修 估價摘要】工程項目/坪數/費用範圍/工期/付款方式。適合截圖給業主。',
};
document.querySelectorAll('[data-fmt]').forEach(btn=>btn.addEventListener('click',()=>genReply(btn.dataset.fmt)));
async function genReply(fmt){
  const sp=document.getElementById('rplSp'),box=document.getElementById('rplBox'),txt=document.getElementById('rplTxt');
  sp.classList.add('show');box.style.display='none';
  const ms=document.getElementById('ms-cs-chat');
  const convo=ms?Array.from(ms.querySelectorAll('.bbl')).map(b=>(b.classList.contains('bai')?'[澤居AI] ':'[客戶] ')+b.textContent.trim()).join('\n'):'';
  const prompt=convo?'以下客服對話：\n\n'+convo+'\n\n'+RFMT[fmt]:'澤居室內裝修，統包設計，台北新北桃園三峽。'+RFMT[fmt];
  try{const rep=await callAI('cs',prompt);txt.textContent=rep;}catch{txt.textContent=fmt==='line'?'您好！感謝洽詢澤居室內裝修 🏠\n已收到您的需求，設計師將在24小時內聯繫您。\n急需請致電03-2605199':'感謝詢問，將盡快聯繫。急需請電03-2605199。澤居室內裝修';}
  sp.classList.remove('show');box.style.display='block';
}


// ══ PRO QUOTE ENGINE ══════════════════════════════════════
// 統一的段落式報價單引擎
const DEF_SECTIONS=[
  {id:'s1',icon:'🔨',name:'拆除工程',items:[{name:'現場拆除清運',unit:'式',qty:1,price:0}]},
  {id:'s2',icon:'🧱',name:'泥作工程',items:[{name:'磁磚鋪貼',unit:'坪',qty:0,price:0}]},
  {id:'s3',icon:'🪵',name:'木作工程',items:[{name:'天花板施作',unit:'式',qty:1,price:0}]},
  {id:'s4',icon:'⚡',name:'水電工程',items:[{name:'水電更換配置',unit:'式',qty:1,price:0}]},
  {id:'s5',icon:'🪟',name:'系統傢俱',items:[{name:'系統櫃安裝',unit:'式',qty:1,price:0}]},
  {id:'s6',icon:'🎨',name:'油漆工程',items:[{name:'全室油漆',unit:'坪',qty:0,price:0}]},
];

function mkSecId(){return 's'+Date.now();}
function calcSec(items){return items.reduce((s,it)=>s+it.qty*it.price,0);}
function calcAll(sections){return sections.reduce((s,sec)=>s+calcSec(sec.items),0);}
function fmt(n){return'NT$'+Math.round(n).toLocaleString();}
