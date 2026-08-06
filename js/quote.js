function renderProQuote(containerId, sections, opts={}){
  const c=document.getElementById(containerId);if(!c)return;
  c.innerHTML='';
  if(!sections.length){
    c.innerHTML='<div style="padding:20px;text-align:center;color:var(--g400);font-size:.85rem">尚無工程項目<br><span style="font-size:.8rem">從左側選擇工程分類，或點「＋ 新增分類」</span></div>';
    updProTotals(sections,opts.totIds||{});return;
  }
  sections.forEach(sec=>{
    const div=document.createElement('div');div.className='pqs';

    // ── Header ──────────────────────────────────────────
    const hd=document.createElement('div');hd.className='pqs-hd';

    const ico=document.createElement('span');ico.className='pqs-icon';ico.textContent=sec.icon||'🔧';

    const nm=document.createElement('span');nm.className='pqs-name';nm.contentEditable='true';nm.textContent=sec.name;
    nm.addEventListener('click',e=>e.stopPropagation());
    nm.addEventListener('blur',()=>{sec.name=nm.textContent.trim()||sec.name;});

    const tot=document.createElement('span');tot.className='pqs-total';tot.textContent=fmt(calcSec(sec.items));

    const tog=document.createElement('span');tog.className='pqs-toggle';tog.textContent='▾';

    // 刪除大項按鈕（右側明顯紅色）
    const delBtn=document.createElement('button');
    delBtn.style.cssText='margin-left:6px;padding:5px 10px;background:var(--bad-bg);border:1.5px solid var(--bad-bd);color:var(--bad);border-radius:var(--rxs);font-size:.75rem;font-weight:800;cursor:pointer;flex-shrink:0;white-space:nowrap;transition:all var(--ease)';
    delBtn.textContent='🗑 刪除';
    delBtn.addEventListener('click',e=>{
      e.stopPropagation();
      confirmAction('刪除「'+sec.name+'」整個分類與所有細項？',()=>{
        sections.splice(sections.indexOf(sec),1);
        renderProQuote(containerId,sections,opts);
      });
    });

    hd.appendChild(ico);hd.appendChild(nm);hd.appendChild(tot);hd.appendChild(tog);
    hd.appendChild(delBtn);
    hd.addEventListener('click',()=>{body.classList.toggle('open');tog.classList.toggle('open');});

    // ── Body ────────────────────────────────────────────
    const body=document.createElement('div');body.className='pqs-body open';
    tog.classList.add('open');

    const isDualHd=(containerId==='adSections')&&(curQuoteMode==='internal');
    const colHd=document.createElement('div');
    colHd.className='pqs-col-hd dual';
    const clientMode=(containerId==='adSections')&&(curQuoteMode==='client');
    colHd.innerHTML='<span>工項名稱</span><span>單位</span><span>數量</span>'+
      (clientMode?'':'<span style="color:#C00000;font-size:.75rem">成本單價</span>')+
      '<span style="color:#1E7A58;font-size:.75rem">對客單價</span>'+
      '<span style="font-size:.75rem">對客小計</span>'+
      (clientMode?'':'<span style="font-size:.75rem">毛利</span>')+
      '<span></span>';

    const itemsC=document.createElement('div');itemsC.className='pqs-items';itemsC.id='pi-'+sec.id;

    const addBtn=document.createElement('button');addBtn.className='pqs-add';addBtn.textContent='＋ 新增細項';
    addBtn.addEventListener('click',()=>{
      sec.items.push({name:'',unit:'式',qty:1,price:0});
      renderPqsItems(sec.id,sec.items,containerId,sections,opts);
      refreshSec(sec.id,sec.items,containerId,sections,opts);
    });

    body.appendChild(colHd);body.appendChild(itemsC);body.appendChild(addBtn);
    div.appendChild(hd);div.appendChild(body);
    c.appendChild(div);
    renderPqsItems(sec.id,sec.items,containerId,sections,opts);
  });
  updProTotals(sections,opts.totIds||{});
}

function toggleSec(hd){const body=hd.nextElementSibling;const tog=hd.querySelector('.pqs-toggle');body.classList.toggle('open');if(tog)tog.classList.toggle('open');}

function renderPqsItems(secId,items,containerId,sections,opts){
  const c=document.getElementById('pi-'+secId);if(!c)return;c.innerHTML='';
  const isDual=(containerId==='adSections');// 報價單雙價
  const isClientMode=(containerId==='adSections')&&(curQuoteMode==='client');

  if(!items.length){
    const em=document.createElement('div');
    em.style.cssText='padding:10px 16px;font-size:.82rem;color:var(--g400)';
    em.textContent='點「＋ 新增細項」加入工項';c.appendChild(em);return;
  }
  items.forEach((it,ii)=>{
    const row=document.createElement('div');
    row.className='pqs-item'+(isDual?' dual':'');

    // ── 工項名稱 ──
    const n=document.createElement('input');n.type='text';n.placeholder='工項名稱';n.value=it.name||'';
    n.style.cssText='width:100%;padding:7px 8px;border:1.5px solid transparent;border-radius:var(--rxs);font-size:.85rem;font-family:inherit;background:transparent;outline:none;transition:all var(--ease)';
    n.addEventListener('focus',()=>n.style.borderColor='var(--gold)');
    n.addEventListener('blur',()=>n.style.borderColor='transparent');
    n.addEventListener('input',()=>it.name=n.value);

    // ── 單位 ──
    const u=document.createElement('input');u.type='text';u.placeholder='單位';u.value=it.unit||'式';
    u.style.cssText=n.style.cssText+'text-align:center';
    u.addEventListener('focus',()=>u.style.borderColor='var(--gold)');
    u.addEventListener('blur',()=>u.style.borderColor='transparent');
    u.addEventListener('input',()=>it.unit=u.value);

    // ── 數量 ──
    const q=document.createElement('input');q.type='number';q.placeholder='數量';q.value=it.qty||1;q.min=0;q.step='any';
    q.style.cssText=n.style.cssText+'text-align:center';
    q.addEventListener('focus',()=>q.style.borderColor='var(--gold)');
    q.addEventListener('blur',()=>q.style.borderColor='transparent');

    // ── 成本單價（客戶版隱藏）──
    const cost=document.createElement('input');cost.type='number';cost.placeholder='成本';cost.value=it.cost||0;cost.min=0;
    cost.style.cssText=n.style.cssText+'text-align:right;color:#C00000;font-family:monospace';
    cost.title='成本單價（廠商報價）';
    if(isClientMode)cost.style.display='none';// 客戶版隱藏
    cost.addEventListener('focus',()=>cost.style.borderColor='var(--bad)');
    cost.addEventListener('blur',()=>cost.style.borderColor='transparent');

    // ── 對客單價（綠色）──
    const p=document.createElement('input');p.type='number';p.placeholder='對客價';p.value=it.price||0;p.min=0;
    p.style.cssText=n.style.cssText+'text-align:right;color:#1E7A58;font-family:monospace;font-weight:700';
    p.title='對外報價單價';
    p.addEventListener('focus',()=>p.style.borderColor='var(--ok)');
    p.addEventListener('blur',()=>p.style.borderColor='transparent');

    // ── 對客小計欄 ──
    const sellSub=document.createElement('div');
    sellSub.style.cssText='font-family:monospace;font-size:.82rem;font-weight:800;text-align:right;padding:4px 2px;color:#1E7A58;white-space:nowrap';

    // ── 毛利欄（客戶版隱藏）──
    const profitEl=document.createElement('div');
    profitEl.style.cssText='font-family:monospace;font-size:.78rem;font-weight:700;text-align:right;padding:4px 2px;white-space:nowrap;line-height:1.5'+(isClientMode?';display:none':'');

    // ── 更新計算 ──
    function updCalc(){
      const qty=parseFloat(q.value)||0;
      const c_=parseFloat(cost.value)||0;
      const p_=parseFloat(p.value)||0;
      it.qty=qty; it.cost=c_; it.price=p_;
      const costTotal=c_*qty;
      const sellTotal=p_*qty;
      const profit=sellTotal-costTotal;
      sellSub.textContent=fmt(sellTotal);
      if(profit>=0){
        profitEl.innerHTML='<span style="color:var(--ok)">▲ '+fmt(profit)+'</span>';
      }else{
        profitEl.innerHTML='<span style="color:var(--bad)">▼ '+fmt(Math.abs(profit))+'</span>';
      }
      refreshSec(secId,items,containerId,sections,opts);
    }
    q.addEventListener('input',updCalc);
    cost.addEventListener('input',updCalc);
    p.addEventListener('input',updCalc);
    updCalc();

    // ── 刪除 ──
    const del=document.createElement('button');del.className='pqs-del';del.title='刪除此細項';del.textContent='🗑';
    del.addEventListener('click',()=>{
      items.splice(ii,1);
      renderPqsItems(secId,items,containerId,sections,opts);
      refreshSec(secId,items,containerId,sections,opts);
    });

    row.appendChild(n);row.appendChild(u);row.appendChild(q);
    row.appendChild(cost);row.appendChild(p);
    row.appendChild(sellSub);row.appendChild(profitEl);
    row.appendChild(del);
    c.appendChild(row);
  });
}

// 修正重點：這是全站防止 XSS（惡意內容注入）最關鍵的一個函式，被呼叫了 100 多次，
// 但原本的寫法只轉義了 & 和雙引號，漏掉了 < 和 >——這兩個才是真正會讓瀏覽器把文字當成
// HTML 標籤執行的關鍵字元。等於全站呼叫 esc() 的地方，這段時間都沒有真正擋下 <script> 這類注入，
// 看起來像有做防護，實際上沒有。這裡補上完整的轉義規則。
function esc(s){return(s===null||s===undefined?'':String(s)).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');}

function refreshSec(secId,items,containerId,sections,opts){
  const pqs=document.getElementById('pi-'+secId)?.closest('.pqs');
  if(pqs){const t=pqs.querySelector('.pqs-total');if(t)t.textContent=fmt(calcSec(items));}
  if(sections&&opts)updProTotals(sections,opts.totIds||{});
  else refreshGlobalTotals(containerId);
}

function refreshGlobalTotals(containerId){
  if(containerId==='qSections')updProTotals(qSections,{sub:'pqSub',total:'pqTotal'});
  if(containerId==='adSections')updProTotals(adSections,{sub:'adSub',mgmt:'adMgmt',total:'adTotal'});
  if(containerId==='adSections')updProfitBar();
}

// ── 報價金額計算（畫面顯示與Excel匯出共用同一套公式，避免兩邊算出不同總價）──
// ── 報價金額計算（畫面顯示與Excel匯出共用同一套公式，避免兩邊算出不同總價）──
// 管理費可以自訂百分比或整個贈送（免收），存在報價單自己的資料裡，跟這份報價一起存檔、一起匯出，
// 不會影響其他報價單
function calcQuoteTotals(sections, mgmtRate){
  if(mgmtRate==null) mgmtRate=(typeof curMgmtRate!=='undefined'?curMgmtRate:8);
  const subtotal=calcAll(sections);
  const mgmt=Math.round(subtotal*(mgmtRate/100));
  const tax=Math.round((subtotal+mgmt)*0.05);
  const grand=subtotal+mgmt+tax;
  return {subtotal,mgmt,tax,grand,mgmtRate};
}

let curMgmtRate=8; // 目前報價編輯器裡使用的管理費％數，預設8%，可以在畫面上直接改或按「贈送」歸零

function updProTotals(sections,ids){
  const rateInput=document.getElementById('adMgmtRate');
  if(ids.mgmt&&rateInput) curMgmtRate=parseFloat(rateInput.value)||0;
  const {subtotal,mgmt,tax,grand}=calcQuoteTotals(sections, ids.mgmt?curMgmtRate:8);
  const set=(id,v)=>{const el=document.getElementById(id);if(el)el.textContent=v;};
  if(ids.sub)set(ids.sub,fmt(subtotal));
  if(ids.mgmt)set(ids.mgmt,fmt(mgmt));
  if(ids.tax)set(ids.tax,fmt(tax));
  if(ids.total)set(ids.total,fmt(ids.mgmt?grand:subtotal));
}

// 管理費％數輸入框：改了就即時重算總價
document.getElementById('adMgmtRate')?.addEventListener('input',()=>{
  if(typeof adSections!=='undefined') updProTotals(adSections,{sub:'adSub',mgmt:'adMgmt',tax:'adTax',total:'adTotal'});
});
// 「贈送」按鈕：點一下歸零（免收管理費），再點一下復原成剛剛的％數，方便來回切換
let _mgmtRateBeforeWaive=8;
document.getElementById('adMgmtWaive')?.addEventListener('click',()=>{
  const rateInput=document.getElementById('adMgmtRate');
  const waiveBtn=document.getElementById('adMgmtWaive');
  if(!rateInput)return;
  const cur=parseFloat(rateInput.value)||0;
  if(cur>0){
    _mgmtRateBeforeWaive=cur;
    rateInput.value=0;
    waiveBtn.textContent='↩️ 取消贈送';
    waiveBtn.style.background='var(--ok-bg)';waiveBtn.style.color='var(--ok)';waiveBtn.style.borderColor='var(--ok-bd)';
  }else{
    rateInput.value=_mgmtRateBeforeWaive||8;
    waiveBtn.textContent='🎁 贈送';
    waiveBtn.style.background='var(--gold-pale)';waiveBtn.style.color='var(--gold-d)';waiveBtn.style.borderColor='var(--gold-l)';
  }
  if(typeof adSections!=='undefined') updProTotals(adSections,{sub:'adSub',mgmt:'adMgmt',tax:'adTax',total:'adTotal'});
});

function addPqsItem(secId,containerId,sections,opts){
  const sec=sections.find(s=>s.id===secId);if(!sec)return;
  sec.items.push({name:'',unit:'式',qty:1,price:0});
  const o=opts||getSectionOpts(containerId);
  renderPqsItems(secId,sec.items,containerId,sections,o);
  refreshSec(secId,sec.items,containerId,sections,o);
}

function addPqsSec(containerId,sections,icon='🔧',name='新增工程'){
  sections.push({id:mkSecId(),icon,name,items:[{name:'',unit:'式',qty:1,price:0}]});
  renderProQuote(containerId,sections,getSectionOpts(containerId));
  openLastSec(containerId);
}

function delPqsSec(secId,containerId,sections){
  confirmAction('確定刪除此工程分類？',()=>{
    const i=sections.findIndex(s=>s.id===secId);if(i>=0)sections.splice(i,1);
    renderProQuote(containerId,sections,getSectionOpts(containerId));
  });
}

function getSectionOpts(cid){
  if(cid==='qSections')return{allowDelSec:true,totIds:{sub:'pqSub',total:'pqTotal'}};
  if(cid==='adSections')return{allowDelSec:true,totIds:{sub:'adSub',mgmt:'adMgmt',tax:'adTax',total:'adTotal'}};
  return{};
}

function openLastSec(containerId){const c=document.getElementById(containerId);if(!c)return;const last=c.lastElementChild;if(last){const body=last.querySelector('.pqs-body');const tog=last.querySelector('.pqs-toggle');if(body)body.classList.add('open');if(tog)tog.classList.add('open');}}

function parseAIToSections(text){
  const sections=[];let curSec=null;
  text.split('\n').forEach(line=>{
    line=line.trim();if(!line)return;
    // Section header: starts with icon emoji or 【】or contains 工程
    const secMatch=line.match(/^([🔨🧱🪵⚡🪟🎨🔩🏗️🚿💡]+)\s*(.+?)[:：]?\s*$/);
    const isSec=secMatch||(line.includes('工程')||line.includes('工作'))&&!line.includes('｜')&&!line.includes('NT$')&&line.length<20;
    if(isSec){
      const icon=secMatch?secMatch[1]:'🔧';const name=secMatch?secMatch[2].trim():line.replace(/[:：]/g,'').trim();
      curSec={id:mkSecId(),icon,name,items:[]};sections.push(curSec);return;
    }
    // Item row: contains ｜
    if(line.includes('｜')){
      const p=line.split('｜');if(p[0].includes('總計')||p[0].includes('總價'))return;
      const price=parseFloat((p[3]||p[2]||'').replace(/[^\d.]/g,''))||0;
      const qty=parseFloat((p[2]||'').replace(/[^\d.]/g,''))||1;
      const name=p[0].trim();if(!name||name.includes('項目'))return;
      if(!curSec){curSec={id:mkSecId(),icon:'🔧',name:'工程項目',items:[]};sections.push(curSec);}
      curSec.items.push({name,unit:(p[1]||'式').trim(),qty,price});
    }
  });
  // fallback: no sections parsed
  if(!sections.length)return null;
  // filter empty
  return sections.filter(s=>s.items.length>0);
}

// ── CS QUICK QUOTE ──
initUpload('qZone','qFile','qPrev','qUp');
function qChip(txt){document.getElementById('qNt').value=txt;document.getElementById('genQBtn').click();}

document.getElementById('genQBtn').addEventListener('click',async()=>{
  const n=document.getElementById('qN').value||'客戶',sz=parseInt(document.getElementById('qSz').value)||28;
  const tp=document.getElementById('qTp').value,st=document.getElementById('qSt').value,nt=document.getElementById('qNt').value;
  const sp=document.getElementById('qSp');sp.classList.add('show');
  document.getElementById('pqClient').textContent=n;
  document.getElementById('pqDate').textContent=new Date().toLocaleDateString('zh-TW');
  document.getElementById('pqSize').textContent=sz+'坪';
  document.getElementById('pqType').textContent=tp;
  const prompt='請幫客戶'+n+'估算'+sz+'坪'+tp+'（'+st+'風格）工程報價，依照台灣裝修行情。\n備注：'+(nt||'無')+'。\n請用以下格式輸出，分工程類別，每類下列細項：\n\n🔨 拆除：\n工項名稱｜單位｜數量｜單價\n...\n🧱 泥作：\n工項名稱｜單位｜數量｜單價\n...\n（以此類推）\n只輸出上述格式，不要額外說明文字。';
  const ups=uSt['qUp']||{imgs:[]};
  const parts=[...ups.imgs.map(i=>({type:'image',source:{type:'base64',media_type:i.mime,data:i.b64}})),{type:'text',text:prompt}];
  try{
    const rep=await callAI('cs',ups.imgs.length?parts:prompt,3000,80,'快速報價生成');
    const parsed=parseAIToSections(rep);
    if(parsed&&parsed.length){qSections=parsed;}
    else{qSections=JSON.parse(JSON.stringify(DEF_SECTIONS));qSections.forEach(s=>s.items.forEach(it=>{if(it.unit==='坪')it.qty=sz;it.price=Math.round(sz*3000/qSections.length);}));}
  }catch{qSections=JSON.parse(JSON.stringify(DEF_SECTIONS));}
  sp.classList.remove('show');
  document.getElementById('qProWrap').style.display='block';
  document.getElementById('qEmptyHint').style.display='none';
  renderProQuote('qSections',qSections,{allowDelSec:true,totIds:{sub:'pqSub',total:'pqTotal'}});
  openAllSecs('qSections');
});

function openAllSecs(cid){const c=document.getElementById(cid);if(!c)return;c.querySelectorAll('.pqs-body').forEach(b=>b.classList.add('open'));c.querySelectorAll('.pqs-toggle').forEach(t=>t.classList.add('open'));}

document.getElementById('adAd')?.addEventListener('input',()=>{document.getElementById('adQbAddr').textContent=document.getElementById('adAd').value||'—';});

document.getElementById('goNewQ')?.addEventListener('click',()=>{initAdQuote();renderAdVendorPicker();showPanel('ad-newquote');});
document.getElementById('backQ')?.addEventListener('click',()=>showPanel('ad-quote'));

document.getElementById('genAdQ').addEventListener('click',async()=>{
  const n=document.getElementById('adN').value||'業主',ad=document.getElementById('adAd').value||'',sz=parseInt(document.getElementById('adSz').value)||25;
  const tp=document.getElementById('adTp').value,nt=document.getElementById('adNt').value;
  const sp=document.getElementById('adSp');sp.classList.add('show');
  document.getElementById('adQbClient').textContent=n;document.getElementById('adQbAddr').textContent=ad||'—';document.getElementById('adQbDate').textContent=new Date().toLocaleDateString('zh-TW');
  const prompt='請為業主'+n+'（'+ad+'）產生'+sz+'坪'+tp+'完整工程報價，依照台灣統包裝修行情。\n備注：'+(nt||'無')+'。\n請用以下格式，分類列出所有工程項目：\n\n🔨 拆除：\n工項名稱｜單位｜數量｜單價\n...\n🧱 泥作：\n...\n只輸出上述格式。';
  const ups=uSt['adUp']||{imgs:[]};
  const parts=[...ups.imgs.map(i=>({type:'image',source:{type:'base64',media_type:i.mime,data:i.b64}})),{type:'text',text:prompt}];
  try{
    const rep=await callAI('ad',ups.imgs.length?parts:prompt,3000,150,'報價單AI生成');
    const parsed=parseAIToSections(rep);
    if(parsed&&parsed.length)adSections=parsed;
    else adSections=JSON.parse(JSON.stringify(DEF_SECTIONS));
  }catch{adSections=JSON.parse(JSON.stringify(DEF_SECTIONS));}
  sp.classList.remove('show');
  renderProQuote('adSections',adSections,{allowDelSec:true,totIds:{sub:'adSub',mgmt:'adMgmt',tax:'adTax',total:'adTotal'}});
  openAllSecs('adSections');
});



;

// Vendor picker for new quote
let selVendors=new Set();
function renderAdVendorPicker(){
  const c=document.getElementById('adVendorPicker');const empty=document.getElementById('adVpEmpty');if(!c)return;
  const vendors=DB.get('vendors');
  c.innerHTML='';selVendors.clear();
  if(!vendors.length){if(empty)empty.style.display='block';return;}
  if(empty)empty.style.display='none';
  vendors.forEach(v=>{
    const el=document.createElement('div');el.className='vp-item';el.dataset.id=v._id;
    el.innerHTML='<div class="vp-chk"></div><div style="flex:1"><div class="vp-name">'+esc(v.vendor)+'</div><div style="font-size:.75rem;color:var(--g400)">'+esc(v.caseN||'')+'</div></div><div class="vp-cat">'+esc(v.cat||'')+'</div><div class="vp-amt">'+fmt(v.amount||0)+'</div>';
    el.addEventListener('click',()=>{
      if(selVendors.has(v._id)){selVendors.delete(v._id);el.classList.remove('sel');}
      else{selVendors.add(v._id);el.classList.add('sel');}
      el.querySelector('.vp-chk').textContent=selVendors.has(v._id)?'✓':'';
    });
    c.appendChild(el);
  });
}
document.getElementById('importVendorBtn').addEventListener('click',()=>{
  if(!selVendors.size){showToast('⚠️ 請先勾選廠商報價');return;}
  const vendors=DB.get('vendors').filter(v=>selVendors.has(v._id));
  vendors.forEach(v=>{
    const icon={系統櫃:'🪵',廚具:'🍳',玻璃:'🪟',水電:'⚡',泥作:'🧱',油漆:'🎨',鐵件:'🔩'}[v.cat]||'🔧';
    const sec={id:mkSecId(),icon,name:v.vendor+' ／ '+v.cat,items:[]};
    if(v.items&&v.items.length){
      v.items.forEach(it=>{
        const unitCost=it.unitPrice||it.amount||0; // 廠商單項金額 → 成本價
        const qty=parseFloat((it.qty||'1').toString().replace(/[^\d.]/g,''))||1;
        sec.items.push({
          name:it.name||'工程項目',
          unit:typeof it.qty==='string'?it.qty.replace(/[\d.]/g,'').trim()||'式':'式',
          qty:qty,
          cost:unitCost,   // ← 廠商金額放成本
          price:0,         // ← 對客價讓業主自填
        });
      });
    }else{
      sec.items.push({name:v.cat+'工程',unit:'式',qty:1,cost:v.amount||0,price:0});
    }
    adSections.push(sec);
  });
  renderProQuote('adSections',adSections,{allowDelSec:true,totIds:{sub:'adSub',mgmt:'adMgmt',tax:'adTax',total:'adTotal'}});
  updProfitBar&&updProfitBar();
  showToast('✅ 已置入廠商報價，廠商金額已填入成本欄，請填入對客報價！');
  selVendors.clear();
  renderAdVendorPicker();
});

// ── QUOTE TABLE ──

// 報價單直接轉成合約：把報價單的客戶名稱、金額先帶進合約視窗，不用再打一次字，
// 業主簽名的合約照片還是要手動拍照上傳（這個沒辦法用報價單資料自動生成）
function convertQuoteToContract(quoteId){
  const q=DB.get('quotes').find(r=>r._id===quoteId);if(!q)return;
  curProjectId=q.projectId||curProjectId;
  ctEditId=null;ctImgUrl=[];
  const set=(id,v)=>{const el=document.getElementById(id);if(el)el.value=v;};
  set('ctName',q.name?q.name+' 裝修合約':'');
  set('ctClient',q.name||'');
  set('ctAmt2',q.total||'');
  set('ctNote','');
  const stEl=document.getElementById('ctStatus');if(stEl)stEl.value='pending';
  const fcEl=document.getElementById('ctFileCard');if(fcEl)fcEl.style.display='none';
  const cfEl=document.getElementById('ctFile');if(cfEl)cfEl.value='';
  openModal('contractModal');
  showToast('📝 已帶入報價單資料，拍照上傳簽好的合約即可');
}

function renderQTable(){
  const list=document.getElementById('qList');if(!list)return;
  const qs=DB.get('quotes');
  if(!qs.length){list.innerHTML='<div class="empty-state"><div class="es-ic">📄</div><div class="es-t">尚無報價記錄</div><div class="es-s">點右上方「新建報價單」開始建立</div></div>';return;}

  // 修正重點：原本是不分案場的一長串平面列表，案場一多，同一個案場的報價單散落在列表各處，
  // 很難一眼看出「這個案場總共報過幾次價、加起來多少」。改成跟廠商報價同一套「依案場分組」的方式，
  // 每個案場一個區塊、自己的合計，同一個案場的報價單自然就排在一起。
  const byCase={};
  qs.forEach(q=>{
    const key=q.caseN||'（未指定案場）';
    if(!byCase[key])byCase[key]=[];
    byCase[key].push(q);
  });
  const sortedGroups=Object.entries(byCase).sort((a,b)=>{
    const aLatest=Math.max(...a[1].map(q=>q._id||0));
    const bLatest=Math.max(...b[1].map(q=>q._id||0));
    return bLatest-aLatest;
  });

  list.innerHTML=sortedGroups.map(([caseName,quotes])=>{
    const caseTotal=quotes.reduce((s,q)=>s+(q.total||0),0);
    const rows=quotes.map(q=>`
      <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 14px;border-bottom:1px solid var(--g100)">
        <div style="flex:1;min-width:0">
          <div style="font-weight:800;font-size:.86rem">${esc(q.name||'未命名')}</div>
          <div style="font-size:.72rem;color:var(--g400);margin-top:2px">${esc(q.type||'—')} · ${esc((q._ts||'').split(' ')[0])}</div>
        </div>
        <div style="font-family:monospace;font-weight:800;color:var(--gold-d);margin-right:14px">${fmt(q.total||0)}</div>
        <div style="display:flex;gap:5px;flex-shrink:0">
          <button class="btn bo bxs" data-qid="${q._id}">✏️ 編輯</button>
          <button class="btn bo bxs" data-qct="${q._id}" title="把這份報價單的客戶、金額帶進合約，不用重打">📝 轉合約</button>
          <button class="btn bgn bxs" data-qxls="${q._id}">📥 Excel</button>
          <button class="btn brd bxs" data-qdel="${q._id}">🗑</button>
        </div>
      </div>`).join('');
    return `
      <div style="margin-bottom:10px">
        <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 16px;background:linear-gradient(135deg,var(--gold-pale),#FFF0C0);border:1.5px solid var(--gold-l);border-radius:var(--r-sm);margin-bottom:6px">
          <div style="display:flex;align-items:center;gap:10px">
            <span style="font-size:1.1rem">📍</span>
            <div>
              <div style="font-size:.95rem;font-weight:900;color:var(--gold-d)">${esc(caseName)}</div>
              <div style="font-size:.75rem;color:var(--g400);margin-top:1px">共 ${quotes.length} 筆報價單</div>
            </div>
          </div>
          <div style="text-align:right">
            <div style="font-family:monospace;font-size:1rem;font-weight:900;color:var(--gold-d)">${fmt(caseTotal)}</div>
            <div style="font-size:.68rem;color:var(--g400)">案場合計</div>
          </div>
        </div>
        <div style="border:1px solid var(--g100);border-radius:var(--rs);overflow:hidden">${rows}</div>
      </div>`;
  }).join('');

  list.querySelectorAll('[data-qid]').forEach(btn=>{btn.addEventListener('click',()=>{const q=DB.get('quotes').find(r=>r._id===parseInt(btn.dataset.qid));if(!q)return;adSections=q.sections?JSON.parse(JSON.stringify(q.sections)):JSON.parse(JSON.stringify(DEF_SECTIONS));document.getElementById('adN').value=q.name||'';document.getElementById('adAd').value=q.addr||'';document.getElementById('adQbClient').textContent=q.name||'—';document.getElementById('adQbAddr').textContent=q.addr||'—';renderProQuote('adSections',adSections,{allowDelSec:true,totIds:{sub:'adSub',mgmt:'adMgmt',tax:'adTax',total:'adTotal'}});openAllSecs('adSections');showPanel('ad-newquote');});});
  list.querySelectorAll('[data-qct]').forEach(btn=>{btn.addEventListener('click',()=>convertQuoteToContract(parseInt(btn.dataset.qct)));});
  list.querySelectorAll('[data-qxls]').forEach(btn=>{btn.addEventListener('click',()=>{const q=DB.get('quotes').find(r=>r._id===parseInt(btn.dataset.qxls));if(q)dlXls(q.name,q.type,q.sections||[],undefined,(typeof q.mgmtFeeRate==='number')?q.mgmtFeeRate:8);});});
  list.querySelectorAll('[data-qdel]').forEach(btn=>{btn.addEventListener('click',()=>{confirmAction('確定刪除此報價記錄？',()=>{DB.del('quotes',parseInt(btn.dataset.qdel));updStats();renderQTable();showToast('✅ 已刪除。');});});});
}

// ── EXCEL DOWNLOAD ──
let _xlsGenerating=false;
function dlXls(name,type,sections,mode,mgmtRate){
  if(mgmtRate==null) mgmtRate=8;
  const today=new Date().toLocaleDateString('zh-TW');
  const isInternal=(mode==='internal');

  if(_xlsGenerating){showToast('⏳ 報價單生成中，請稍候，不要重複點擊');return;}

  async function doGen(){
    _xlsGenerating=true;
    if(!window.ExcelJS){
      showToast('⏳ 首次下載需載入報表元件，約需5-10秒，請稍候…');
      await new Promise((res,rej)=>{
        const sc=document.createElement('script');
        sc.src='https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.4.0/exceljs.min.js';
        sc.onload=res; sc.onerror=rej;
        document.head.appendChild(sc);
      });
    }
    showToast('⏳ 報價單生成中…');

    const wb=new ExcelJS.Workbook();
    const BLUEH='4472C4',WHITE='FFFFFF',YELLOW='FFFF00',RED='C00000';
    const CN_DIGITS=['','一','二','三','四','五','六','七','八','九'];
    function cnNum(n){
      if(n<=10) return ['十','一','二','三','四','五','六','七','八','九','十'][n];
      if(n<20) return '十'+CN_DIGITS[n-10];
      const tens=Math.floor(n/10), ones=n%10;
      return CN_DIGITS[tens]+'十'+(ones?CN_DIGITS[ones]:'');
    }
    const dataRows=Math.max(14,(sections||[]).length);
    const offset=dataRows-14; // 超過14個分類時，下方區塊往下移動的列數
    const NUMS=Array.from({length:dataRows},(_, i)=>cnNum(i+1));
    if(offset>0) showToast('ℹ️ 共'+dataRows+'個分類，已自動擴充表格');
    const thinBrd={style:'thin'};
    const medBrd={style:'medium'};
    function brd(s){return{top:{style:s},bottom:{style:s},left:{style:s},right:{style:s}};}

    // 計算合計
    let grand=0; const sts=[];
    (sections||[]).forEach(sec=>{
      const t=(sec.items||[]).reduce((a,it)=>{
        const q=parseFloat((it.qty||1).toString().replace(/[^\d.]/g,''))||1;
        return a+(parseFloat(it.price)||0)*q;
      },0);
      sts.push(Math.round(t)); grand+=Math.round(t);
    });
    // 管理費、稅金計算跟畫面上完全一致（calcQuoteTotals 同一套公式），避免匯出金額跟畫面對不起來
    const mgmtFee=Math.round(grand*(mgmtRate/100));
    const tax=Math.round((grand+mgmtFee)*0.05);

    // ══ 主表：完全按照模板格式 ══
    const ws=wb.addWorksheet('澤居報價單');
    // 欄寬完全跟模板一樣
    ws.columns=[{width:8},{width:33},{width:8},{width:8},{width:12},{width:12},{width:23}];

    function setCell(ref, val, opts={}){
      const c=ws.getCell(ref);
      if(val!==undefined) c.value=val;
      if(opts.bold||opts.sz||opts.color||opts.name)
        c.font={bold:opts.bold||false,size:opts.sz||10,color:{argb:opts.color?'FF'+opts.color:'FF000000'},name:opts.name||'新細明體'};
      if(opts.fill) c.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF'+opts.fill}};
      if(opts.h) c.alignment={...(c.alignment||{}),horizontal:opts.h};
      if(opts.v) c.alignment={...(c.alignment||{}),vertical:opts.v};
      if(opts.wrap) c.alignment={...(c.alignment||{}),wrapText:true};
      if(opts.brd) c.border=brd(opts.brd);
      if(opts.numFmt) c.numFmt=opts.numFmt;
    }

    // R1 公司名（套用系統設定的公司資料，不寫死品牌名稱）
    const _cp=typeof getCompanyProfile==='function'?getCompanyProfile():{name:'澤居室內裝修'};
    ws.getRow(1).height=34;
    ws.mergeCells('A1:G1');
    setCell('A1',(_cp.name||'澤居室內裝修').split('').join('　'),{bold:true,sz:12,h:'center',v:'middle',brd:'thin'});

    // R2
    ws.getRow(2).height=16;
    ws.mergeCells('A2:D2'); setCell('A2','業主：'+(name||''),{sz:10,h:'left',v:'middle',brd:'thin'});
    ws.mergeCells('E2:F2'); setCell('E2','製表：',{sz:10,h:'left',v:'middle',brd:'thin'});
    setCell('G2','',{sz:10,h:'center',v:'middle',brd:'thin'});

    // R3
    ws.getRow(3).height=16;
    ws.mergeCells('A3:D3'); setCell('A3','地址：',{sz:10,h:'left',v:'middle',brd:'thin'});
    ws.mergeCells('E3:F3'); setCell('E3','日期：'+today,{sz:10,h:'left',v:'middle',brd:'thin'});
    setCell('G3','報價有效期限15日',{sz:9,color:RED,h:'center',v:'middle',brd:'thin'});

    // R4
    ws.getRow(4).height=14;
    ws.mergeCells('A4:G4'); setCell('A4','報價總單',{sz:10,h:'center',v:'middle',brd:'thin'});

    // R5 表頭
    ws.getRow(5).height=20;
    ['項次','工程種類別','單位','數量','單價','複價','備註'].forEach((h,i)=>{
      const col=String.fromCharCode(65+i);
      const c=ws.getCell(col+'5');
      c.value=h; c.font={bold:true,size:11,color:{argb:'FF'+WHITE},name:'新細明體'};
      c.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF'+BLUEH}};
      c.alignment={horizontal:'center',vertical:'middle'};
      c.border=brd('medium');
    });

    // R6~ 資料行
    // 列高精算：A4可印高度276.7mm(=784.3pt，扣掉上下各0.4吋邊界)，扣掉表頭5列+小計/管理費/
    // 稅金/合計4列+備註/空行/匯款/蓋章4列共288pt固定高度，剩餘496.3pt平均分給14個基本資料列
    // = 每列35pt。這樣不管實際填了幾個工程分類，表格都會用空白列把整頁撐滿，不會留下大片空白。
    // 超過14個分類時（offset>0）才會自然往下一頁延伸，不強行縮小字體塞進一頁。
    const DATA_ROW_HEIGHT=35;
    for(let i=0;i<dataRows;i++){
      const r=6+i;
      ws.getRow(r).height=DATA_ROW_HEIGHT;
      const sec=(sections||[])[i]; const st=sts[i]||0;
      ['A','B','C','D','E','F','G'].forEach(col=>ws.getCell(col+r).border=brd('thin'));
      setCell('A'+r,NUMS[i],{sz:10,h:'center',v:'middle'});
      setCell('B'+r,sec?sec.name:'',{sz:10,h:'center',v:'middle'});
      setCell('C'+r,'式',{sz:10,h:'center',v:'middle'});
      setCell('D'+r,1,{sz:10,h:'center',v:'middle'});
      const fc=ws.getCell('F'+r);
      fc.value=st; fc.font={size:10,name:'新細明體'};
      fc.numFmt='#,##0'; fc.alignment={horizontal:'right',vertical:'middle'};
    }

    // R20 小計
    ws.getRow((20+offset)).height=16;
    ws.mergeCells('A'+(20+offset)+':E'+(20+offset));
    ['A','B','C','D','E','F','G'].forEach(col=>ws.getCell(col+String((20+offset))).border=brd('thin'));
    const f20=ws.getCell('F'+(20+offset)); f20.value=grand; f20.numFmt='#,##0'; f20.alignment={horizontal:'right',vertical:'middle'};

    // R21 工程管理費（％數依這份報價實際設定的比例顯示，贈送時顯示為免收）
    ws.getRow((21+offset)).height=16;
    ws.mergeCells('A'+(21+offset)+':E'+(21+offset));
    ['A','B','C','D','E','F','G'].forEach(col=>ws.getCell(col+String((21+offset))).border=brd('thin'));
    setCell('A'+(21+offset),mgmtRate>0?('工程管理費'+mgmtRate+'%'):'工程管理費（本次免收）',{sz:10,h:'center',v:'middle'});
    const fMgmt=ws.getCell('F'+(21+offset)); fMgmt.value=mgmtFee; fMgmt.numFmt='#,##0'; fMgmt.alignment={horizontal:'right',vertical:'middle'};

    // R22 稅金（原R21，因為插入管理費行而往下移一行）
    ws.getRow((22+offset)).height=16;
    ws.mergeCells('A'+(22+offset)+':E'+(22+offset));
    ['A','B','C','D','E','F','G'].forEach(col=>ws.getCell(col+String((22+offset))).border=brd('thin'));
    setCell('A'+(22+offset),'稅金5%',{sz:10,h:'center',v:'middle'});
    const f21=ws.getCell('F'+(22+offset)); f21.value=tax; f21.numFmt='#,##0'; f21.alignment={horizontal:'right',vertical:'middle'};

    // R23 合計（原R22）
    ws.getRow((23+offset)).height=18;
    ws.mergeCells('A'+(23+offset)+':E'+(23+offset));
    ['A','B','C','D','E','F','G'].forEach(col=>ws.getCell(col+String((23+offset))).border=brd('medium'));
    setCell('A'+(23+offset),'合計',{bold:true,sz:11,h:'center',v:'middle'});
    const f22=ws.getCell('F'+(23+offset)); f22.value=grand+mgmtFee+tax; f22.font={bold:true,size:11,color:{argb:'FF'+RED},name:'新細明體'}; f22.numFmt='#,##0'; f22.alignment={horizontal:'right',vertical:'middle'};

    // R24 備注（原R23，高度52，跟模板一樣）
    ws.getRow((24+offset)).height=52;
    ws.mergeCells('A'+(24+offset)+':G'+(24+offset));
    const c23=ws.getCell('A'+(24+offset));
    c23.value='備註：一. 付款方式：第一期簽約訂金支付總金額30%，第二期施工進場3天內支付30%，第三期工程完成7成時支付30%，第四期尾款驗收後10%\n二. 每期請款請於提出後3日內付清，否則保留停工之權利\n三. 此報價單確認無誤後請簽名回傳，即轉為正式合約';
    c23.font={size:9,name:'新細明體'}; c23.alignment={horizontal:'left',vertical:'top',wrapText:true}; c23.border=brd('thin');

    // R25 空行（原R24）
    ws.getRow((25+offset)).height=10;
    ws.mergeCells('A'+(25+offset)+':G'+(25+offset)); ws.getCell('A'+(25+offset)).border=brd('thin');

    // R26 匯款（原R25，套用系統設定的收款帳號，沒設定過就用預設值）
    const _bankInfo=localStorage.getItem('zeju_bank_acct')||'銀行代碼：050　台灣企銀-八德分行　戶名：'+(_cp.name||'澤居室內裝修')+'　帳號：7505400208531';
    ws.getRow((26+offset)).height=14;
    ws.mergeCells('A'+(26+offset)+':G'+(26+offset));
    setCell('A'+(26+offset),'匯款資訊：'+_bankInfo,{bold:true,sz:9,h:'left',v:'middle',brd:'thin'});

    // R27 蓋章（原R26，高度46，跟模板一樣）
    ws.getRow((27+offset)).height=46;
    ws.mergeCells('A'+(27+offset)+':C'+(27+offset)); setCell('A'+(27+offset),'公司蓋章處',{bold:true,sz:11,h:'center',v:'middle',brd:'thin'});
    ws.mergeCells('D'+(27+offset)+':G'+(27+offset)); setCell('D'+(27+offset),'客戶回簽處',{bold:true,sz:11,h:'center',v:'middle',brd:'thin'});

    // 14個分類以內：強制縮放至A4單頁；超過則允許依內容自動分頁（避免字體過小）
    ws.pageSetup.orientation='portrait';
    ws.pageSetup.paperSize=9;
    ws.pageSetup.fitToPage=true;
    ws.pageSetup.fitToWidth=1;
    ws.pageSetup.fitToHeight=(offset>0?0:1);
    ws.pageSetup.scale=100;
    ws.pageSetup.horizontalDpi=200;
    ws.pageSetup.verticalDpi=200;
    ws.pageSetup.margins={left:0.4,right:0.4,top:0.4,bottom:0.4,header:0.2,footer:0.2};
    ws.pageSetup.printArea='A1:G'+(27+offset);

    // ══ 細項 Sheets ══
    const usedNames=['澤居報價單'];
    (sections||[]).forEach((sec,si)=>{
      const st=sts[si]||0;
      let sname=(sec.name||'工程').substring(0,10);
      if(usedNames.includes(sname)) sname=sname.substring(0,8)+si;
      usedNames.push(sname);
      const ws2=wb.addWorksheet(sname);
      // 細項欄寬也跟模板一樣
      ws2.columns=[{width:8},{width:38},{width:8},{width:8},{width:12},{width:12},{width:18}];
      const items=sec.items||[];
      const totalRows=5+Math.max(items.length,15);

      // 全部框線
      for(let r=1;r<=totalRows;r++) ['A','B','C','D','E','F','G'].forEach(col=>ws2.getCell(col+r).border=brd('thin'));

      function sc2(ref,val,opts={}){
        const c=ws2.getCell(ref);
        if(val!==undefined) c.value=val;
        if(opts.bold||opts.sz||opts.color) c.font={bold:opts.bold||false,size:opts.sz||10,color:{argb:opts.color?'FF'+opts.color:'FF000000'},name:'新細明體'};
        if(opts.fill) c.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF'+opts.fill}};
        if(opts.h||opts.v||opts.wrap) c.alignment={horizontal:opts.h||'left',vertical:opts.v||'middle',wrapText:!!opts.wrap};
        if(opts.brd) c.border=brd(opts.brd);
        if(opts.numFmt) c.numFmt=opts.numFmt;
      }

      ws2.getRow(1).height=16; ws2.mergeCells('A1:D1');
      sc2('A1','業主：'+(name||''),{sz:10,h:'left',v:'middle'}); ws2.mergeCells('E1:F1');
      sc2('E1','製表：',{sz:10}); sc2('G1','日期：'+today,{sz:10});

      ws2.getRow(2).height=16; ws2.mergeCells('A2:G2');
      sc2('A2','地址：',{sz:10,h:'left',v:'middle'});

      ws2.getRow(3).height=14; ws2.mergeCells('A3:G3');
      sc2('A3','報價細項表',{sz:10,h:'center',v:'middle'});

      ws2.getRow(4).height=20;
      ['項次','工程種類別','單位','數量','單價','複價','備註'].forEach((h,i)=>{
        const col=String.fromCharCode(65+i); const c=ws2.getCell(col+'4');
        c.value=h; c.font={bold:true,size:11,color:{argb:'FF'+WHITE},name:'新細明體'};
        c.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF'+BLUEH}};
        c.alignment={horizontal:'center',vertical:'middle'}; c.border=brd('medium');
      });

      ws2.getRow(5).height=18; ws2.mergeCells('A5:E5');
      sc2('A5',sec.name||'',{bold:true,sz:10,fill:YELLOW,h:'center',v:'middle'});
      sc2('F5','合計',{bold:true,sz:10,color:RED,fill:YELLOW,h:'right',v:'middle'});
      const g5=ws2.getCell('G5'); g5.value=st; g5.font={bold:true,size:10,color:{argb:'FF'+RED},name:'新細明體'};
      g5.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF'+YELLOW}}; g5.numFmt='#,##0'; g5.alignment={horizontal:'right',vertical:'middle'};

      // 細項表列高精算：固定列(R1-R5)共84pt，A4可用784.3pt扣掉後剩700.3pt，
      // 平均分給最少15個細項列 = 每列46pt，同樣不管填幾筆細項都能撐滿整頁
      const DETAIL_ROW_HEIGHT=46;
      let row=6;
      items.forEach((it,ii)=>{
        ws2.getRow(row).height=DETAIL_ROW_HEIGHT;
        const qty=parseFloat((it.qty||1).toString().replace(/[^\d.]/g,''))||1;
        const price=parseFloat(it.price)||0;
        sc2('A'+row,ii+1,{sz:10,h:'center',v:'middle'});
        sc2('B'+row,it.name||'',{sz:9,h:'left',v:'middle',wrap:true});
        sc2('C'+row,it.unit||'',{sz:10,h:'center',v:'middle'});
        const dc=ws2.getCell('D'+row); dc.value=qty; dc.font={size:10,name:'新細明體'}; dc.alignment={horizontal:'center',vertical:'middle'};
        const ec=ws2.getCell('E'+row); ec.value=price||null; ec.numFmt='#,##0'; ec.alignment={horizontal:'right',vertical:'middle'};
        const fc2=ws2.getCell('F'+row); fc2.value=Math.round(qty*price); fc2.numFmt='#,##0'; fc2.alignment={horizontal:'right',vertical:'middle'};
        sc2('G'+row,it.note||'',{sz:9,h:'left',v:'middle',wrap:true});
        row++;
      });
      while(row<=totalRows){ ws2.getRow(row).height=DETAIL_ROW_HEIGHT; row++; }
      // 門檻對應新的列高(46pt)重新校正：一頁大約能放15筆細項，超過就自然換頁，不強行壓縮字體
      ws2.pageSetup.orientation='portrait';
      ws2.pageSetup.paperSize=9;
      ws2.pageSetup.fitToPage=true;
      ws2.pageSetup.fitToWidth=1;
      ws2.pageSetup.fitToHeight=(items.length>15?0:1);
      ws2.pageSetup.scale=100;
      ws2.pageSetup.margins={left:0.4,right:0.4,top:0.4,bottom:0.4,header:0.2,footer:0.2};
      ws2.pageSetup.printArea='A1:G'+totalRows;
    });

    const buf=await wb.xlsx.writeBuffer();
    const blob=new Blob([buf],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');
    a.href=url;
    a.download='澤居報價單_'+name+'_'+today.replace(/\//g,'')+(isInternal?'_內部':'_客戶')+'.xlsx';
    a.click(); URL.revokeObjectURL(url);
    showToast('✅ 報價單下載成功！');
  }

  doGen().catch(err=>{
    console.error('Excel error:',err);
    showToast('❌ 下載失敗，請重新整理頁面後再試（'+err.message+'）');
  }).finally(()=>{_xlsGenerating=false;});
}

// 備用方案：無格式純資料 Excel
function dlXlsFallback(name,today,sections,isInternal){
  if(typeof XLSX==='undefined'){
    const sc=document.createElement('script');
    sc.src='https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
    sc.onload=()=>dlXlsFallback(name,today,sections,isInternal);
    document.head.appendChild(sc); return;
  }
  const NUMS=['一','二','三','四','五','六','七','八','九','十','十一','十二','十三','十四'];
  let grand=0; const sts=[];
  (sections||[]).forEach(s=>{const t=(s.items||[]).reduce((a,it)=>a+(it.price||0)*(parseFloat((it.qty||1).toString().replace(/[^\d.]/g,''))||1),0);sts.push(Math.round(t));grand+=Math.round(t);});
  const mgmtFee=Math.round(grand*0.08);
  const tax=Math.round((grand+mgmtFee)*0.05);
  const wb=XLSX.utils.book_new();
  const aoa=[['澤居室內裝修','','','','','',''],
    ['業主：'+name,'','','','製表：','','陳鴻彬'],
    ['地址：','','','','日期：'+today,'','報價有效期限15日'],
    ['報價總單','','','','','',''],
    ['項次','工程種類別','單位','數量','單價','複價','備註']];
  for(let i=0;i<14;i++){const s=(sections||[])[i];aoa.push([NUMS[i],s?s.name:'','式',1,'',sts[i]||0,'']);}
  aoa.push(['','','','','',grand,'']);
  aoa.push(['工程管理費8%','','','','',mgmtFee,'']);
  aoa.push(['稅金5%','','','','',tax,'']);
  aoa.push(['合計','','','','',grand+mgmtFee+tax,'']);
  aoa.push(['備註：付款方式：訂金30%，進場30%，完成7成30%，驗收10%','','','','','','']);
  aoa.push(['匯款：050 台灣企銀 澤居室內裝修 7505400208531','','','','','','']);
  aoa.push(['公司蓋章處','','','客戶回簽處','','','']);
  const ws=XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols']=[{wch:8},{wch:32},{wch:8},{wch:8},{wch:12},{wch:12},{wch:18}];
  ws['!merges']=[{s:{r:0,c:0},e:{r:0,c:6}},{s:{r:1,c:0},e:{r:1,c:3}},{s:{r:2,c:0},e:{r:2,c:3}},{s:{r:3,c:0},e:{r:3,c:6}}];
  XLSX.utils.book_append_sheet(wb,ws,'澤居報價單');
  (sections||[]).forEach((sec,si)=>{
    const aoa2=[['業主：'+name,'','','','製表：','','日期：'+today],['地址：','','','','','',''],['報價細項表','','','','','',''],['項次','工程種類別','單位','數量','單價','複價','備註'],[sec.name,'','','','','合計',sts[si]||0]];
    (sec.items||[]).forEach((it,ii)=>{const q=parseFloat((it.qty||1).toString().replace(/[^\d.]/g,''))||1;aoa2.push([ii+1,it.name||'',it.unit||'',q,it.price||0,Math.round(q*(it.price||0)),it.note||'']);});
    for(let i=(sec.items||[]).length;i<15;i++)aoa2.push(['','','','','',0,'']);
    const ws2=XLSX.utils.aoa_to_sheet(aoa2);
    ws2['!merges']=[{s:{r:0,c:0},e:{r:0,c:3}},{s:{r:4,c:0},e:{r:4,c:4}}];
    XLSX.utils.book_append_sheet(wb,ws2,si===0?'工程':('工程'+(si+1)));
  });
  const wbout=XLSX.write(wb,{bookType:'xlsx',type:'binary'});
  const buf=new ArrayBuffer(wbout.length),v=new Uint8Array(buf);
  for(let i=0;i<wbout.length;i++)v[i]=wbout.charCodeAt(i)&0xFF;
  const blob=new Blob([buf],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');a.href=url;
  a.download='澤居報價單_'+name+'_'+today.replace(/\//g,'')+(isInternal?'_內部':'_客戶')+'.xlsx';
  a.click();URL.revokeObjectURL(url);
  showToast('✅ 已下載（純資料版，無格式）');
}

// ══ SOCIAL POST + IMAGE ════════════════════════════════════
const PH={'Instagram':'@zeju0923','Facebook':'澤居室內裝修','LINE 官方帳號':'@zj8888'};
const PE={'案例分享 — 日式風格':'🍃','案例分享 — 北歐極簡':'🤍','施工現場直擊':'🔨','裝修小知識':'💡','限時優惠活動':'🎁','客戶好評分享':'⭐'};
let curImgStyle='luxury';

document.querySelectorAll('.img-style-btn').forEach(btn=>{
  btn.addEventListener('click',()=>{document.querySelectorAll('.img-style-btn').forEach(b=>b.classList.remove('on'));btn.classList.add('on');curImgStyle=btn.dataset.style;});
});

// genPst listener → 見下方補充區

function showPost(pl,tp,content){
  document.getElementById('pstHd').textContent=PH[pl]||'@zeju0923';
  document.getElementById('pstEm').textContent=PE[tp]||'🏠';
  const footer='\n\n💫TikTok:\nhttps://reurl.cc/rYdqZE \n💫IG:\nhttps://reurl.cc/vL3zWa \n💫官網:\nhttps://www.omnight.com.tw/';
  const full=content+footer;
  const bd=document.getElementById('pstBd');bd.innerHTML=full.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/\n/g,'<br>');
  document.getElementById('pstPrev').style.display='block';
}

document.getElementById('cpPst')?.addEventListener('click',()=>navigator.clipboard.writeText(document.getElementById('pstBd').textContent).then(()=>showToast('✅ 已複製！')));
document.getElementById('svPst')?.addEventListener('click',()=>{
  const pl=document.getElementById('mkPl')?.value||'Instagram';
  const content=document.getElementById('pstBd')?.textContent||'';
  DB.push('chat_mk',{summary:'貼文：'+content.slice(0,60)});
  savePostRecord(pl,content);
  renderHistory();showToast('✅ 已儲存發文記錄！');
});
document.getElementById('viewPostHistory')?.addEventListener('click',()=>{
  const card=document.getElementById('postHistoryCard');
  card.style.display=card.style.display==='none'?'block':'none';
  renderPostHistory();
});

document.getElementById('genImgBtn')?.addEventListener('click',()=>genMktImg());

function genDefaultSvg(style,text){
  const styles={
    luxury:{bg1:'#1A1A2E',bg2:'#16213E',accent:'#C8A44A',text:'#F0D888'},
    minimal:{bg1:'#F8F7F4',bg2:'#EFEDE8',accent:'#2C2C2C',text:'#1A1A1A'},
    warm:{bg1:'#2D1B14',bg2:'#3D2417',accent:'#E8A870',text:'#FFF0E0'},
    modern:{bg1:'#0D1117',bg2:'#161B22',accent:'#58A6FF',text:'#E6EDF3'},
  };
  const s=styles[style]||styles.luxury;
  const tag=text.slice(0,30)||'打造理想居家空間';
  return`<svg viewBox="0 0 640 640" xmlns="http://www.w3.org/2000/svg">
    <defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="${s.bg1}"/><stop offset="100%" stop-color="${s.bg2}"/></linearGradient></defs>
    <rect width="640" height="640" fill="url(#bg)"/>
    <text x="580" y="48" font-size="32" font-weight="900" fill="${s.accent}" text-anchor="end" font-family="serif" letter-spacing="4">澤居</text>
    <text x="580" y="70" font-size="11" fill="${s.accent}" text-anchor="end" font-family="sans-serif" opacity=".6">ZEJU INTERIOR</text>
    <line x1="60" y1="200" x2="580" y2="200" stroke="${s.accent}" stroke-width="0.5" opacity=".3"/>
    <rect x="200" y="220" width="240" height="200" rx="4" fill="none" stroke="${s.accent}" stroke-width="1.5" opacity=".6"/>
    <rect x="220" y="240" width="80" height="120" rx="2" fill="${s.accent}" opacity=".15"/>
    <rect x="320" y="270" width="100" height="90" rx="2" fill="${s.accent}" opacity=".1"/>
    <line x1="220" y1="380" x2="300" y2="380" stroke="${s.accent}" stroke-width="1" opacity=".4"/>
    <circle cx="320" cy="320" r="100" fill="none" stroke="${s.accent}" stroke-width="0.5" opacity=".15"/>
    <circle cx="320" cy="320" r="140" fill="none" stroke="${s.accent}" stroke-width="0.3" opacity=".1"/>
    <line x1="60" y1="470" x2="580" y2="470" stroke="${s.accent}" stroke-width="0.5" opacity=".3"/>
    <text x="320" y="520" font-size="22" fill="${s.text}" text-anchor="middle" font-family="sans-serif" font-weight="700">${tag.slice(0,16)}</text>
    <text x="320" y="555" font-size="13" fill="${s.accent}" text-anchor="middle" font-family="sans-serif" opacity=".7">03-2605199 ｜ @zeju0923</text>
    <text x="60" y="605" font-size="11" fill="${s.text}" font-family="sans-serif" opacity=".4">澤居室內裝修 · 台北 新北 桃園 三峽</text>
  </svg>`;
}

// ══ VENDOR ════════════════════════════════════════════════

document.getElementById('openV')?.addEventListener('click',()=>{
  vItems=[];
  ['vVd','vCs','vNt'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
  document.getElementById('vAmt')&&(document.getElementById('vAmt').value='');
  document.getElementById('vItemsTable').innerHTML='';
  document.getElementById('vTotal').textContent='NT$0';
  const ocr=document.getElementById('vOcr');if(ocr)ocr.classList.remove('show');
  const res=document.getElementById('vResult');if(res)res.style.display='none';
  const prev=document.getElementById('vPrev');if(prev)prev.innerHTML='';
  const ok=document.getElementById('vOcrOk');if(ok)ok.style.display='none';
  setVType('image');
  if(typeof buildCatSelectWithAdd==='function')buildCatSelectWithAdd(document.getElementById('vCat'),'vendorCat');
  openModal('vModal');
});

// ── 廠商報價 OCR Prompt ────────────────────────────────────