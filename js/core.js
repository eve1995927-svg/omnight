

// ══ 全域變數宣告 ════════════
let ctImgUrl=null, ctEditId=null, ieId=null;
let qfImgUrl=[]; // 報價單檔案上傳（案場總覽 → 報價分頁 → 上傳報價單檔案）
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
    {l:'主頁',       items:[{id:'owner-dash',l:'今日總覽',ic:'📊'},{id:'projects',l:'案場總覽',ic:'🏗️'}]},
    {l:'客服行銷',   items:[{id:'cs-chat',l:'客戶諮詢',ic:'💬'},{id:'cs-quote',l:'快速報價',ic:'📐'},{id:'mk-post',l:'行銷貼文',ic:'✨'}]},
    {l:'報價與合約', items:[{id:'ad-quote',l:'報價管理',ic:'📋'},{id:'contract',l:'合約管理',ic:'📝'}]},
    {l:'廠商與進度', items:[{id:'ad-vendor',l:'廠商報價',ic:'🏗️'},{id:'ad-progress',l:'工程進度',ic:'🔧'}]},
    {l:'會計',       items:[{id:'ac-overview',l:'帳款總覽',ic:'💰'},{id:'ac-report',l:'財務報表',ic:'📊'},{id:'ac-billing',l:'AI 帳單',ic:'🧮'},{id:'ac-chat',l:'AI 對帳',ic:'🤖'}]},
    {l:'人資',       items:[{id:'hr-settings',l:'人資管理',ic:'👥'}]},
    {l:'系統',       items:[{id:'settings',l:'系統設定',ic:'⚙️'}]},
  ],
  // 員工可用的模組全集：實際登入時會依照 getEmployeePermissions() 過濾，只顯示老闆開放的部分
  // 每個分組標記 _perm，對應人資管理裡的權限開關 key
  staff:[
    {l:'案場',       _perm:'projects', items:[{id:'projects',l:'案場總覽',ic:'🏗️'}]},
    {l:'客服行銷',   _perm:'marketing',items:[{id:'cs-chat',l:'客戶諮詢',ic:'💬'},{id:'cs-quote',l:'快速報價',ic:'📐'},{id:'mk-post',l:'行銷小編',ic:'✨'}]},
    {l:'報價與合約', _perm:'quote',    items:[{id:'ad-quote',l:'報價管理',ic:'📋'},{id:'contract',l:'合約管理',ic:'📝'}]},
    {l:'廠商與進度', _perm:'vendor',   items:[{id:'ad-vendor',l:'廠商報價',ic:'🏗️'},{id:'ad-progress',l:'工程進度',ic:'🔧'}]},
    {l:'會計',       _perm:'accounting',items:[{id:'ac-overview',l:'帳款總覽',ic:'💰'}]},
    {l:'系統',       _perm:'settings', items:[{id:'settings',l:'系統設定',ic:'🔧'}]},
  ],
  punch:[
    {l:'打卡',    items:[{id:'punch-clock',l:'上下班打卡',ic:'🕐'}]},
  ],
};

// 手機版簡化選單：現場常用的功能才留在手機上，複雜的（合約、會計細項、人資薪資、系統設定...）
// 只在電腦版顯示。帳款總覽有留，是因為「標記廠商付款」這個現場常用的小動作剛好放在那一頁裡。
const MOBILE_ALLOWED_IDS=['owner-dash','projects','cs-chat','cs-quote','ad-quote','ad-progress','ac-overview'];
function isMobileView(){ return window.matchMedia('(max-width:767px)').matches; }

// 員工權限預設值（老闆帳號、公務帳號、共用員工帳號不受限制，全部視為擁有全部權限）
const DEFAULT_STAFF_PERMISSIONS={projects:true,marketing:true,quote:true,vendor:true,accounting:false,settings:false};

// ── 案場選擇器：把「案場名稱」欄位從自由輸入改成從既有案場挑選 ──────────
// 目的：自由輸入常常打法不一致（「民有十三街」跟「民有13街」變成兩個不同案場），
// 導致同一場的報價、廠商報價、帳款、進度散在不同地方兜不起來。改成一定要先在
// 「案場總覽」新增案場，這裡才選得到，同一場的所有資料就會透過 projectId 準確歸在一起。
function buildProjectSelect(selectEl, selectedId, allowEmpty){
  if(!selectEl) return;
  const projects=DB.get('projects');
  if(!projects.length&&!allowEmpty){
    selectEl.innerHTML='<option value="">尚無案場，請先到「案場總覽」新增</option>';
    selectEl.disabled=true;
    return;
  }
  selectEl.disabled=false;
  const placeholder=allowEmpty?'<option value="">不指定案場</option>':'<option value="">請選擇案場…</option>';
  selectEl.innerHTML=placeholder+
    projects.map(p=>'<option value="'+p._id+'">'+esc(p.name||'未命名案場')+(p.client?'（'+esc(p.client)+'）':'')+'</option>').join('');
  if(selectedId!=null && selectedId!=='') selectEl.value=String(selectedId);
}

function getEmployeePermissions(){
  // 用共用「員工」帳號登入（沒有指定個人身份）：維持過去的預設行為，開放常用模組，會計/系統設定不開放
  if(!_punchEmployee) return DEFAULT_STAFF_PERMISSIONS;
  // 個人帳號登入：套用老闆在人資管理設定的權限，沒設定過的員工使用預設值
  return {...DEFAULT_STAFF_PERMISSIONS, ...(_punchEmployee.permissions||{})};
}

// 依權限過濾 GROUPS.staff，只回傳老闆有開放的分組
function getFilteredStaffGroups(){
  const perms=getEmployeePermissions();
  return GROUPS.staff.filter(g=>!g._perm||perms[g._perm]);
}

// 統一入口：取得某個角色實際可見的導覽分組（員工角色會套用個人權限過濾）
function groupsFor(role){
  return role==='staff' ? getFilteredStaffGroups() : (GROUPS[role]||[]);
}
// ══ 公司資料設定（多租戶核心：換公司只要改這裡）═══════════════
// 賣給新客戶時，這是唯一需要調整品牌/業務資料的地方（Firebase 專案設定另見文件說明）
const DEFAULT_COMPANY_PROFILE = {
  name:'澤居室內裝修', shortName:'澤居',
  phone:'03-2605199', email:'zeju0923@gmail.com',
  ig:'@zeju0923', line:'@zj8888',
  serviceAreas:'台北、新北、桃園、三峽',
  priceFullReno:'18,000–28,000元／坪', priceKitchen:'15–35萬', priceBath:'8–20萬',
  oldHouseSurcharge:'20%',
  durationFull:'45–60天', durationPartial:'2–3週',
  paymentTerms:'簽約30%/開工30%/七成完工30%/驗收10%',
  managementFeeRate:'8%', targetMarginLow:'28%', targetMarginHigh:'35%',
  aiAssistantName:'小澤',
};

function getCompanyProfile(){
  try{
    const raw=localStorage.getItem('zeju_company_profile');
    if(raw) return {...DEFAULT_COMPANY_PROFILE, ...JSON.parse(raw)};
  }catch{}
  return {...DEFAULT_COMPANY_PROFILE};
}
function saveCompanyProfile(profile){
  const merged={...DEFAULT_COMPANY_PROFILE, ...profile};
  localStorage.setItem('zeju_company_profile', JSON.stringify(merged));
  if(_fbDB&&_fbReady){
    _fbDB.ref('zeju_data/company_profile').set(merged).catch(e=>console.warn('FB write company_profile:',e.message));
  }
  return merged;
}
async function loadCompanyProfileFromCloud(){
  if(!_fbDB||!_fbReady)return;
  try{
    const snap=await _fbDB.ref('zeju_data/company_profile').once('value');
    const cloud=snap.val();
    if(cloud) localStorage.setItem('zeju_company_profile', JSON.stringify({...DEFAULT_COMPANY_PROFILE, ...cloud}));
  }catch(e){console.warn('company_profile load failed:',e.message);}
}

// ══ 新手設定精靈（首次登入引導）═══════════════════════════
function shouldShowSetupWizard(){
  if(localStorage.getItem('zeju_wizard_done')==='1')return false;
  if(curRole!=='owner')return false; // 只給老闆看
  const hasCustomProfile=getCompanyProfile().name!==DEFAULT_COMPANY_PROFILE.name;
  const hasProjects=DB.get('projects').length>0;
  return !hasCustomProfile && !hasProjects; // 兩者都還是預設狀態才顯示，避免打擾老客戶
}
function maybeShowSetupWizard(){
  if(shouldShowSetupWizard()){
    setTimeout(()=>openModal('setupWizardModal'),500);
  }
}
function wizGoToStep(n){
  document.querySelectorAll('.wiz-panel').forEach(p=>p.classList.toggle('on',p.id==='wizPanel'+n));
  document.querySelectorAll('.wiz-step').forEach(s=>{
    const stepN=parseInt(s.dataset.step);
    s.classList.toggle('on',stepN===n);
    s.classList.toggle('done',stepN<n);
  });
}
function wizNextStep(fromStep){
  if(fromStep===1){
    const name=document.getElementById('wizCompanyName')?.value?.trim();
    if(!name){showToast('⚠️ 請填入公司全名');return;}
    saveCompanyProfile({
      ...getCompanyProfile(),
      name,
      phone:document.getElementById('wizCompanyPhone')?.value?.trim()||'',
      serviceAreas:document.getElementById('wizCompanyAreas')?.value?.trim()||'',
    });
    const tlogoEl=document.getElementById('tlogoText');if(tlogoEl)tlogoEl.textContent=name;
    wizGoToStep(2);
  } else if(fromStep===2){
    const name=document.getElementById('wizProjName')?.value?.trim();
    if(!name){showToast('⚠️ 請填入案場名稱，或點「先跳過」');return;}
    DB.push('projects',{name,client:document.getElementById('wizProjClient')?.value?.trim()||'',status:'inquiry',summary:'案場 '+name});
    wizGoToStep(3);
  }
}
function wizSkipStep(fromStep){
  wizGoToStep(fromStep+1);
}
function wizFinish(){
  localStorage.setItem('zeju_wizard_done','1');
  closeModal('setupWizardModal');
  if(typeof renderProjects==='function')renderProjects();
  if(typeof renderDashboard==='function')renderDashboard();
  showToast('✅ 準備好了，開始使用吧！');
}

// ── 圖片壓縮工具（上傳前縮小檔案，減少 Firebase 同步負擔）──────
// 只用於「純儲存用」的圖片（合約掃描檔等），AI辨識用的圖片不壓縮，避免影響辨識準確度
function compressImage(file, maxDim=1600, quality=0.75){
  return new Promise((resolve)=>{
    if(!file.type.startsWith('image/')){resolve(null);return;}
    const img=new Image();
    const reader=new FileReader();
    reader.onload=e=>{
      img.onload=()=>{
        let w=img.width, h=img.height;
        if(w>maxDim||h>maxDim){
          if(w>h){h=Math.round(h*maxDim/w);w=maxDim;}
          else{w=Math.round(w*maxDim/h);h=maxDim;}
        }
        const canvas=document.createElement('canvas');
        canvas.width=w;canvas.height=h;
        const ctx=canvas.getContext('2d');
        ctx.drawImage(img,0,0,w,h);
        const dataUrl=canvas.toDataURL('image/jpeg',quality);
        resolve(dataUrl);
      };
      img.onerror=()=>resolve(e.target.result); // 壓縮失敗就用原圖，不擋流程
      img.src=e.target.result;
    };
    reader.onerror=()=>resolve(null);
    reader.readAsDataURL(file);
  });
}

// AI 系統提示：從公司資料動態組成，而非寫死品牌名稱
function buildSysPrompts(){
  const p=getCompanyProfile();
  return {
    owner:`你是${p.name}的 AI 老闆助理。${p.shortName}是台灣在地統包裝修公司，服務${p.serviceAreas}。電話：${p.phone}，IG：${p.ig}，LINE：${p.line}。掌握全部資訊，以專業精準方式回應，繁體中文，主動提供建議。`,
    cs:`你是${p.name}的 AI 客服助理「${p.aiAssistantName}」。統包裝修，${p.serviceAreas}。全室翻新每坪${p.priceFullReno}，廚房${p.priceKitchen}，浴室${p.priceBath}，老屋加${p.oldHouseSurcharge}。工期：全室${p.durationFull}，局部${p.durationPartial}。付款：${p.paymentTerms}。若有上傳照片請描述空間並給具體建議與初步報價。語氣溫暖親切，給具體數字，繁體中文。`,
    mk:`你是${p.name}的 AI 行銷小編。IG ${p.ig}，LINE ${p.line}。生成貼文：吸引人開頭、描述空間氛圍、Emoji≤5個、3–5個Hashtag含#${p.shortName}、結尾CTA。120–200字，繁體中文，語氣溫暖質感。`,
    ad:`你是${p.name}的 AI 行政助理。電話：${p.phone}，信箱：${p.email}。可協助：工程進度查詢、起草合約、整理廠商報價、安排排程。付款：${p.paymentTerms}。繁體中文，專業嚴謹。`,
    ac:`你是${p.name}的 AI 會計助理。毛利=對外報價−廠商成本−管理費${p.managementFeeRate}。目標毛利率${p.targetMarginLow}–${p.targetMarginHigh}。協助：帳款整理、毛利計算、成本分析、催款通知。數字精準，繁體中文，語氣專業嚴謹。`,
  };
}
// SYS 保留作為向後相容的 getter（改成動態，而不是寫死字串）
Object.defineProperty(globalThis,'SYS',{get(){return buildSysPrompts();}});

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

// ── 匿名登入 Firebase Auth ──────────────────────────────────
// 為什麼需要這個：資料庫安全規則設成「.read/.write 需要 auth != null」，
// 這樣可以擋掉最基本的「直接對資料庫網址發request」的攻擊方式（不會用 SDK、只是亂槍打鳥的掃描機器人）。
// 老實說明這不是完美的安全機制：因為 Firebase 設定本身是公開可見的，
// 真的懂技術的人一樣可以自己呼叫 signInAnonymously() 取得 auth，繞過這層防護。
// 這是「先擋住最省事的攻擊」的第一道關卡，不是最終解法，真正的解法是換成
// 綁定真實身份的 Firebase Authentication（email/password 或自訂 token），這是之後要做的加強項目。
function _ensureFirebaseAuth(){
  return new Promise((resolve)=>{
    if(typeof firebase==='undefined'||!firebase.auth){resolve(false);return;}
    try{
      firebase.auth().signInAnonymously()
        .then(()=>resolve(true))
        .catch((e)=>{console.warn('Firebase Auth 匿名登入失敗：',e.message);resolve(false);});
    }catch(e){
      console.warn('Firebase Auth 初始化失敗：',e.message);
      resolve(false);
    }
  });
}

const _cache = {}; // _cache[k] = {recordId: record, ...}（用 _id 當 key 的物件，不是陣列）
const _KEYS = ['projects','quotes','vendors','invoices','contracts','progress','ledger','billing',
               'employees','punch_recs','punch_requests','clients','zeju_quotes',
               'chat_mk','chat_cs','chat_ac','chat_ad','post_history','reports',
               'salary_records','leave_requests'];

// 把舊格式（陣列，或 Firebase 有時回傳的 {0:rec,1:rec} 這種物件）統一轉成「用 _id 當 key」的物件，
// 不管資料原本長什麼樣，一律用每筆資料自己的 _id 重新當 key，格式不一致的舊資料也能自動修正
function _normalizeToKeyedObj(raw){
  if(!raw) return {};
  const obj={};
  const list=Array.isArray(raw)?raw:Object.values(raw);
  list.forEach(r=>{ if(r&&typeof r==='object'&&r._id!=null) obj[String(r._id)]=r; });
  return obj;
}

// 【核心修正】原本每次新增/修改/刪除，都是「整個集合讀出來 → 改 → 整包寫回 Firebase」，
// 如果兩個人（例如老闆的電腦、同事的手機）同時在用，其中一台裝置手上的資料如果稍微舊一點，
// 它下一次寫入時會把「它不知道的、別人剛新增的東西」一起蓋掉——這就是合約會憑空消失、
// 刪除的東西過一陣子又跑回來的真正原因，不是資料庫壞掉，是每次都整包覆蓋造成的。
// 改成「只寫這一筆」之後，兩台裝置除非同時改同一筆資料，否則不會互相覆蓋掉對方的東西。
function _cloudSetRecord(k, id, record){
  try{ localStorage.setItem('z7_'+k, JSON.stringify(Object.values(_cache[k]||{}))); }catch{}
  if(_fbDB&&_fbReady){
    _fbDB.ref('zeju_data/'+k+'/'+id).set(record).catch(e=>console.warn('FB write:',k,id,e.message));
  }
}
function _cloudRemoveRecord(k, id){
  try{ localStorage.setItem('z7_'+k, JSON.stringify(Object.values(_cache[k]||{}))); }catch{}
  if(_fbDB&&_fbReady){
    _fbDB.ref('zeju_data/'+k+'/'+id).remove().catch(e=>console.warn('FB remove:',k,id,e.message));
  }
}
// 整批覆蓋（只給「還原備份」這種真的要整包取代的情境用，一般新增/修改/刪除都不要走這條路）
function _cloudSetAll(k, arr){
  try{ localStorage.setItem('z7_'+k, JSON.stringify(arr)); }catch{}
  if(_fbDB&&_fbReady){
    _fbDB.ref('zeju_data/'+k).set(_normalizeToKeyedObj(arr)).catch(e=>console.warn('FB write:',k,e.message));
  }
}

// 初始化：從雲端載入所有資料到 cache
async function initCloudDB(){
  // 先嘗試 Firebase
  if(initFirebase()){
    // 先完成匿名登入，資料庫安全規則要求 auth != null 才能讀寫，
    // 沒有這一步，規則設好之後資料反而會讀不到（不是資安漏洞了，但變成功能壞掉）
    await _ensureFirebaseAuth();
    return new Promise(res=>{
      _fbDB.ref('zeju_data').once('value', snap=>{
        const data=snap.val()||{};
        _KEYS.forEach(k=>{
          if(data[k]){
            _cache[k]=_normalizeToKeyedObj(data[k]);
          }
          else{try{const v=localStorage.getItem('z7_'+k);if(v)_cache[k]=_normalizeToKeyedObj(JSON.parse(v));}catch{}}
        });
        console.log('✅ Firebase data loaded');
        setSyncStatus('ok');
        loadCompanyProfileFromCloud();
        res(true);
      }, ()=>{
        _KEYS.forEach(k=>{try{const v=localStorage.getItem('z7_'+k);if(v)_cache[k]=_normalizeToKeyedObj(JSON.parse(v));}catch{}});
        setSyncStatus('offline');
        res(false);
      });
    });
  }
  // Fallback: localStorage
  _KEYS.forEach(k=>{try{const v=localStorage.getItem('z7_'+k);if(v)_cache[k]=_normalizeToKeyedObj(JSON.parse(v));}catch{}});
  setSyncStatus('offline');
  return false;
}

const DB={
  getAll(k){
    // 先從 cache 取（包含已刪除項目），依 _id 新到舊排序，跟以前陣列 unshift 的順序一致，
    // 不會因為改成物件儲存就打亂既有畫面「新的排最前面」的邏輯
    if(_cache[k]!==undefined){
      return Object.values(_cache[k]||{}).sort((a,b)=>(b._id||0)-(a._id||0));
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
    // 保留給「整批取代」用（例如還原備份）。一般情況請用 push/upd/del，不要直接呼叫這個，
    // 因為這個還是會整包覆蓋，跟這次修正的精神相反，只在「本來就是要整包換掉」時才安全
    _cache[k]=_normalizeToKeyedObj(v);
    _cloudSetAll(k, Object.values(_cache[k]));
  },
  push(k,item){
    if(!_cache[k])_cache[k]={};
    // 用 Date.now() 當 id，正常情況下毫秒等級夠用，但如果極短時間內連續新增兩筆
    // （同一毫秒內），要避免兩筆用到同一個 id 互相蓋掉——這裡確保一定拿到沒用過的 id
    let newId=Date.now();
    while(_cache[k][String(newId)]!==undefined) newId++;
    const record={...item,_id:newId,_ts:new Date().toLocaleString('zh-TW')};
    _cache[k][String(record._id)]=record;
    _cloudSetRecord(k,record._id,record);
    // 維持原本「最多存 500 筆，滿了就丟掉最舊的一筆」的行為，只刪那一筆，不動其他資料
    const all=Object.values(_cache[k]);
    if(all.length>500){
      const oldest=all.reduce((a,b)=>(a._id<b._id?a:b));
      delete _cache[k][String(oldest._id)];
      _cloudRemoveRecord(k,oldest._id);
    }
    return DB.getAll(k);
  },
  del(k,id){
    // 永久刪除：只刪這一筆
    if(_cache[k]) delete _cache[k][String(id)];
    _cloudRemoveRecord(k,id);
    return DB.getAll(k);
  },
  softDel(k,id){
    // 軟刪除（移到垃圾桶）：只改這一筆的 deleted 標記
    return DB.upd(k,id,{deleted:true,deletedAt:new Date().toLocaleString('zh-TW'),deletedBy:curRole||'unknown'});
  },
  restore(k,id){
    // 從垃圾桶復原：只改這一筆
    const cur=(_cache[k]||{})[String(id)];
    if(!cur) return DB.getAll(k);
    const {deleted,deletedAt,deletedBy,...rest}=cur;
    if(!_cache[k])_cache[k]={};
    _cache[k][String(id)]=rest;
    _cloudSetRecord(k,id,rest);
    return DB.getAll(k);
  },
  upd(k,id,patch){
    // 只改這一筆，不會動到同個集合裡的其他資料（這是這次修正的重點）
    const cur=(_cache[k]||{})[String(id)];
    if(!cur) return DB.getAll(k); // 找不到這筆就不動作，避免憑空造出一筆奇怪的資料
    const updated={...cur,...patch};
    if(!_cache[k])_cache[k]={};
    _cache[k][String(id)]=updated;
    _cloudSetRecord(k,id,updated);
    return DB.getAll(k);
  },
};

// ══ AI 點數：改用 Firebase transaction 同步，不再各裝置各自為政 ═══
// 【修正紀錄】原本 POINTS 只是存在瀏覽器 localStorage 裡的一個數字，每台裝置/每個瀏覽器分頭記自己的，
// 從來沒有真的同步到雲端過（程式裡雖然有呼叫 window.storage.set(...)，但 window.storage 這個東西
// 在這個網站裡根本不存在，那幾行從來沒有真的執行過，等於點數其實只有「當下這台裝置」自己知道）。
// 這代表：老闆在電腦上用掉的點數，手機打開來看到的還是舊數字；兩台裝置都在扣點的話，
// 後寫入的那台會用自己那份舊的餘額去扣，把另一台已經扣掉的紀錄蓋回去——就是合約消失同一種問題，只是這次是點數對不準。
// 改用 Firebase 的 transaction（交易）機制：不管幾台裝置同時扣點，Firebase 會自動確保每一次扣款
// 都是根據「當下最新」的餘額去扣，不會漏扣也不會扣兩次，這是 Firebase 官方就是為了處理這種「共用計數器」設計的功能。
let POINTS=parseInt(localStorage.getItem('zeju_pts'))||76500; // 開機預設值，登入後會立刻用雲端最新值覆蓋

async function loadPointsFromCloud(){
  if(_fbDB&&_fbReady){
    try{
      const snap=await _fbDB.ref('zeju_data/points').once('value');
      const v=snap.val();
      POINTS=(typeof v==='number')?v:(parseInt(localStorage.getItem('zeju_pts'))||76500);
    }catch{
      POINTS=parseInt(localStorage.getItem('zeju_pts'))||76500;
    }
  } else {
    POINTS=parseInt(localStorage.getItem('zeju_pts'))||76500;
  }
  localStorage.setItem('zeju_pts',POINTS);
  updatePtsDisplay&&updatePtsDisplay();
}

// 即時監聽：別的裝置扣點之後，這裡的畫面也會跟著自動更新，不用重新整理頁面
function startPointsSync(){
  if(!_fbDB||!_fbReady)return;
  _fbDB.ref('zeju_data/points').on('value',snap=>{
    const v=snap.val();
    if(typeof v==='number'){
      POINTS=v;
      localStorage.setItem('zeju_pts',POINTS);
      updatePtsDisplay&&updatePtsDisplay();
    }
  });
}

// 統一扣點入口：全站所有會扣點的功能都要呼叫這個，不要自己寫 POINTS=POINTS-x
async function deductPoints(amount){
  amount=Math.max(0,Math.round(amount||0));
  if(amount<=0)return POINTS;
  if(_fbDB&&_fbReady){
    try{
      const result=await _fbDB.ref('zeju_data/points').transaction(current=>{
        const base=(typeof current==='number')?current:(parseInt(localStorage.getItem('zeju_pts'))||76500);
        return Math.max(0,base-amount);
      });
      POINTS=(result&&result.committed&&typeof result.snapshot.val()==='number')
        ? result.snapshot.val()
        : Math.max(0,POINTS-amount);
    }catch{
      POINTS=Math.max(0,POINTS-amount);
    }
  } else {
    POINTS=Math.max(0,POINTS-amount);
  }
  localStorage.setItem('zeju_pts',POINTS);
  updatePtsDisplay&&updatePtsDisplay();
  return POINTS;
}

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
        confirmAction('永久刪除「'+meta.name(item)+'」？此動作無法復原！',()=>{
          DB.del(k,item._id);
          showToast('✅ 已永久刪除');
          renderTrashBin();
        });
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
        const oldLen=Object.keys(_cache[k]||{}).length;
        const normalized=_normalizeToKeyedObj(data[k]);
        const newLen=Object.keys(normalized).length;
        _cache[k]=normalized;
        if(k==='punch_recs'&&newLen!==oldLen) hasPunchChange=true;
        if(k==='punch_requests'&&newLen!==oldLen) hasReqChange=true;
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
  if(!v){ showToast('⚠️ 請輸入 API Key'); return; }
  if(!v.startsWith('sk-ant-')){
    showToast('⚠️ Key 格式不正確，請確認以 sk-ant- 開頭'); return;
  }
  API_KEY = v;
  localStorage.setItem('zeju_apikey', v);
  // 更新狀態點
  const dot = document.getElementById('apiDot');
  if(dot){ dot.textContent='✅ 已設定'; dot.style.background='var(--ok-bg)'; dot.style.color='var(--ok)'; }
  showToast('✅ API Key 已儲存！AI 功能全面啟用');
}

function apiClearKey(){
  confirmAction('清除 API Key？清除後所有 AI 功能將停用。',()=>{
    API_KEY = '';
    localStorage.removeItem('zeju_apikey');
    const inp = document.getElementById('apiInp'); if(inp) inp.value = '';
    const dot = document.getElementById('apiDot');
    if(dot){ dot.textContent='⚠️ 未設定'; dot.style.background='var(--warn-bg)'; dot.style.color='var(--warn)'; }
    const res = document.getElementById('apiTestResult'); if(res) res.style.display='none';
    showToast('✅ API Key 已清除');
  },false);
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

// ESC 鍵關閉目前開啟的彈窗（官方 .mov 點外部關閉的機制已存在於 misc.js，這裡只補上 ESC 鍵支援，
// 同時涵蓋自訂輕量彈窗，如快速新增分類、進度照片等等）
document.addEventListener('keydown',(e)=>{
  if(e.key!=='Escape')return;
  const openMov=document.querySelector('.mov.show');
  if(openMov){openMov.classList.remove('show');return;}
  const liteBox=document.querySelector('[id^="_"][id$="Box"]');
  if(liteBox)liteBox.remove();
});

// ── 確認對話（替代 confirm()，不阻斷 UI）───────────────────
function confirmAction(msg,onConfirm,danger=true){
  const old=document.getElementById('_cfmBox');if(old)old.remove();
  const box=document.createElement('div');
  box.id='_cfmBox';
  box.style.cssText='position:fixed;bottom:90px;left:50%;transform:translateX(-50%);background:var(--w);border:1.5px solid '+(danger?'var(--bad-bd)':'var(--g200)')+';border-radius:var(--r);padding:16px 20px;z-index:9000;box-shadow:0 4px 20px rgba(0,0,0,.18);min-width:260px;text-align:center;animation:slideUp .2s ease';
  box.innerHTML='<div style="font-size:.88rem;font-weight:700;color:var(--g700);margin-bottom:12px">'+esc(msg)+'</div>'+
    '<div style="display:flex;gap:8px;justify-content:center">'+
    '<button class="_cfmNo" style="padding:7px 18px;border:1.5px solid var(--g200);border-radius:var(--rs);background:none;color:var(--g500);font-size:.82rem;cursor:pointer;font-family:inherit">取消</button>'+
    '<button class="_cfmYes" style="padding:7px 18px;border:none;border-radius:var(--rs);background:'+(danger?'var(--bad)':'var(--gold-d)')+';color:#fff;font-size:.82rem;cursor:pointer;font-weight:700;font-family:inherit">'+(danger?'確定刪除':'確定')+'</button>'+
    '</div>';
  document.body.appendChild(box);
  const close=()=>box.remove();
  box.querySelector('._cfmNo').addEventListener('click',close);
  box.querySelector('._cfmYes').addEventListener('click',()=>{close();onConfirm();});
  setTimeout(close,6000);
}

// ── 純資訊顯示（不需要確認/取消，用來取代 alert() 的多行狀態訊息）──
function showInfoBox(title,message){
  const old=document.getElementById('_infoBox');if(old)old.remove();
  const overlay=document.createElement('div');
  overlay.id='_infoBox';
  overlay.style.cssText='position:fixed;inset:0;background:rgba(15,20,15,.4);z-index:9500;display:flex;align-items:center;justify-content:center;padding:20px';
  // 先跳脫再轉換換行，順序不能反過來，不然使用者輸入的文字如果剛好含有 <br> 字樣會被誤判成標籤
  const htmlMsg=esc(String(message)).replace(/\n/g,'<br>');
  overlay.innerHTML='<div style="background:var(--w);border-radius:var(--r);padding:22px 24px;max-width:400px;width:100%;box-shadow:0 12px 40px rgba(0,0,0,.25)" onclick="event.stopPropagation()">'+
    '<div style="font-weight:800;font-size:1rem;color:var(--g800);margin-bottom:10px">'+esc(title)+'</div>'+
    '<div style="font-size:.86rem;color:var(--g600);line-height:1.7;white-space:normal">'+htmlMsg+'</div>'+
    '<button id="_infoOk" style="margin-top:16px;width:100%;padding:10px;border:none;border-radius:var(--rs);background:var(--gold-d);color:#fff;font-weight:700;font-size:.86rem;cursor:pointer;font-family:inherit">知道了</button>'+
    '</div>';
  overlay.addEventListener('click',()=>overlay.remove());
  document.body.appendChild(overlay);
  document.getElementById('_infoOk').addEventListener('click',()=>overlay.remove());
}


function showToast(msg,dur=2600){const t=document.getElementById('toast');if(!t)return;t.textContent=msg;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),dur);}

// ══ LIGHTBOX ═════════════════════════════════════════════
function openLB(src){document.getElementById('lbimg').src=src;document.getElementById('lb').classList.add('show');}

// ══ LOGIN ════════════════════════════════════════════════
let curRole='owner';
let curProjectId=null; // 目前選取的案場 ID
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
  // 老闆角色：顯示帳號欄位 + 記住帳號，其他角色維持共用密碼（不用個人帳號）
  const accEl=document.getElementById('lAccount');
  const rememberWrap=document.getElementById('lRememberWrap');
  if(curRole==='owner'){
    accEl.style.display='block';
    rememberWrap.style.display='flex';
    const remembered=localStorage.getItem('zeju_owner_account');
    accEl.value=remembered||ACCTS.owner.user;
    document.getElementById('lRemember').checked=!!remembered;
  } else {
    accEl.style.display='none';
    rememberWrap.style.display='none';
    accEl.value='';
  }
  // 員工/公務角色：顯示員工姓名選單（不用打字，直接選是誰）
  const empSelEl=document.getElementById('lEmpSelect');
  if(empSelEl){
    const needAcc=(curRole==='punch'||curRole==='staff');
    if(needAcc){
      // 登入時 Firebase 可能還沒同步完成，先讀 localStorage 備份，讀不到才退回線上資料
      let empList=[];
      try{ const raw=localStorage.getItem('z7_employees'); if(raw) empList=JSON.parse(raw); }catch{}
      if(!empList.length) empList=(typeof DB!=='undefined'?DB.getAll('employees'):[]);
      const withAccount=empList.filter(e=>e&&e.account&&!e.deleted);
      empSelEl.innerHTML='<option value="">共用帳號（不指定個人）</option>'+
        withAccount.map(e=>'<option value="'+e.account+'">👤 '+e.name+'</option>').join('');
      empSelEl.style.display='block';
    } else {
      empSelEl.style.display='none';
      empSelEl.value='';
    }
  }
});
document.getElementById('lBtn').addEventListener('click',doLogin);
document.getElementById('lPass').addEventListener('keydown',e=>{if(e.key==='Enter')doLogin();});
let _punchEmployee=null; // 個人打卡帳號登入時，記錄對應員工資料

// 頁面載入時，登入畫面預設就是「老闆」角色（HTML 裡 lrb-own 預設 on），
// 所以要在載入當下就把帳號欄位＋記住帳號顯示出來，不用等使用者點一次角色按鈕
window.addEventListener('DOMContentLoaded',()=>{
  const accEl=document.getElementById('lAccount');
  const rememberWrap=document.getElementById('lRememberWrap');
  if(accEl&&rememberWrap&&curRole==='owner'){
    accEl.style.display='block';
    rememberWrap.style.display='flex';
    const remembered=localStorage.getItem('zeju_owner_account');
    accEl.value=remembered||ACCTS.owner.user;
    document.getElementById('lRemember').checked=!!remembered;
  }
});

// 平板轉方向、或視窗跨過手機/電腦的寬度分界時，重新畫一次選單，
// 避免「橫放是電腦選單、直放卻還停在電腦選單」這種不同步的狀況
let _lastIsMobile=isMobileView(), _resizeT=null;
window.addEventListener('resize',()=>{
  clearTimeout(_resizeT);
  _resizeT=setTimeout(()=>{
    const nowMobile=isMobileView();
    if(nowMobile!==_lastIsMobile){
      _lastIsMobile=nowMobile;
      if(typeof curRole!=='undefined'&&curRole&&document.getElementById('app')?.style.display!=='none'){
        buildTabs(curRole);
        buildSidebar(curRole,groupsFor(curRole)?.[0]?.l);
        buildBN(curRole);
      }
    }
  },200);
});

function doLogin(){
  const p=document.getElementById('lPass').value.trim();
  const err=document.getElementById('lErr');
  if(!p){err.style.display='block';err.textContent='請輸入密碼';return;}

  _punchEmployee=null;

  // 共用帳號密碼對照（員工/公務維持共用密碼，方便好記）
  const SHARED_PW={staff:'zeju',punch:'zeju1'};

  // 查員工個人帳號（staff 和 punch 都可以用個人帳號）
  function findEmployee(acc, pw){
    let empList=[];
    try{ const raw=localStorage.getItem('z7_employees'); if(raw) empList=JSON.parse(raw); }catch{}
    if(!empList.length) empList=DB.getAll('employees');
    return empList.find(e=>e.account===acc&&e.password===pw&&!e.deleted)||null;
  }

  const empAcc=(document.getElementById('lEmpSelect')?.value||'').trim();

  if(curRole==='owner'){
    // 老闆角色：需要帳號＋密碼都正確
    const acc=(document.getElementById('lAccount')?.value||'').trim();
    if(acc!==ACCTS.owner.user||p!==ACCTS.owner.pass){
      err.style.display='block'; err.textContent='帳號或密碼不正確，請再試一次'; return;
    }
    // 記住帳號
    if(document.getElementById('lRemember')?.checked){
      localStorage.setItem('zeju_owner_account',acc);
    } else {
      localStorage.removeItem('zeju_owner_account');
    }
  } else if(empAcc){
    // 個人帳號登入（staff 或 punch）
    if(curRole!=='staff'&&curRole!=='punch'){
      err.style.display='block'; err.textContent='個人帳號只適用於員工或公務角色'; return;
    }
    const emp=findEmployee(empAcc,p);
    if(!emp){
      err.style.display='block'; err.textContent='密碼不正確，請確認這位員工的登入密碼'; return;
    }
    _punchEmployee=emp;
  } else {
    // 共用帳號登入（員工／公務）
    const correctPw=SHARED_PW[curRole];
    if(!correctPw||p!==correctPw){
      err.style.display='block'; err.textContent='密碼不正確，請重新輸入'; return;
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
  // 個人帳號登入（員工或公務）：顯示本人姓名，並還原員工資料供權限判斷使用
  const empName=localStorage.getItem('zeju_punch_emp_name');
  const empId=localStorage.getItem('zeju_punch_emp_id');
  const isIndividual=(role==='punch'||role==='staff')&&empName&&empId;
  const displayName=isIndividual?empName:(a?.name||nameMap[role]||role);
  curPunchUser=(role==='punch'&&empId)?('emp_'+empId):role;

  // 重新整理頁面後 _punchEmployee 會被重置為 null，這裡從資料庫還原，
  // 避免員工的功能權限在重新整理後跳回預設值
  if(isIndividual&&!_punchEmployee){
    let empList=[];
    try{ const raw=localStorage.getItem('z7_employees'); if(raw) empList=JSON.parse(raw); }catch{}
    if(!empList.length) empList=DB.getAll('employees');
    _punchEmployee=empList.find(e=>String(e._id)===String(empId))||null;
  }
  if(!isIndividual) _punchEmployee=null;

  if(uDot)uDot.textContent=isIndividual?(empName||'?').charAt(0):(a?.abbr||'?');
  if(uName)uName.textContent=displayName;
  if(aName)aName.textContent=displayName;
  if(aRole)aRole.textContent=isIndividual?(role==='punch'?'員工打卡':'員工'):(a?.role||'');

  // 公務帳號：只顯示打卡介面
  if(role==='punch'){
    buildTabs(role);
    buildSidebar(role,groupsFor(role)?.[0]?.l);
    buildBN(role);
    showPanel(groupsFor(role)?.[0]?.items?.[0]?.id||'punch-clock');
    initPunchClock();
    const pb=document.getElementById('ptsBar');if(pb)pb.style.display='none';
    return;
  }

  // 一般登入
  const pb=document.getElementById('ptsBar');if(pb)pb.style.display='';
  buildTabs(role);
  buildSidebar(role,groupsFor(role)?.[0]?.l);
  buildBN(role);
  showPanel(groupsFor(role)?.[0]?.items?.[0]?.id||'owner-dash');
  initAllChats();
  initApiCard();
  renderHistory();
  if(typeof renderVendorCatFilters==='function')renderVendorCatFilters();
  renderVendors('all');
  renderInvoices('');
  updStats();
  renderQTable();
  renderAdVendorPicker();
  renderContracts();
  updContractStats();
  renderLedger();
  updLedgerStats();
  // 初始化點數：改成從雲端讀最新值，並開始即時監聽（其他裝置扣點時這裡也會自動更新畫面）
  loadPointsFromCloud().then(()=>{ startPointsSync(); });
  renderBilling();
  initSettings();
  if(typeof initLedgerMonth==='function') initLedgerMonth();
  updVCaseFilter();
  renderProgress();
  renderEmployees();
  updHRStats();
  initAdQuote();
  initContractListeners();
  if(typeof initQuoteFileListeners==='function')initQuoteFileListeners();
  initMultiClientChat();
  // 注意：手機底部導覽已由 buildBN() 統一處理（含案場返回鍵、即時 GROUPS 資料），
  // 不再呼叫舊版 initMobileNav()，避免兩套導覽互相覆蓋
  // 案場系統
  if(typeof renderDashboard==='function') renderDashboard();
  if(typeof renderProjects==='function'){
    const savedView=localStorage.getItem('zeju_proj_view');
    if(savedView==='kanban'&&typeof setProjView==='function'){setProjView('kanban');}
    else renderProjects();
  }
  if(typeof initMkProjectSel==='function') initMkProjectSel();
  if(typeof initCsChatProject==='function') initCsChatProject();
  if(typeof maybeShowSetupWizard==='function') maybeShowSetupWizard();
  // 頂欄品牌名稱套用公司資料設定
  const tlogoEl=document.getElementById('tlogoText');
  if(tlogoEl&&typeof getCompanyProfile==='function'){
    tlogoEl.textContent=getCompanyProfile().shortName||'案場通';
  }
  // 側邊欄收合
  const sbBtn=document.getElementById('sbCollapseBtn');
  const sbEl=document.getElementById('sidebar');
  const mlEl=document.querySelector('.ml');
  if(sbBtn&&sbEl&&mlEl&&!sbBtn._bound){
    sbBtn._bound=true;
    const savedCollapsed=localStorage.getItem('zeju_sb_collapsed')==='1';
    if(savedCollapsed){sbEl.classList.add('collapsed');mlEl.classList.add('sb-collapsed');sbBtn.textContent='›';}
    sbBtn.addEventListener('click',()=>{
      const nowCollapsed=sbEl.classList.toggle('collapsed');
      mlEl.classList.toggle('sb-collapsed',nowCollapsed);
      sbBtn.textContent=nowCollapsed?'›':'‹';
      localStorage.setItem('zeju_sb_collapsed',nowCollapsed?'1':'0');
    });
  }
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
  const grps=groupsFor(role);

  if(isMobileView()){
    // 手機版：不用「分組頁籤 → 側欄」兩層結構（側欄在手機上是隱藏的，等於點了分組也看不到裡面的項目），
    // 改成把允許的功能攤平成一排，點哪個直接開哪個
    const items=grps.flatMap(g=>g.items).filter(i=>MOBILE_ALLOWED_IDS.includes(i.id));
    items.forEach(item=>{
      const b=document.createElement('button');
      b.className='rtab';b.dataset.panel=item.id;
      b.textContent=item.ic+' '+item.l;
      b.addEventListener('click',()=>{
        showPanel(item.id);
        document.querySelectorAll('.rtab').forEach(t=>t.classList.remove('on'));
        b.classList.add('on');
      });
      tabs.appendChild(b);
    });
    if(tabs.firstChild)tabs.firstChild.classList.add('on');
    return;
  }

  // 電腦版：維持原本「每個分組一個 Tab，點了展開到第一個功能」的邏輯
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
  if(isMobileView()){
    document.querySelectorAll('.rtab').forEach(t=>t.classList.toggle('on',t.dataset.panel===panelId));
    return;
  }
  // 找這個 panel 屬於哪個分組
  const role=curRole;const grps=groupsFor(role);
  const grp=grps.find(g=>g.items.some(i=>i.id===panelId));
  if(!grp)return;
  document.querySelectorAll('.rtab').forEach(t=>t.classList.toggle('on',t.dataset.grp===grp.l));
  buildSidebar(role,grp.l);
}
function buildSidebar(role, activeGrp){
  const nav=document.getElementById('sNav');nav.innerHTML='';
  const grps=groupsFor(role);
  // 只顯示當前分組的側欄項目
  const showGrp=activeGrp||grps[0]?.l;
  const grp=grps.find(g=>g.l===showGrp)||grps[0];
  if(!grp)return;
  const sec=document.createElement('div');sec.className='sb-sec';
  sec.innerHTML='<div class="sb-lbl">'+grp.l+'</div>';
  grp.items.forEach(item=>{
    const el=document.createElement('div');el.className='ni';el.id='nav-'+item.id;el.title=item.l;
    el.innerHTML='<span class="ic">'+item.ic+'</span><span class="ni-label">'+item.l+'</span>';
    el.addEventListener('click',()=>showPanel(item.id));
    sec.appendChild(el);
  });
  nav.appendChild(sec);
  updateHRBadge();
}
function buildBN(role){
  const bn=document.getElementById('bn');bn.innerHTML='';bn.className='bnav';
  // 案場詳情頁：顯示返回按鈕
  const isInProject=document.getElementById('p-project-detail')?.classList.contains('on');
  if(isInProject){
    const backBtn=document.createElement('button');
    backBtn.className='bnav-item';
    backBtn.innerHTML='<span class="bni">←</span><span>返回</span>';
    backBtn.addEventListener('click',()=>showPanel('projects'));
    bn.appendChild(backBtn);
  }
  // 底部快速列：只從「手機版允許」的清單挑，不會出現複雜功能（跟頂部頁籤用同一份白名單，行為一致）
  // 修正重點：這裡原本用 slice(0,6) 硬砍到剩 6 個，允許清單有 7 項的話，最後一項（帳款總覽）就會被砍掉、
  // 完全不會出現在手機版——不是排版問題，是根本沒被畫出來。現在改成全部顯示，排不下就靠下面 CSS 讓這排可以左右滑動。
  const allItems=groupsFor(role).flatMap(g=>g.items);
  const items=role==='punch' ? allItems : allItems.filter(i=>MOBILE_ALLOWED_IDS.includes(i.id));
  items.forEach(item=>{
    const b=document.createElement('button');b.className='bnav-item';b.id='bn-'+item.id;
    b.innerHTML='<span class="bni">'+item.ic+'</span><span>'+item.l.slice(0,4)+'</span>';
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
function switchRole(role){curRole=role;const a=ACCTS[role];document.getElementById('uDot').textContent=a.abbr;document.getElementById('uName').textContent=a.name;document.getElementById('aName').textContent=a.name;document.getElementById('aRole').textContent=a.role;buildTabs(role);buildSidebar(role,groupsFor(role)?.[0]?.l);buildBN(role);showPanel(groupsFor(role)?.[0]?.items[0]?.id||'owner-dash');}
function showPanel(id){
  if(id==='ac-billing') setTimeout(()=>renderBilling(),100);
  // 切換到新建報價時重設按鈕綁定
  if(id==='ad-settings'){
    const btn=document.getElementById('adSave');
    if(btn)btn._bound=false;
    setTimeout(()=>initAdQuote(),50);
  }document.querySelectorAll('.panel').forEach(p=>p.classList.remove('on'));document.querySelectorAll('.ni,.bnav-item').forEach(n=>n.classList.remove('on'));document.getElementById('p-'+id)?.classList.add('on');document.getElementById('nav-'+id)?.classList.add('on');document.getElementById('bn-'+id)?.classList.add('on');document.querySelector('.ws')?.scrollTo(0,0);syncTabActive(id);}

// ══ HISTORY ══════════════════════════════════════════════
function renderHistory(){
  const hs=document.getElementById('histSec'),hl=document.getElementById('histList');if(!hs||!hl)return;
  let recs=[];['chat_cs','chat_mk','chat_ad','chat_ac','chat_owner','quotes','vendors','invoices'].forEach(k=>DB.get(k).forEach(r=>recs.push({...r,_k:k})));
  recs.sort((a,b)=>b._id-a._id);recs=recs.slice(0,20);
  if(!recs.length){hs.style.display='none';return;}
  hs.style.display='block';hl.innerHTML='';
  recs.forEach(r=>{const el=document.createElement('div');el.className='hi';el.innerHTML='<div class="hi-t">'+esc((r._ts||'').split(' ')[0])+'</div><div class="hi-x">'+esc((r.summary||'').slice(0,34))+'</div>';hl.appendChild(el);});
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
  await deductPoints(pts);
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
function buildFB(){
  const p=getCompanyProfile();
  return {owner:'請告訴我您最想了解哪個面向。',cs:'感謝詢問！設計師將在24小時內聯繫您 🏠 急需請致電'+p.phone,mk:'好的！請查看右側預覽，如需調整隨時告訴我。',ad:'收到！如需起草合約或文件，請告知細節。',ac:'已分析帳務。需要起草催款通知嗎？'};
}
Object.defineProperty(globalThis,'FB',{get(){return buildFB();}});

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
function addBbl(cid,role,text){const ms=document.getElementById('ms-'+cid);if(!ms)return;const d=document.createElement('div');d.className='msg'+(role==='user'?' u':'');const safe=esc(text).replace(/\n/g,'<br>');d.innerHTML='<div class="av '+(role==='ai'?'avai':'avus')+'">'+(role==='ai'?'澤':'我')+'</div><div class="mi"><div class="bbl '+(role==='ai'?'bai':'bus')+'">'+safe+'</div></div>';ms.appendChild(d);ms.scrollTop=ms.scrollHeight;}
function addImgBbl(cid,role,src){const ms=document.getElementById('ms-'+cid);if(!ms)return;const d=document.createElement('div');d.className='msg'+(role==='user'?' u':'');d.innerHTML='<div class="av '+(role==='ai'?'avai':'avus')+'">'+(role==='ai'?'澤':'我')+'</div><div class="mi"><img class="mig" src="'+esc(src)+'" onclick="openLB(this.src)"></div>';ms.appendChild(d);ms.scrollTop=ms.scrollHeight;}
function addFileBbl(cid,role,name){const ms=document.getElementById('ms-'+cid);if(!ms)return;const d=document.createElement('div');d.className='msg'+(role==='user'?' u':'');d.innerHTML='<div class="av '+(role==='ai'?'avai':'avus')+'">'+(role==='ai'?'澤':'我')+'</div><div class="mi"><div style="font-size:.8rem;background:var(--info-bg);border:1px solid var(--info-bd);color:var(--info);padding:8px 12px;border-radius:var(--rs);font-weight:700">📄 '+esc(name)+'</div></div>';ms.appendChild(d);ms.scrollTop=ms.scrollHeight;}
function addTyping(cid){const ms=document.getElementById('ms-'+cid);if(!ms)return{remove:()=>{}};const d=document.createElement('div');d.className='msg';d.innerHTML='<div class="av avai">澤</div><div class="tdots"><div class="td"></div><div class="td"></div><div class="td"></div></div>';ms.appendChild(d);ms.scrollTop=ms.scrollHeight;return d;}
function initAllChats(){
  const p=getCompanyProfile();
  initChat('owner-chat','owner',240,'老闆好！我掌握公司全部資訊 👑\n可協助分析經營狀況、追蹤帳款、了解各部門進度。',['本月整體營運分析','哪個案子最需要關注？','本月毛利比較']);
  initChat('cs-chat','cs',280,'您好！我是'+p.shortName+'的 AI 客服'+p.aiAssistantName+' 🏠\n可協助您了解裝修費用、風格規劃及施工流程。也歡迎上傳現場照片！',['28坪全室翻新日式簡約預算80萬','廚房浴室改裝費用？','老屋30年要注意什麼？']);
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
function buildRFMT(){
  const p=getCompanyProfile();
  return {
    line:'根據上面對話，用親切的LINE訊息格式整理給業主的回覆。含問候、核心資訊（坪數/報價/工期）、下一步行動。150字以內。',
    email:'根據對話，用專業Email格式整理回覆，含主旨、正文、簽名（'+p.name+' '+p.phone+'）。',
    sms:'根據對話整理簡訊，100字以內，含'+p.phone+'。',
    'quote-summary':'根據對話整理報價摘要：【'+p.name+' 估價摘要】工程項目/坪數/費用範圍/工期/付款方式。適合截圖給業主。',
  };
}
Object.defineProperty(globalThis,'RFMT',{get(){return buildRFMT();}});
document.querySelectorAll('[data-fmt]').forEach(btn=>btn.addEventListener('click',()=>genReply(btn.dataset.fmt)));
async function genReply(fmt){
  const p=getCompanyProfile();
  const sp=document.getElementById('rplSp'),box=document.getElementById('rplBox'),txt=document.getElementById('rplTxt');
  sp.classList.add('show');box.style.display='none';
  const ms=document.getElementById('ms-cs-chat');
  const convo=ms?Array.from(ms.querySelectorAll('.bbl')).map(b=>(b.classList.contains('bai')?'['+p.shortName+'AI] ':'[客戶] ')+b.textContent.trim()).join('\n'):'';
  const prompt=convo?'以下客服對話：\n\n'+convo+'\n\n'+RFMT[fmt]:p.name+'，統包設計，'+p.serviceAreas+'。'+RFMT[fmt];
  try{const rep=await callAI('cs',prompt);txt.textContent=rep;}catch{txt.textContent=fmt==='line'?'您好！感謝洽詢'+p.name+' 🏠\n已收到您的需求，設計師將在24小時內聯繫您。\n急需請致電'+p.phone:'感謝詢問，將盡快聯繫。急需請電'+p.phone+'。'+p.name;}
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

// ── 案場篩選（tab 切換）──────────────────────────────────

// ── 客戶諮詢連結案場 ─────────────────────────────────────
function initCsChatProject(){
  const sel=document.getElementById('csChatProject');if(!sel||sel._built)return;
  sel._built=true;
  const projects=DB.get('projects');
  sel.innerHTML='<option value="">連結案場...</option>'+
    projects.map(p=>'<option value="'+p._id+'">'+esc(p.name)+'</option>').join('');
  sel.addEventListener('change',()=>{
    if(sel.value) showToast('✅ 已連結到案場：'+projects.find(p=>p._id==sel.value)?.name);
    curProjectId=sel.value?parseInt(sel.value):null;
  });
}
function filterProjects(filter, el){
  document.querySelectorAll('[data-filter]').forEach(t=>t.classList.remove('on'));
  if(el) el.classList.add('on');
  renderProjects(filter);
}
