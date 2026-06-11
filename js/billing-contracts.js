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

// ── 帳款（內外帳）─────────────────────────────────────────
let curLedgerType='out';
function switchLedger(type){
  curLedgerType=type;
  document.querySelectorAll('.ltab[data-lt]').forEach(t=>t.classList.toggle('on',t.dataset.lt===type));
  document.querySelectorAll('[id^="lb-"]').forEach(b=>b.classList.remove('on'));
  const el=document.getElementById('lb-'+type);if(el)el.classList.add('on');
  renderLedger();
}
function openLedgerModal(type){
  curLedgerType=type||'out';
  const title=document.getElementById('ledgerModalTitle');
  if(title)title.innerHTML=(curLedgerType==='out'?'＋ 新增支出記錄（內帳）':'＋ 新增收入記錄（外帳）')+' <button class="mcl" data-close="ledgerModal">✕</button>';
  const dt=document.getElementById('ldDate');if(dt)dt.value=new Date().toISOString().split('T')[0];
  ['ldAmt','ldDesc','ldCase'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
  ldItems=[];ldImgUrl=null;
  const fc=document.getElementById('ldFileCard');if(fc)fc.style.display='none';
  const tb=document.getElementById('ldItemsTable');if(tb)tb.innerHTML='';
  const op=document.getElementById('ldOcr');if(op)op.classList.remove('show');
  // 更新分類選單
  const cat=document.getElementById('ldCat');
  if(cat){
    if(curLedgerType==='in'){
      cat.innerHTML=getSettingTags('incomeCat').map(o=>'<option>'+o+'</option>').join('');
    }else{
      cat.innerHTML=getSettingTags('expenseCat').map(o=>'<option>'+o+'</option>').join('');
    }
  }
  openModal('ledgerModal');
}
function updLedgerStats(){
  const all=DB.get('ledger');
  const inSum=all.filter(r=>r.type==='in').reduce((s,r)=>s+(r.amount||0),0);
  const outSum=all.filter(r=>r.type==='out').reduce((s,r)=>s+(r.amount||0),0);
  const profit=inSum-outSum;
  const set=(id,v)=>{const el=document.getElementById(id);if(el)el.textContent=v;};
  set('ledInSum',inSum?fmt(inSum):'NT$0');
  set('ledOutSum',outSum?fmt(outSum):'NT$0');
  const pfEl=document.getElementById('ledProfit');
  if(pfEl){pfEl.textContent=fmt(Math.abs(profit))+(profit>=0?' ▲':' ▼');pfEl.style.color=profit>=0?'var(--ok)':'var(--bad)';}
}
function renderLedger(){
  const all=DB.get('ledger');
  const CAT_COLORS={
    '材料費':'background:#FEF9C3;color:#92400E','工資':'background:#D1FAE5;color:#065F46',
    '廠商費用':'background:#DBEAFE;color:#1E40AF','管理費':'background:#EDE9FE;color:#5B21B6',
    '合約收款':'background:#D1FAE5;color:#065F46','訂金':'background:#FEF9C3;color:#92400E',
    '工程款':'background:#D1FAE5;color:#065F46','設計費':'background:#FCE7F3;color:#9D174D',
  };
  function renderList(containerId,items){
    const c=document.getElementById(containerId);if(!c)return;
    if(!items.length){
      c.innerHTML='<div class="empty-state"><div class="es-ic">📋</div><div class="es-t">尚無記錄</div></div>';return;
    }
    c.innerHTML='';
    const sum=items.reduce((s,r)=>s+(r.amount||0),0);
    items.forEach(r=>{
      const row=document.createElement('div');row.className='ledger-row';
      const catStyle=CAT_COLORS[r.cat]||'background:var(--g100);color:var(--g600)';
      const dateStr=r.date||r._ts?.split(' ')[0]||'—';
      row.innerHTML=
        '<div class="lr-date">'+dateStr+'</div>'+
        '<div class="lr-desc">'+(r.desc||'—')+(r.caseN?' <span style="font-size:.72rem;color:var(--g400)">📍'+r.caseN+'</span>':'')+'</div>'+
        '<span class="lr-cat" style="'+catStyle+'">'+( r.cat||'')+'</span>'+
        '<div class="lr-amt '+(r.type==='in'?'in':'out')+'">'+(r.type==='in'?'+':'-')+fmt(r.amount||0)+'</div>'+
        '<button style="width:28px;height:28px;background:var(--bad-bg);border:1.5px solid var(--bad-bd);color:var(--bad);border-radius:var(--rxs);cursor:pointer;font-size:.72rem;flex-shrink:0" onclick="delLedger('+r._id+')">🗑</button>';
      c.appendChild(row);
    });
    const sumDiv=document.createElement('div');sumDiv.className='ledger-sum';
    sumDiv.innerHTML='<span class="ls-label">小計</span><span class="ls-val" style="color:'+(items[0]?.type==='in'?'var(--ok)':'var(--bad)')+'">'+fmt(sum)+'</span>';
    c.appendChild(sumDiv);
  }
  const out=all.filter(r=>r.type==='out').sort((a,b)=>b._id-a._id);
  const inp=all.filter(r=>r.type==='in').sort((a,b)=>b._id-a._id);
  const allSorted=all.sort((a,b)=>b._id-a._id);
  renderList('ledger-out-list',out);
  renderList('ledger-in-list',inp);
  renderList('ledger-all-list',allSorted);
  updLedgerStats();
}
function delLedger(id){
  if(!confirm('確定刪除此記錄？'))return;
  DB.softDel('ledger',id);renderLedger();updLedgerStats();showToast('✅ 已移至垃圾桶');
}

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
  ov.addEventListener('click',e=>{if(e.target===ov)ov.remove();});
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
        sections:JSON.parse(JSON.stringify(adSections)),total:sub});
      renderHistory();updStats();renderQTable();
      showToast('✅ 報價單已儲存！');
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