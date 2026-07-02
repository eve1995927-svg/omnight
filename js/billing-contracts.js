function updatePtsDisplay(){
  const pts=parseInt(localStorage.getItem('zeju_pts'))||76500;
  POINTS=pts;
  const el=document.getElementById('ptsNum'); if(el)el.textContent=pts.toLocaleString();
  const bl=document.getElementById('bilPts'); if(bl)bl.textContent=pts.toLocaleString();
}

// ── AI 帳單 ────────────────────────────────────────────────
function renderBilling(){
  const list=document.getElementById('bilList');
  const monthSel=document.getElementById('bilMonthSel');
  if(!list)return;

  const BASE_FEE=9000; // 月費 NT$9,000
  const PTS_RATE=0.1;  // 每點 NT$0.1（可調整）

  // ── 月份選單 ──────────────────────────────────────
  const allRecs=DB.get('billing');
  if(monthSel&&!monthSel._built){
    monthSel._built=true;
    const now=new Date();
    for(let i=0;i<12;i++){
      const d=new Date(now.getFullYear(),now.getMonth()-i,1);
      const val=d.getFullYear()+'-'+(d.getMonth()+1).toString().padStart(2,'0');
      const opt=document.createElement('option');
      opt.value=val;
      opt.textContent=d.getFullYear()+'年'+(d.getMonth()+1)+'月';
      if(i===0)opt.selected=true;
      monthSel.appendChild(opt);
    }
    monthSel.addEventListener('change',()=>renderBilling());
  }

  const curMonth=monthSel?.value||(new Date().toISOString().slice(0,7));
  const recs=allRecs.filter(r=>(!r.month||r.month===curMonth));
  const monthPts=recs.reduce((s,r)=>s+(r.points||0),0);
  const totalPts=parseInt(localStorage.getItem('zeju_pts'))||76500;
  const ptsFee=Math.round(monthPts*PTS_RATE);
  const totalFee=BASE_FEE+ptsFee;

  // ── 統計卡片更新 ──────────────────────────────────
  const set=(id,v)=>{const el=document.getElementById(id);if(el)el.textContent=v;};
  set('bilPts',totalPts.toLocaleString());
  set('bilUsed',monthPts.toLocaleString());
  set('bilAmt','NT$'+totalFee.toLocaleString());

  // ── 帳單摘要 ──────────────────────────────────────
  const statEl=document.getElementById('bilStat');
  if(statEl){
    const byRole={};
    recs.forEach(r=>{
      const k=r.desc||r.role||'其他';
      if(!byRole[k])byRole[k]={pts:0,count:0};
      byRole[k].pts+=r.points||0;
      byRole[k].count++;
    });
    const rows=Object.entries(byRole).map(([k,v])=>
      `<div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--g100);font-size:.82rem">
        <span>${k}（${v.count}次）</span>
        <span style="font-weight:700;color:var(--g600)">NT$${Math.round(v.pts*PTS_RATE).toLocaleString()}</span>
       </div>`
    ).join('');

    statEl.innerHTML=`
      <div style="font-size:.85rem;font-weight:900;color:var(--g700);margin-bottom:10px">
        ${curMonth.replace('-','年')}月 帳單明細
      </div>
      ${rows||'<div style="font-size:.82rem;color:var(--g400);padding:8px 0">本月尚無使用記錄</div>'}
      <div style="margin-top:10px;padding-top:10px;border-top:2px solid var(--g200)">
        <div style="display:flex;justify-content:space-between;font-size:.85rem;padding:4px 0">
          <span>基本月費</span>
          <span style="font-weight:700">NT$${BASE_FEE.toLocaleString()}</span>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:.85rem;padding:4px 0">
          <span>點數費用（${monthPts.toLocaleString()}點 × NT$${PTS_RATE}）</span>
          <span style="font-weight:700">NT$${ptsFee.toLocaleString()}</span>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:1rem;font-weight:900;padding:8px 0;margin-top:4px;border-top:1.5px solid var(--gold-l);color:var(--gold-d)">
          <span>本月合計</span>
          <span>NT$${totalFee.toLocaleString()}</span>
        </div>
        <div style="font-size:.78rem;color:var(--g400);margin-top:6px">
          每月12日結算　匯款：7505400208531
        </div>
      </div>`;
  }

  // ── 明細列表 ──────────────────────────────────────
  if(!recs.length){
    list.innerHTML='<div class="empty-state"><div class="es-ic">📊</div><div class="es-t">本月尚無使用記錄</div></div>';
    return;
  }
  list.innerHTML='';
  recs.slice(0,100).forEach(r=>{
    const row=document.createElement('div');
    row.style.cssText='display:flex;justify-content:space-between;align-items:center;padding:9px 14px;border-bottom:1px solid var(--g100);font-size:.84rem';
    row.innerHTML=
      `<div>
        <div style="font-weight:700;color:var(--g700)">${r.desc||r.summary||'AI使用'}</div>
        <div style="font-size:.72rem;color:var(--g400);margin-top:2px">${r.ts||r.day||''}${r.user?' · '+r.user:''}</div>
       </div>
       <div style="font-family:monospace;font-weight:900;color:var(--bad);white-space:nowrap">-${(r.points||0)} 點</div>`;
    list.appendChild(row);
  });
}

// ── 系統設定：分類管理 ─────────────────────────────────────
const DEFAULT_CATS={
  quoteCat:['拆除工程','泥作工程','木作工程','水電工程','系統傢俱','油漆工程','燈具工程','衛浴工程'],
  vendorCat:['系統櫃','廚具','玻璃','水電','泥作','油漆','鐵件','其他'],
  incomeCat:['合約收款','訂金','工程款','尾款','設計費','其他收入'],
  expenseCat:['材料費','工資','廠商費用','管理費','設備費','運費','其他支出'],
};
// 帳本內：依「收入/支出」決定分類選項（內帳/外帳皆可記收入或支出）
function getLedgerCats(type){
  return type==='in'?getSettingTags('incomeCat'):getSettingTags('expenseCat');
}
function getSettingTags(key){
  try{const v=localStorage.getItem('zeju_tags_'+key);if(v)return JSON.parse(v);}catch{}
  return DEFAULT_CATS[key]||[];
}
function saveSettingTags(key,arr){localStorage.setItem('zeju_tags_'+key,JSON.stringify(arr));}
function renderSettingTags(key,containerId){
  const c=document.getElementById(containerId);if(!c)return;
  const tags=getSettingTags(key);c.innerHTML='';
  tags.forEach((t,i)=>{
    const el=document.createElement('div');el.className='tag-item';
    el.innerHTML=t+' <span class="tag-del" onclick="delSettingTag(\''+key+'\','+i+',\''+containerId+'\')">✕</span>';
    c.appendChild(el);
  });
}
function addSettingTag(key,inpId,containerId){
  const inp=document.getElementById(inpId);if(!inp)return;
  const v=inp.value.trim();if(!v){showToast('⚠️ 請輸入名稱');return;}
  const tags=getSettingTags(key);
  if(tags.includes(v)){showToast('⚠️ 已有此分類');return;}
  tags.push(v);saveSettingTags(key,tags);inp.value='';
  renderSettingTags(key,containerId);showToast('✅ 已新增：'+v);
}
function delSettingTag(key,idx,containerId){
  const tags=getSettingTags(key);
  if(!confirm('確定刪除「'+tags[idx]+'」？'))return;
  tags.splice(idx,1);saveSettingTags(key,tags);
  renderSettingTags(key,containerId);showToast('✅ 已刪除');
}
function initSettings(){
  renderSettingTags('quoteCat','quoteCatTags');
  renderSettingTags('vendorCat','vendorCatTags');
  renderSettingTags('incomeCat','incomeCatTags');
  renderSettingTags('expenseCat','expenseCatTags');
  renderTrashBin();
  const saved=localStorage.getItem('zeju_bank_acct');
  if(saved){
    const el=document.getElementById('bankAcct');if(el)el.value=saved;
    const bl=document.getElementById('bilBankAcct');if(bl)bl.textContent=saved;
  }
}
function saveBankAcct(){
  const v=(document.getElementById('bankAcct')?.value||'').trim();
  if(!v){showToast('⚠️ 請填入帳號');return;}
  localStorage.setItem('zeju_bank_acct',v);
  const bl=document.getElementById('bilBankAcct');if(bl)bl.textContent=v;
  showToast('✅ 帳號已儲存！');
}

// ══ 帳款系統（月度總表 + 案場分析 + 明細）════════════════
// book: 'in'=外帳（客戶帳） 'out'=內帳（成本帳）
// type: 'in'=收入  'out'=支出

let curLedgerBook='out';
let curLedgerType='out';
let curLedgerMonth=null;
let curLedgerDir2='all';

function getLedgerBook(r){
  if(r.book)return r.book;
  return r.type==='in'?'in':'out';
}

function initLedgerMonth(){
  if(!curLedgerMonth){
    const now=new Date();
    curLedgerMonth=now.getFullYear()+'-'+(now.getMonth()+1).toString().padStart(2,'0');
  }
  updateLedgerMonthLabel();
}
function updateLedgerMonthLabel(){
  const el=document.getElementById('ledgerMonthLabel');if(!el)return;
  if(!curLedgerMonth){el.textContent='全期';return;}
  const p=curLedgerMonth.split('-');
  el.textContent=p[0]+'年'+parseInt(p[1])+'月';
}
function shiftLedgerMonth(dir){
  if(!curLedgerMonth){
    const now=new Date();
    curLedgerMonth=now.getFullYear()+'-'+(now.getMonth()+1).toString().padStart(2,'0');
  }
  const p=curLedgerMonth.split('-').map(Number);
  const d=new Date(p[0],p[1]-1+dir,1);
  curLedgerMonth=d.getFullYear()+'-'+(d.getMonth()+1).toString().padStart(2,'0');
  updateLedgerMonthLabel();renderLedger();
}
function setLedgerMonth(val){
  curLedgerMonth=(val==='all'?null:val);
  updateLedgerMonthLabel();renderLedger();
}
function setLedgerDir2(dir,el){
  curLedgerDir2=dir;
  document.querySelectorAll('.ldir[data-ldir]').forEach(t=>{
    if(t.dataset.ldir)t.classList.toggle('on',t.dataset.ldir===dir);
  });
  renderLedger();
}
function switchLedgerView(view,el){
  document.querySelectorAll('.ledger-view').forEach(v=>v.style.display='none');
  const el2=document.getElementById('lv-'+view);if(el2)el2.style.display='block';
  document.querySelectorAll('.ltab[data-lt]').forEach(t=>t.classList.toggle('on',t.dataset.lt===view));
  if(view==='monthly')renderLedgerMonthly();
  else if(view==='project')renderLedgerByProject();
  else renderLedger();
}
function getFilteredLedger(){
  let items=DB.get('ledger');
  if(curLedgerMonth)items=items.filter(r=>(r.date||'').startsWith(curLedgerMonth));
  const pf=document.getElementById('ledgerProjectFilter')?.value||'';
  if(pf)items=items.filter(r=>r.projectId==pf);
  return items.sort((a,b)=>b._id-a._id);
}
function updateLedgerProjectFilter(){
  const sel=document.getElementById('ledgerProjectFilter');if(!sel)return;
  const cur=sel.value;
  const projects=DB.get('projects');
  sel.innerHTML='<option value="">全部案場</option>'+
    projects.map(p=>'<option value="'+p._id+'"'+(p._id==cur?' selected':'')+'>'+esc(p.name)+'</option>').join('');
}
function updLedgerStats(){
  const items=getFilteredLedger();
  let inIn=0,inOut=0,outIn=0,outOut=0;
  items.forEach(r=>{
    const book=getLedgerBook(r);const amt=r.amount||0;
    if(book==='in'){if(r.type==='out')inOut+=amt;else inIn+=amt;}
    else{if(r.type==='in')outIn+=amt;else outOut+=amt;}
  });
  const profit=(inIn-inOut)-(outOut-outIn);
  const rate=inIn>0?Math.round(profit/inIn*100):0;
  const set=(id,v)=>{const el=document.getElementById(id);if(el)el.textContent=v;};
  set('ledInSum',inIn?'NT$'+inIn.toLocaleString():'NT$0');
  set('ledOutSum',outOut?'NT$'+outOut.toLocaleString():'NT$0');
  set('ledInExpense',inOut?'NT$'+inOut.toLocaleString():'NT$0');
  set('ledOutIncome',outIn?'NT$'+outIn.toLocaleString():'NT$0');
  set('ledProfitRate',inIn?rate+'%':'—');
  const pfEl=document.getElementById('ledProfit');
  if(pfEl){pfEl.textContent=(profit>=0?'+':'')+'NT$'+Math.abs(profit).toLocaleString();pfEl.style.color=profit>=0?'var(--ok)':'var(--bad)';}
  updateLedgerProjectFilter();
}
function renderLedger(){
  initLedgerMonth();updLedgerStats();
  const c=document.getElementById('ledger-detail-list');if(!c)return;
  let items=getFilteredLedger();
  if(curLedgerDir2!=='all'){
    const parts=curLedgerDir2.split('-');
    items=items.filter(r=>getLedgerBook(r)===parts[0]&&r.type===parts[1]);
  }
  if(!items.length){
    c.innerHTML='<div class="empty-state"><div class="es-ic">💰</div><div class="es-t">尚無記錄</div><div class="es-s">點右上角新增收支記錄</div></div>';
    return;
  }
  const projects=DB.get('projects');
  const CAT_C={'材料費':'background:#FEF9C3;color:#92400E','工資':'background:#D1FAE5;color:#065F46','廠商費用':'background:#DBEAFE;color:#1E40AF','管理費':'background:#EDE9FE;color:#5B21B6','合約收款':'background:#D1FAE5;color:#065F46','訂金':'background:#FEF9C3;color:#92400E','工程款':'background:#D1FAE5;color:#065F46','設計費':'background:#FCE7F3;color:#9D174D'};
  c.innerHTML='';
  let runTotal=0;
  const byDate={};
  items.forEach(r=>{const d=r.date||r._ts?.split(' ')[0]||'未填';if(!byDate[d])byDate[d]=[];byDate[d].push(r);});
  Object.entries(byDate).sort((a,b)=>b[0].localeCompare(a[0])).forEach(([date,di])=>{
    const dh=document.createElement('div');
    dh.style.cssText='font-size:.72rem;font-weight:900;color:var(--g400);padding:10px 0 6px;letter-spacing:.05em;border-bottom:1px solid var(--g100)';
    dh.textContent=date;c.appendChild(dh);
    di.forEach(r=>{
      const isIn=r.type==='in';const book=getLedgerBook(r);
      const proj=r.projectId?projects.find(p=>p._id==r.projectId):null;
      const cs=CAT_C[r.cat]||'background:var(--g100);color:var(--g600)';
      runTotal+=(isIn?1:-1)*(r.amount||0);
      const row=document.createElement('div');
      row.style.cssText='display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--g50)';
      row.innerHTML='<div style="width:38px;height:38px;border-radius:10px;background:'+(isIn?'var(--ok-bg)':'var(--bad-bg)')+';display:flex;align-items:center;justify-content:center;font-size:.95rem;flex-shrink:0">'+(isIn?'💰':'📤')+'</div>'+
        '<div style="flex:1;min-width:0"><div style="font-size:.88rem;font-weight:700;color:var(--g700)">'+esc(r.desc||r.cat||'記錄')+'</div>'+
        '<div style="display:flex;gap:5px;align-items:center;margin-top:3px;flex-wrap:wrap">'+
        (r.cat?'<span style="font-size:.68rem;padding:2px 7px;border-radius:10px;'+cs+'">'+r.cat+'</span>':'')+
        '<span style="font-size:.68rem;padding:2px 7px;border-radius:10px;background:'+(book==='in'?'var(--ok-bg)':'var(--bad-bg)')+';color:'+(book==='in'?'var(--ok)':'var(--bad)')+';">'+(book==='in'?'外帳':'內帳')+'</span>'+
        (proj?'<span style="font-size:.68rem;color:var(--g400)">📍'+esc(proj.name)+'</span>':'')+
        (r.caseN&&!proj?'<span style="font-size:.68rem;color:var(--g400)">📍'+esc(r.caseN)+'</span>':'')+
        '</div></div>'+
        '<div style="text-align:right;flex-shrink:0"><div style="font-weight:900;font-size:.95rem;color:'+(isIn?'var(--ok)':'var(--bad)')+';">'+(isIn?'+':'-')+'NT$'+(r.amount||0).toLocaleString()+'</div>'+
        '<button onclick="delLedger('+r._id+')" style="font-size:.65rem;color:var(--g300);background:none;border:none;cursor:pointer;padding:0;margin-top:2px">刪除</button></div>';
      c.appendChild(row);
    });
  });
  const sr=document.createElement('div');
  sr.style.cssText='display:flex;justify-content:space-between;align-items:center;padding:12px 0;border-top:2px solid var(--g200);margin-top:4px;font-weight:900';
  sr.innerHTML='<span style="color:var(--g600)">'+items.length+' 筆記錄</span><span style="color:'+(runTotal>=0?'var(--ok)':'var(--bad)')+'">'+( runTotal>=0?'+':'')+'NT$'+Math.abs(runTotal).toLocaleString()+'</span>';
  c.appendChild(sr);
}
function renderLedgerMonthly(){
  const c=document.getElementById('ledger-monthly-table');if(!c)return;
  const all=DB.get('ledger');
  if(!all.length){c.innerHTML='<div class="empty-state"><div class="es-ic">📅</div><div class="es-t">尚無帳款記錄</div></div>';return;}
  const months=new Set();
  all.forEach(r=>{if(r.date)months.add(r.date.slice(0,7));});
  const sm=[...months].sort().reverse();
  c.innerHTML='';
  const hd=document.createElement('div');
  hd.style.cssText='display:grid;grid-template-columns:90px 1fr 1fr 1fr 70px;gap:6px;padding:8px 12px;background:var(--g100);border-radius:var(--rs);font-size:.72rem;font-weight:900;color:var(--g400);margin-bottom:8px';
  hd.innerHTML='<span>月份</span><span style="text-align:right">外帳收入</span><span style="text-align:right">內帳支出</span><span style="text-align:right">毛利</span><span style="text-align:right">毛利率</span>';
  c.appendChild(hd);
  let tIn=0,tOut=0;
  sm.forEach(month=>{
    const it=all.filter(r=>(r.date||'').startsWith(month));
    const inIn=it.filter(r=>getLedgerBook(r)==='in'&&r.type==='in').reduce((s,r)=>s+(r.amount||0),0);
    const inOut=it.filter(r=>getLedgerBook(r)==='in'&&r.type==='out').reduce((s,r)=>s+(r.amount||0),0);
    const outOut=it.filter(r=>getLedgerBook(r)==='out'&&r.type==='out').reduce((s,r)=>s+(r.amount||0),0);
    const outIn=it.filter(r=>getLedgerBook(r)==='out'&&r.type==='in').reduce((s,r)=>s+(r.amount||0),0);
    const profit=(inIn-inOut)-(outOut-outIn);const rate=inIn>0?Math.round(profit/inIn*100):0;
    tIn+=inIn;tOut+=outOut;
    const pp=month.split('-');
    const row=document.createElement('div');
    row.style.cssText='display:grid;grid-template-columns:90px 1fr 1fr 1fr 70px;gap:6px;padding:10px 12px;border-bottom:1px solid var(--g100);cursor:pointer;transition:background var(--ease);font-size:.85rem;align-items:center';
    row.innerHTML='<span style="font-weight:800;color:var(--g700)">'+parseInt(pp[0])+'年'+parseInt(pp[1])+'月</span>'+
      '<span style="text-align:right;color:var(--ok);font-weight:700">'+(inIn?'NT$'+inIn.toLocaleString():'—')+'</span>'+
      '<span style="text-align:right;color:var(--bad);font-weight:700">'+(outOut?'NT$'+outOut.toLocaleString():'—')+'</span>'+
      '<span style="text-align:right;color:'+(profit>=0?'var(--ok)':'var(--bad)')+';font-weight:800">'+(profit?'NT$'+profit.toLocaleString():'—')+'</span>'+
      '<span style="text-align:right;color:'+(rate>=0?'var(--ok)':'var(--bad)')+';">'+(inIn?rate+'%':'—')+'</span>';
    row.addEventListener('click',()=>{setLedgerMonth(month);switchLedgerView('detail',null);document.querySelector('[data-lt="detail"]')?.classList.add('on');document.querySelector('[data-lt="monthly"]')?.classList.remove('on');});
    row.addEventListener('mouseenter',()=>row.style.background='var(--g50)');
    row.addEventListener('mouseleave',()=>row.style.background='');
    c.appendChild(row);
  });
  const tp=tIn-tOut;const tr=tIn>0?Math.round(tp/tIn*100):0;
  const tot=document.createElement('div');
  tot.style.cssText='display:grid;grid-template-columns:90px 1fr 1fr 1fr 70px;gap:6px;padding:12px;background:var(--gold-pale);border-radius:var(--rs);font-size:.88rem;font-weight:900;margin-top:8px;border:1.5px solid var(--gold-l)';
  tot.innerHTML='<span style="color:var(--gold-d)">合計</span><span style="text-align:right;color:var(--ok)">NT$'+tIn.toLocaleString()+'</span><span style="text-align:right;color:var(--bad)">NT$'+tOut.toLocaleString()+'</span><span style="text-align:right;color:'+(tp>=0?'var(--ok)':'var(--bad)')+'">NT$'+tp.toLocaleString()+'</span><span style="text-align:right">'+(tIn?tr+'%':'—')+'</span>';
  c.appendChild(tot);
}
function renderLedgerByProject(){
  const c=document.getElementById('ledger-project-table');if(!c)return;
  const all=curLedgerMonth?DB.get('ledger').filter(r=>(r.date||'').startsWith(curLedgerMonth)):DB.get('ledger');
  const projects=DB.get('projects');
  const byP={};
  all.forEach(r=>{const k=r.projectId?String(r.projectId):'_other';if(!byP[k])byP[k]=[];byP[k].push(r);});
  c.innerHTML='';
  const hd=document.createElement('div');
  hd.style.cssText='display:grid;grid-template-columns:1fr 100px 100px 100px;gap:6px;padding:8px 12px;background:var(--g100);border-radius:var(--rs);font-size:.72rem;font-weight:900;color:var(--g400);margin-bottom:8px';
  hd.innerHTML='<span>案場</span><span style="text-align:right">收入</span><span style="text-align:right">支出</span><span style="text-align:right">毛利</span>';
  c.appendChild(hd);
  const calcP=recs=>recs.filter(r=>r.type==='in').reduce((s,r)=>s+(r.amount||0),0)-recs.filter(r=>r.type==='out').reduce((s,r)=>s+(r.amount||0),0);
  Object.entries(byP).sort((a,b)=>calcP(b[1])-calcP(a[1])).forEach(([key,recs])=>{
    const proj=key!=='_other'?projects.find(p=>String(p._id)===key):null;
    const income=recs.filter(r=>getLedgerBook(r)==='in'&&r.type==='in').reduce((s,r)=>s+(r.amount||0),0);
    const cost=recs.filter(r=>getLedgerBook(r)==='out'&&r.type==='out').reduce((s,r)=>s+(r.amount||0),0);
    const profit=income-cost;
    const row=document.createElement('div');
    row.style.cssText='display:grid;grid-template-columns:1fr 100px 100px 100px;gap:6px;padding:10px 12px;border-bottom:1px solid var(--g100);cursor:pointer;transition:background var(--ease);font-size:.85rem;align-items:center';
    row.innerHTML='<div><div style="font-weight:800;color:var(--g700)">'+esc(proj?proj.name:(recs[0]?.caseN||'未指定案場'))+'</div>'+
      (proj?'<div style="font-size:.7rem;color:var(--g400)">'+esc(proj.client||'')+' '+recs.length+' 筆</div>':'<div style="font-size:.7rem;color:var(--g400)">'+recs.length+' 筆</div>')+
      '</div>'+
      '<span style="text-align:right;color:var(--ok);font-weight:700">'+(income?'NT$'+income.toLocaleString():'—')+'</span>'+
      '<span style="text-align:right;color:var(--bad);font-weight:700">'+(cost?'NT$'+cost.toLocaleString():'—')+'</span>'+
      '<span style="text-align:right;color:'+(profit>=0?'var(--ok)':'var(--bad)')+';font-weight:800;">'+(profit?'NT$'+profit.toLocaleString():'—')+'</span>';
    if(proj)row.addEventListener('click',()=>openProject(proj._id,'ledger'));
    row.addEventListener('mouseenter',()=>row.style.background='var(--g50)');
    row.addEventListener('mouseleave',()=>row.style.background='');
    c.appendChild(row);
  });
  if(!Object.keys(byP).length)c.innerHTML='<div class="empty-state"><div class="es-ic">🏗️</div><div class="es-t">尚無案場帳款</div></div>';
}
function setLedgerDir(dir){
  curLedgerType=dir;
  const bl=curLedgerBook==='out'?'內帳':'外帳';
  const title=document.getElementById('ledgerModalTitle');
  if(title)title.innerHTML='＋ 新增'+(dir==='in'?'收入':'支出')+'記錄（'+bl+'）<button class="mcl" data-close="ledgerModal">✕</button>';
  const cat=document.getElementById('ldCat');
  if(cat)cat.innerHTML=getLedgerCats(dir).map(o=>'<option>'+o+'</option>').join('');
}
function openLedgerModal(book){
  curLedgerBook=book||'out';curLedgerType=curLedgerBook==='in'?'in':'out';
  const dt=document.getElementById('ldDate');if(dt)dt.value=new Date().toISOString().split('T')[0];
  ['ldAmt','ldDesc','ldCase'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
  ldItems=[];ldImgUrl=null;
  const fc=document.getElementById('ldFileCard');if(fc)fc.style.display='none';
  const tb=document.getElementById('ldItemsTable');if(tb)tb.innerHTML='';
  const op=document.getElementById('ldOcr');if(op)op.classList.remove('show');
  document.querySelectorAll('.ldir[data-ldir="in"],.ldir[data-ldir="out"]').forEach(t=>t.classList.toggle('on',t.dataset.ldir===curLedgerType));
  setLedgerDir(curLedgerType);openModal('ledgerModal');
}
function switchLedger(book){openLedgerModal(book);}
function delLedger(id){DB.softDel('ledger',id);renderLedger();updLedgerStats();showToast('✅ 已移至垃圾桶');}


// ── 發票管理 ──────────────────────────────────────────────
function renderInvoices(filter){
  const list=document.getElementById('invList');if(!list)return;
  let data=DB.get('invoices');
  if(filter)data=data.filter(v=>(v.no||'').includes(filter)||(v.desc||'').includes(filter)||(v.cat||'').includes(filter));
  if(!data.length){
    list.innerHTML='<div class="empty-state"><div class="es-ic">🧾</div><div class="es-t">尚無發票記錄</div><div class="es-s">點右上方「新增發票」，上傳照片 AI 自動辨識</div></div>';return;
  }
  list.innerHTML='';
  data.forEach(v=>{
    const card=document.createElement('div');card.className='icard';
    const thumb=document.createElement('div');
    if(v.imgDataUrl){
      thumb.className='itw';
      const img=document.createElement('img');img.src=v.imgDataUrl;
      img.addEventListener('click',e=>{e.stopPropagation();openLB(v.imgDataUrl);});
      thumb.appendChild(img);
    }else{thumb.className='ino';thumb.textContent='🧾';}
    card.innerHTML=
      '<div style="flex:1;min-width:0">'+
        '<div style="font-size:.88rem;font-weight:900;color:var(--info);font-family:monospace">'+(v.no||'—')+'</div>'+
        '<div style="font-size:.85rem;font-weight:700;margin-top:3px">'+(v.desc||'—')+
          ' <span style="font-size:.68rem;background:var(--info-bg);color:var(--info);padding:2px 8px;border-radius:20px;border:1px solid var(--info-bd)">'+(v.cat||'')+'</span></div>'+
        '<div style="font-size:.72rem;color:var(--g400);margin-top:2px;font-family:monospace">'+(v.date||'')+' · '+(v._ts||'').split(' ')[0]+'</div>'+
      '</div>'+
      '<div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px;flex-shrink:0">'+
        '<div style="font-size:1rem;font-weight:900;font-family:monospace">'+fmt(v.amount||0)+'</div>'+
        '<div style="display:flex;gap:5px">'+
          '<button class="btn bo bxs" data-iedit="'+v._id+'">✏️ 編輯</button>'+
          '<button class="btn brd bxs" data-idel="'+v._id+'">🗑</button>'+
        '</div>'+
      '</div>';
    card.prepend(thumb);
    card.querySelector('[data-iedit]').addEventListener('click',e=>{e.stopPropagation();openInvEdit(v._id);});
    card.querySelector('[data-idel]').addEventListener('click',e=>{e.stopPropagation();if(!confirm('確定刪除？'))return;DB.del('invoices',v._id);renderInvoices(document.getElementById('invSrch')?.value||'');updStats();showToast('✅ 已刪除');});
    list.appendChild(card);
  });
}

// ── 合約管理 ──────────────────────────────────────────────
let ctFilter='all';
function updContractStats(){
  const cs=DB.get('contracts');
  const signed=cs.filter(c=>c.status==='signed').length;
  const total=cs.reduce((s,c)=>s+(c.amount||0),0);
  const set=(id,v)=>{const el=document.getElementById(id);if(el)el.textContent=v;};
  set('ctCnt',cs.length);set('ctSigned',signed);set('ctAmt',total?fmt(total):'—');
}
function renderContracts(){
  const list=document.getElementById('contractList');if(!list)return;
  let data=DB.get('contracts');
  const sf=document.getElementById('ctStatusFilter')?.value||'all';
  const kw=(document.getElementById('ctSearch')?.value||'').toLowerCase();
  if(ctFilter!=='all')data=data.filter(c=>c.status===ctFilter);
  if(sf!=='all')data=data.filter(c=>c.status===sf);
  if(kw)data=data.filter(c=>(c.name||'').toLowerCase().includes(kw)||(c.client||'').toLowerCase().includes(kw));
  if(!data.length){
    list.innerHTML='<div class="empty-state"><div class="es-ic">📝</div><div class="es-t">尚無合約記錄</div><div class="es-s">點右上方「上傳合約」開始建立</div></div>';return;
  }
  list.innerHTML='';
  data.forEach(c=>{
    const card=document.createElement('div');card.className='contract-card';
    card.innerHTML=
      '<div class="cc-hd">'+
        '<div class="cc-icon">'+( (c.fileUrls||[]).length>1?'📚'+(c.fileUrls.length)+'頁':isImageUrl(c.fileUrl)?'🖼️':'📄')+'</div>'+
        '<div class="cc-info">'+
          '<div class="cc-name">'+c.name+'<span class="cc-badge '+(c.status==='signed'?'signed':'pending')+'">'+( c.status==='signed'?'✅ 結案':'📋 未開始')+'</span></div>'+
          '<div class="cc-meta">業主：'+(c.client||'—')+' ｜ '+(c.amount?fmt(c.amount):'未填金額')+' ｜ '+(c._ts||'').split(' ')[0]+'</div>'+
          (c.note?'<div style="font-size:.75rem;color:var(--g400);margin-top:2px">📌 '+c.note+'</div>':'')+
        '</div>'+
        '<div style="display:flex;flex-direction:column;gap:6px;align-items:flex-end;flex-shrink:0">'+
          ((c.fileUrl||( c.fileUrls&&c.fileUrls.length))?'<button class="btn bg bsm" data-cprev="'+c._id+'">👁 查看</button>':'')+
          '<div style="display:flex;gap:5px">'+
            '<button class="btn bo bxs" data-cedit="'+c._id+'">✏️</button>'+
            '<button class="btn bo bxs" data-ctog="'+c._id+'">'+( c.status==='signed'?'↩ 未開始':'✅ 結案')+'</button>'+
            '<button class="btn brd bxs" data-cdel="'+c._id+'">🗑</button>'+
          '</div>'+
        '</div>'+
      '</div>';
    card.querySelector('[data-cprev]')?.addEventListener('click',()=>previewContract(c._id));
    card.querySelector('[data-cedit]').addEventListener('click',()=>editContract(c._id));
    card.querySelector('[data-ctog]').addEventListener('click',()=>toggleContractStatus(c._id));
    card.querySelector('[data-cdel]').addEventListener('click',()=>{if(!confirm('確定刪除「'+c.name+'」？（可在系統設定→垃圾桶復原）'))return;DB.softDel('contracts',c._id);renderContracts();updContractStats();showToast('✅ 已移至垃圾桶');});
    list.appendChild(card);
  });
}
function previewContract(id){
  const c=DB.get('contracts').find(r=>r._id===id);if(!c)return;
  // 相容新格式（物件陣列）和舊格式（字串）
  let urls=[];
  if(c.fileUrls&&c.fileUrls.length){
    urls=c.fileUrls.map(f=>typeof f==='string'?f:(f.url||'')).filter(Boolean);
  } else if(c.fileUrl){
    const u=typeof c.fileUrl==='string'?c.fileUrl:(c.fileUrl.url||'');
    if(u) urls=[u];
  }
  if(!urls.length){showToast('⚠️ 此合約尚未上傳檔案');return;}

  // 建立燈箱輪播
  const ov=document.createElement('div');
  ov.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.92);z-index:9999;display:flex;flex-direction:column;align-items:center;justify-content:center;';
  let cur=0;

  function render(){
    ov.innerHTML='';
    // 關閉按鈕
    const close=document.createElement('button');
    close.textContent='✕';
    close.style.cssText='position:absolute;top:16px;right:20px;background:none;border:none;color:#fff;font-size:1.8rem;cursor:pointer;z-index:1;';
    close.onclick=()=>ov.remove();
    ov.appendChild(close);

    // 頁碼
    if(urls.length>1){
      const pg=document.createElement('div');
      pg.style.cssText='color:#fff;font-size:.9rem;margin-bottom:10px;';
      pg.textContent=(cur+1)+' / '+urls.length;
      ov.appendChild(pg);
    }

    // 圖片/PDF
    const u=urls[cur];
    if(u.startsWith('data:image')||u.match(/\.(jpg|jpeg|png|gif|webp)/i)){
      const img=document.createElement('img');
      img.src=u;
      img.style.cssText='max-width:92vw;max-height:78vh;object-fit:contain;border-radius:8px;';
      ov.appendChild(img);
    } else {
      const fr=document.createElement('iframe');
      fr.src=u;
      fr.style.cssText='width:90vw;height:80vh;border:none;background:#fff;border-radius:8px;';
      ov.appendChild(fr);
    }

    // 前後按鈕
    if(urls.length>1){
      const nav=document.createElement('div');
      nav.style.cssText='display:flex;gap:20px;margin-top:14px;';
      const prev=document.createElement('button');
      prev.textContent='← 上一頁';prev.style.cssText='background:#fff2;color:#fff;border:none;padding:8px 20px;border-radius:20px;cursor:pointer;font-size:.95rem;';
      prev.onclick=()=>{cur=(cur-1+urls.length)%urls.length;render();};
      const next=document.createElement('button');
      next.textContent='下一頁 →';next.style.cssText='background:#fff2;color:#fff;border:none;padding:8px 20px;border-radius:20px;cursor:pointer;font-size:.95rem;';
      next.onclick=()=>{cur=(cur+1)%urls.length;render();};
      if(cur>0) nav.appendChild(prev);
      if(cur<urls.length-1) nav.appendChild(next);
      ov.appendChild(nav);
    }
  }

  render();
  document.body.appendChild(ov);
  // 僅可點右上角 ✕ 關閉，避免左右滑動瀏覽圖片時誤觸背景而關閉
}
function toggleContractStatus(id){
  const c=DB.get('contracts').find(r=>r._id===id);if(!c)return;
  DB.upd('contracts',id,{status:c.status==='signed'?'pending':'signed'});
  renderContracts();updContractStats();
  showToast(c.status==='signed'?'已改為未開始':'✅ 已標記結案');
}
function editContract(id){
  const c=DB.get('contracts').find(r=>r._id===id);if(!c)return;
  ctEditId=id; ctImgUrl=c.fileUrl||null;
  ['ctName','ctClient','ctNote'].forEach(fid=>{const el=document.getElementById(fid);if(el)el.value=c[fid.replace('ct','').toLowerCase()]||c.name||'';});
  const ctN=document.getElementById('ctName');if(ctN)ctN.value=c.name||'';
  const ctC=document.getElementById('ctClient');if(ctC)ctC.value=c.client||'';
  const ctA=document.getElementById('ctAmt2');if(ctA)ctA.value=c.amount||'';
  const ctS=document.getElementById('ctStatus');if(ctS)ctS.value=c.status||'pending';
  const ctNo=document.getElementById('ctNote');if(ctNo)ctNo.value=c.note||'';
  if(c.fileUrl){
    const fc=document.getElementById('ctFileCard');if(fc)fc.style.display='block';
    const fn=document.getElementById('ctFileName');if(fn)fn.textContent=c.name;
  }
  const btn=document.getElementById('addCtBtn');if(btn)btn.textContent='💾 儲存修改';
  openModal('contractModal');
}
function delContract(id){
  if(!confirm('確定刪除此合約？'))return;
  DB.softDel('contracts',id);renderContracts();updContractStats();showToast('✅ 已移至垃圾桶');
}

// ── initApiCard ────────────────────────────────────────────
function initApiCard(){
  const inp=document.getElementById('apiInp');
  if(inp&&API_KEY)inp.value=API_KEY;
  const dot=document.getElementById('apiDot');
  if(dot){
    dot.textContent=API_KEY?'✅ 已設定':'⚠️ 未設定';
    dot.style.background=API_KEY?'var(--ok-bg)':'var(--warn-bg)';
    dot.style.color=API_KEY?'var(--ok)':'var(--warn)';
  }
}
function setApiDot(ok){
  const dot=document.getElementById('apiDot');if(!dot)return;
  dot.textContent=ok?'✅ 已設定':'⚠️ 未設定';
  dot.style.background=ok?'var(--ok-bg)':'var(--warn-bg)';
  dot.style.color=ok?'var(--ok)':'var(--warn)';
}

// ── 統計 ──────────────────────────────────────────────────
function updStats(){
  const qs=DB.get('quotes'),vs=DB.get('vendors'),is=DB.get('invoices');
  const qsum=qs.reduce((a,q)=>a+(q.total||0),0);
  const vtot=vs.reduce((a,v)=>a+(v.amount||0),0);
  const isum=is.reduce((a,v)=>a+(v.amount||0),0);
  const set=(id,v)=>{const el=document.getElementById(id);if(el)el.textContent=v;};
  set('qCnt',qs.length);set('qSum',qsum?fmt(qsum):'—');
  set('vCnt',vs.length);set('vCatCnt',new Set(vs.map(v=>v.cat)).size);set('vTot',vtot?fmt(vtot):'—');
  set('invCnt',is.length);set('invSum',isum?fmt(isum):'—');
  set('ds-amt',qsum?fmt(qsum):'—');set('ds-q',qs.length);set('ds-vend',vs.length);set('ds-inv',is.length);
}

// ── updVCaseFilter ─────────────────────────────────────────
function updVCaseFilter(){
  const sel=document.getElementById('vCaseFilter');if(!sel)return;
  const cases=[...new Set(DB.get('vendors').map(v=>v.caseN).filter(Boolean))];
  const cur=sel.value;sel.innerHTML='<option value="">全部案場</option>';
  cases.forEach(c=>{const o=document.createElement('option');o.value=c;o.textContent='📍 '+c;if(c===cur)o.selected=true;sel.appendChild(o);});
}

// ── initAdQuote ────────────────────────────────────────────
function initAdQuote(){
  adSections=JSON.parse(JSON.stringify(DEF_SECTIONS));
  const qbC=document.getElementById('adQbClient');if(qbC)qbC.textContent='—';
  const qbA=document.getElementById('adQbAddr');if(qbA)qbA.textContent='—';
  const qbD=document.getElementById('adQbDate');if(qbD)qbD.textContent=new Date().toLocaleDateString('zh-TW');
  renderProQuote('adSections',adSections,{allowDelSec:true,totIds:{sub:'adSub',mgmt:'adMgmt',total:'adTotal'}});

  // ── 按鈕綁定（每次初始化都重綁，避免遺失）──
  const getN=()=>document.getElementById('adN')?.value||'業主';
  const getTp=()=>document.getElementById('adTp')?.value||'全室裝修';

  const adSaveBtn=document.getElementById('adSave');
  if(adSaveBtn&&!adSaveBtn._bound){
    adSaveBtn._bound=true;
    adSaveBtn.addEventListener('click',()=>{
      const sub=calcAll(adSections);
      const caseNv=document.getElementById('adCase')?.value||'';
      DB.push('quotes',{summary:'報價 '+getN()+' '+caseNv+' '+fmt(sub),
        name:getN(),type:getTp(),caseN:caseNv,
        addr:document.getElementById('adAd')?.value||'',
        projectId:curProjectId||null,
        sections:JSON.parse(JSON.stringify(adSections)),total:sub});
      updStats();renderQTable();
      showToast('✅ 報價單已儲存！');
      // 下一步提示
      if(typeof showNextStep==='function'){
        showNextStep('報價單已儲存，接下來呢？',[
          {label:'📤 下載 Excel 給業主',action:()=>dlXls(getN(),getTp(),adSections,'client')},
          {label:'📝 建立合約',action:()=>openModal('contractModal')},
          {label:'稍後再說',action:()=>{}},
        ]);
      }
    });
  }

  const adXlsBtn=document.getElementById('adXls');
  if(adXlsBtn&&!adXlsBtn._bound){
    adXlsBtn._bound=true;
    adXlsBtn.addEventListener('click',()=>dlXls(getN(),getTp(),adSections,'internal'));
  }

  const adXlsClientBtn=document.getElementById('adXlsClient');
  if(adXlsClientBtn&&!adXlsClientBtn._bound){
    adXlsClientBtn._bound=true;
    adXlsClientBtn.addEventListener('click',()=>dlXls(getN(),getTp(),adSections,'client'));
  }

  const adAddSecBtn=document.getElementById('adAddSec');
  if(adAddSecBtn&&!adAddSecBtn._bound){
    adAddSecBtn._bound=true;
    adAddSecBtn.addEventListener('click',()=>{
      adSections.push({id:'s'+Date.now(),icon:'🔧',name:'新增分類',items:[{name:'',unit:'式',qty:1,price:0,cost:0}]});
      renderProQuote('adSections',adSections,{allowDelSec:true,totIds:{sub:'adSub',mgmt:'adMgmt',total:'adTotal'}});
    });
  }

  const modeIntBtn=document.getElementById('modeInternal');
  if(modeIntBtn&&!modeIntBtn._bound){
    modeIntBtn._bound=true;
    modeIntBtn.onclick=()=>setQuoteMode('internal');
  }
  const modeCliBtn=document.getElementById('modeClient');
  if(modeCliBtn&&!modeCliBtn._bound){
    modeCliBtn._bound=true;
    modeCliBtn.onclick=()=>setQuoteMode('client');
  }
}

// ── initMultiClientChat ─────────────────────────────────────
function filterClients(kw){renderClientList(kw);}
function initMultiClientChat(){
  const addBtn=document.getElementById('addClientBtn');
  if(addBtn&&!addBtn._b){addBtn._b=true;addBtn.addEventListener('click',()=>openAddClientModal());}
  renderClientList();
  const clients=DB.get('clients');
  if(clients.length)switchClient(clients[0]._id);
  else{
    const chat=document.getElementById('cs-chat');
    if(chat)chat.innerHTML='<div style="height:100%;display:flex;align-items:center;justify-content:center;color:var(--g400);flex-direction:column;gap:12px;font-size:.9rem"><div style="font-size:2.5rem">💬</div><div style="font-weight:700">點右上方「＋ 新增客戶」開始諮詢</div></div>';
  }
}
function renderClientList(filter){
  const list=document.getElementById('clientList');if(!list)return;
  let clients=DB.get('clients');
  if(filter)clients=clients.filter(c=>(c.name||'').toLowerCase().includes(filter.toLowerCase()));
  const cnt=document.getElementById('clientCount');
  if(cnt)cnt.textContent=DB.get('clients').length+' 位客戶';
  if(!clients.length){
    list.innerHTML='<div style="padding:20px 14px;text-align:center"><div style="font-size:1.5rem;margin-bottom:8px">👤</div><div style="font-size:.82rem;color:var(--g400);font-weight:600">'+(filter?'找不到「'+filter+'」':'尚無客戶')+'</div>'+(filter?'':'<div style="font-size:.75rem;color:var(--g300);margin-top:4px">點上方按鈕新增</div>')+'</div>';
    return;
  }
  list.innerHTML='';
  clients.forEach(c=>{
    const isActive=c._id===curClientId;
    const el=document.createElement('div');
    el.style.cssText='padding:12px 14px;cursor:pointer;border-bottom:1px solid var(--g100);transition:all var(--ease);position:relative;'+(isActive?'background:var(--gold-pale);border-left:3px solid var(--gold)':'border-left:3px solid transparent');

    const initials=c.name.charAt(0);
    el.innerHTML=
      '<div style="display:flex;align-items:center;gap:9px">'+
        '<div style="width:32px;height:32px;border-radius:50%;background:'+(isActive?'linear-gradient(135deg,var(--gold-d),var(--gold))':'var(--g200)')+';color:'+(isActive?'var(--w)':'var(--g500)')+';font-size:.82rem;font-weight:900;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:all var(--ease)">'+initials+'</div>'+
        '<div style="flex:1;min-width:0">'+
          '<div style="font-size:.88rem;font-weight:'+(isActive?'900':'700')+';color:'+(isActive?'var(--gold-d)':'var(--g700)')+';overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+c.name+'</div>'+
          '<div style="font-size:.7rem;color:var(--g400);margin-top:1px">'+(c.phone||'未填電話')+'</div>'+
        '</div>'+
      '</div>';

    const delBtn=document.createElement('button');
    delBtn.style.cssText='position:absolute;top:50%;right:8px;transform:translateY(-50%);width:24px;height:24px;background:var(--bad-bg);border:1px solid var(--bad-bd);color:var(--bad);border-radius:var(--rxs);cursor:pointer;font-size:.65rem;display:none;align-items:center;justify-content:center;transition:all var(--ease)';
    delBtn.title='刪除客戶';delBtn.textContent='🗑';

    el.addEventListener('mouseenter',()=>{if(!isActive)el.style.background='var(--g100)';delBtn.style.display='flex';});
    el.addEventListener('mouseleave',()=>{if(!isActive)el.style.background='';delBtn.style.display='none';});
    el.addEventListener('click',e=>{if(delBtn.contains(e.target))return;switchClient(c._id);});
    delBtn.addEventListener('click',e=>{
      e.stopPropagation();
      if(!confirm('確定刪除客戶「'+c.name+'」及所有對話？'))return;
      const cs=DB.get('clients').filter(x=>x._id!==c._id);DB.set('clients',cs);
      if(curClientId===c._id){curClientId=null;const chat=document.getElementById('cs-chat');if(chat)chat.innerHTML='';}
      renderClientList();showToast('✅ 已刪除客戶「'+c.name+'」');
    });
    el.appendChild(delBtn);list.appendChild(el);
  });
}
function switchClient(id){
  curClientId=id;
  const client=DB.get('clients').find(c=>c._id===id);if(!client)return;
  renderClientList();
  // 更新右側 header
  const hd=document.getElementById('chatClientHeader');
  if(hd)hd.style.display='flex';
  const av=document.getElementById('chatClientAvatar');
  if(av)av.textContent=client.name.charAt(0);
  const nm=document.getElementById('chatClientName');
  if(nm)nm.textContent=client.name;
  // 初始化對話
  const chatEl=document.getElementById('cs-chat');if(!chatEl)return;
  const chatId='cs-'+id;
  chatEl.innerHTML='';
  chatEl.style.cssText='flex:1;min-height:0;display:flex;flex-direction:column';
  initChat(chatId,'cs',0,'您好！我是澤居的 AI 客服小澤 🏠\n很高興為您服務，'+client.name+'！\n有任何裝修問題或需要報價，請直接告訴我。',['裝修費用詢問','工期多長？','付款方式？']);
}

// ── checkPaymentTriggers ───────────────────────────────────
function checkPaymentTriggers(){
  const progs=DB.get('progress');const alerts=[];
  progs.forEach(p=>{
    if(!p.items||!p.items.length)return;
    const done=p.items.filter(x=>x.done).length;
    const pct=Math.round(done/p.items.length*100);
    if(pct>=70&&pct<100)alerts.push('📋 '+p.caseN+'：完成 '+pct+'%，可請款第三期工程款（30%）');
    if(pct===100)alerts.push('✅ '+p.caseN+'：工程完成，請安排驗收並收取尾款（10%）');
  });
  const el=document.getElementById('paymentAlerts');
  if(el&&alerts.length){
    el.innerHTML=alerts.map(a=>'<div style="padding:10px 14px;background:var(--warn-bg);border:1.5px solid var(--warn-bd);border-radius:var(--rs);margin-bottom:7px;font-size:.85rem;font-weight:600;color:var(--warn)">'+a+'</div>').join('');
    el.style.display='block';
  }
}

// ── exportBackup / importBackup ────────────────────────────
// ══ 財務報表定義 ══════════════════════════════════════════
const RPTS={
  monthly:{
    t:'月度損益報表',
    b:()=>{
      const all=DB.get('ledger');
      const months=new Set();
      all.forEach(r=>{if(r.date)months.add(r.date.slice(0,7));});
      const sm=[...months].sort().reverse().slice(0,12);
      if(!sm.length)return '<p style="color:var(--g400)">尚無帳款資料</p>';
      let tIn=0,tOut=0;
      const rows=sm.map(month=>{
        const it=all.filter(r=>(r.date||'').startsWith(month));
        const inIn=it.filter(r=>getLedgerBook(r)==='in'&&r.type==='in').reduce((s,r)=>s+(r.amount||0),0);
        const outOut=it.filter(r=>getLedgerBook(r)==='out'&&r.type==='out').reduce((s,r)=>s+(r.amount||0),0);
        const profit=inIn-outOut;const rate=inIn>0?Math.round(profit/inIn*100):0;
        tIn+=inIn;tOut+=outOut;
        const [y,m]=month.split('-');
        return `<tr><td style="padding:8px 12px;font-weight:700">${parseInt(y)}年${parseInt(m)}月</td><td style="padding:8px 12px;text-align:right;color:var(--ok)">${inIn?'NT$'+inIn.toLocaleString():'—'}</td><td style="padding:8px 12px;text-align:right;color:var(--bad)">${outOut?'NT$'+outOut.toLocaleString():'—'}</td><td style="padding:8px 12px;text-align:right;color:${profit>=0?'var(--ok)':'var(--bad)'}">NT$${profit.toLocaleString()}</td><td style="padding:8px 12px;text-align:right">${inIn?rate+'%':'—'}</td></tr>`;
      }).join('');
      const tp=tIn-tOut;
      return `<table style="width:100%;border-collapse:collapse;font-size:.85rem"><thead><tr style="background:var(--g100)"><th style="padding:8px 12px;text-align:left">月份</th><th style="padding:8px 12px;text-align:right">外帳收入</th><th style="padding:8px 12px;text-align:right">內帳支出</th><th style="padding:8px 12px;text-align:right">毛利</th><th style="padding:8px 12px;text-align:right">毛利率</th></tr></thead><tbody style="border-top:2px solid var(--g200)">${rows}</tbody><tfoot><tr style="background:var(--gold-pale);font-weight:900"><td style="padding:10px 12px">合計</td><td style="padding:10px 12px;text-align:right;color:var(--ok)">NT$${tIn.toLocaleString()}</td><td style="padding:10px 12px;text-align:right;color:var(--bad)">NT$${tOut.toLocaleString()}</td><td style="padding:10px 12px;text-align:right;color:${tp>=0?'var(--ok)':'var(--bad)'}">NT$${tp.toLocaleString()}</td><td style="padding:10px 12px;text-align:right">${tIn?Math.round(tp/tIn*100)+'%':'—'}</td></tr></tfoot></table>`;
    }
  },
  profit:{
    t:'案場毛利分析',
    b:()=>{
      const all=DB.get('ledger');
      const projects=DB.get('projects');
      const byP={};
      all.forEach(r=>{const k=r.projectId?String(r.projectId):'_other';if(!byP[k])byP[k]=[];byP[k].push(r);});
      if(!Object.keys(byP).length)return '<p style="color:var(--g400)">尚無帳款資料</p>';
      const rows=Object.entries(byP).map(([key,recs])=>{
        const proj=key!=='_other'?projects.find(p=>String(p._id)===key):null;
        const income=recs.filter(r=>getLedgerBook(r)==='in'&&r.type==='in').reduce((s,r)=>s+(r.amount||0),0);
        const cost=recs.filter(r=>getLedgerBook(r)==='out'&&r.type==='out').reduce((s,r)=>s+(r.amount||0),0);
        const profit=income-cost;const rate=income>0?Math.round(profit/income*100):0;
        const name=proj?proj.name:(recs[0]?.caseN||'未指定案場');
        return {profit,html:`<tr><td style="padding:8px 12px;font-weight:700">${esc(name)}</td><td style="padding:8px 12px;text-align:right;color:var(--ok)">${income?'NT$'+income.toLocaleString():'—'}</td><td style="padding:8px 12px;text-align:right;color:var(--bad)">${cost?'NT$'+cost.toLocaleString():'—'}</td><td style="padding:8px 12px;text-align:right;color:${profit>=0?'var(--ok)':'var(--bad)'}">NT$${profit.toLocaleString()}</td><td style="padding:8px 12px;text-align:right">${income?rate+'%':'—'}</td></tr>`};
      }).sort((a,b)=>b.profit-a.profit).map(r=>r.html).join('');
      return `<table style="width:100%;border-collapse:collapse;font-size:.85rem"><thead><tr style="background:var(--g100)"><th style="padding:8px 12px;text-align:left">案場</th><th style="padding:8px 12px;text-align:right">收入</th><th style="padding:8px 12px;text-align:right">支出</th><th style="padding:8px 12px;text-align:right">毛利</th><th style="padding:8px 12px;text-align:right">毛利率</th></tr></thead><tbody>${rows}</tbody></table>`;
    }
  },
  payable:{
    t:'廠商應付帳款',
    b:()=>{
      const vendors=DB.get('vendors').filter(v=>!v.deleted&&!v.paid);
      if(!vendors.length)return '<p style="color:var(--g400)">目前沒有未付廠商款項</p>';
      const projects=DB.get('projects');
      const total=vendors.reduce((s,v)=>s+(v.amount||0),0);
      const rows=vendors.map(v=>{
        const proj=v.projectId?projects.find(p=>p._id==v.projectId):null;
        return `<tr><td style="padding:8px 12px;font-weight:700">${esc(v.vendor||'未填')}</td><td style="padding:8px 12px">${esc(v.cat||'')}</td><td style="padding:8px 12px">${proj?esc(proj.name):(v.caseN||'—')}</td><td style="padding:8px 12px;text-align:right;color:var(--bad);font-weight:700">NT$${(v.amount||0).toLocaleString()}</td><td style="padding:8px 12px;text-align:center"><button onclick="DB.upd('vendors',${v._id},{paid:true});this.closest('tr').remove();showToast('✅ 已標記付款')" style="padding:4px 10px;border:1.5px solid var(--ok-bd);border-radius:var(--rxs);background:var(--ok-bg);color:var(--ok);font-size:.75rem;cursor:pointer;font-family:inherit">標記付款</button></td></tr>`;
      }).join('');
      return `<div style="font-size:.82rem;color:var(--bad);font-weight:800;margin-bottom:12px">未付總計：NT$${total.toLocaleString()}</div><table style="width:100%;border-collapse:collapse;font-size:.85rem"><thead><tr style="background:var(--g100)"><th style="padding:8px 12px;text-align:left">廠商</th><th style="padding:8px 12px;text-align:left">類別</th><th style="padding:8px 12px;text-align:left">案場</th><th style="padding:8px 12px;text-align:right">金額</th><th style="padding:8px 12px;text-align:center">狀態</th></tr></thead><tbody>${rows}</tbody></table>`;
    }
  },
  receivable:{
    t:'客戶應收帳款',
    b:()=>{
      const ledger=DB.get('ledger').filter(l=>getLedgerBook(l)==='in'&&l.type==='in'&&!l.paid);
      if(!ledger.length)return '<p style="color:var(--g400)">目前沒有未收款項</p>';
      const projects=DB.get('projects');
      const total=ledger.reduce((s,l)=>s+(l.amount||0),0);
      const rows=ledger.map(l=>{
        const proj=l.projectId?projects.find(p=>p._id==l.projectId):null;
        return `<tr><td style="padding:8px 12px;font-weight:700">${esc(l.desc||l.cat||'未填')}</td><td style="padding:8px 12px">${proj?esc(proj.name):(l.caseN||'—')}</td><td style="padding:8px 12px">${l.date||'—'}</td><td style="padding:8px 12px;text-align:right;color:var(--ok);font-weight:700">NT$${(l.amount||0).toLocaleString()}</td><td style="padding:8px 12px;text-align:center"><button onclick="DB.upd('ledger',${l._id},{paid:true});this.closest('tr').remove();showToast('✅ 已標記收款')" style="padding:4px 10px;border:1.5px solid var(--ok-bd);border-radius:var(--rxs);background:var(--ok-bg);color:var(--ok);font-size:.75rem;cursor:pointer;font-family:inherit">標記收款</button></td></tr>`;
      }).join('');
      return `<div style="font-size:.82rem;color:var(--ok);font-weight:800;margin-bottom:12px">應收總計：NT$${total.toLocaleString()}</div><table style="width:100%;border-collapse:collapse;font-size:.85rem"><thead><tr style="background:var(--g100)"><th style="padding:8px 12px;text-align:left">說明</th><th style="padding:8px 12px;text-align:left">案場</th><th style="padding:8px 12px;text-align:left">日期</th><th style="padding:8px 12px;text-align:right">金額</th><th style="padding:8px 12px;text-align:center">狀態</th></tr></thead><tbody>${rows}</tbody></table>`;
    }
  },
};
