function renderProgItems(){
  const c=document.getElementById('progItemsTable');if(!c)return;c.innerHTML='';
  progItems.forEach((it,i)=>{
    const row=document.createElement('div');row.style.cssText='display:flex;align-items:center;gap:8px;padding:7px 0;border-bottom:1px solid var(--g100)';
    const chk=document.createElement('input');chk.type='checkbox';chk.checked=it.done;chk.style.cssText='width:18px;height:18px;accent-color:var(--ok);flex-shrink:0;cursor:pointer';
    chk.addEventListener('change',()=>it.done=chk.checked);
    const txt=document.createElement('input');txt.style.cssText='flex:1;padding:7px 10px;border:1.5px solid var(--g200);border-radius:var(--rxs);font-size:.85rem;font-family:inherit;outline:none';
    txt.placeholder='進度項目名稱';txt.value=it.text||'';txt.addEventListener('input',()=>it.text=txt.value);
    txt.addEventListener('focus',()=>txt.style.borderColor='var(--gold)');txt.addEventListener('blur',()=>txt.style.borderColor='var(--g200)');
    const dt=document.createElement('input');dt.type='date';dt.style.cssText='width:130px;padding:7px 10px;border:1.5px solid var(--g200);border-radius:var(--rxs);font-size:.82rem;font-family:inherit;outline:none';
    dt.value=it.date||'';dt.addEventListener('change',()=>it.date=dt.value);
    const del=document.createElement('button');del.style.cssText='width:28px;height:28px;background:var(--bad-bg);border:1.5px solid var(--bad-bd);color:var(--bad);border-radius:var(--rxs);cursor:pointer;font-size:.78rem;display:flex;align-items:center;justify-content:center;flex-shrink:0';
    del.textContent='🗑';del.addEventListener('click',()=>{progItems.splice(i,1);renderProgItems();});
    row.appendChild(chk);row.appendChild(txt);row.appendChild(dt);row.appendChild(del);c.appendChild(row);
  });
}

document.getElementById('saveProgressBtn')?.addEventListener('click',()=>{
  const caseN=document.getElementById('progCase').value.trim();
  const client=document.getElementById('progClient').value.trim();
  const status=document.getElementById('progStatus').value;
  if(!caseN){showToast('⚠️ 請填入案場名稱');return;}
  if(progEditId){
    DB.upd('progress',progEditId,{caseN,client,status,items:progItems.map(x=>({...x})),summary:'進度 '+caseN});
    showToast('✅ 進度已更新！');
  }else{
    DB.push('progress',{summary:'進度 '+caseN,caseN,client,status,items:progItems.map(x=>({...x}))});
    showToast('✅ 案場進度已建立！');
  }
  closeModal('progressModal');renderProgress();progEditId=null;
});

function renderProgress(){
  const list=document.getElementById('progressList');if(!list)return;
  let data=DB.get('progress');
  const kw=(document.getElementById('progSearch')?.value||'').toLowerCase();
  const sf=document.getElementById('progStatusFilter')?.value||'all';
  if(kw)data=data.filter(p=>(p.caseN||'').toLowerCase().includes(kw)||(p.client||'').toLowerCase().includes(kw));
  if(sf!=='all')data=data.filter(p=>p.status===sf);
  if(!data.length){list.innerHTML='<div class="empty-state"><div class="es-ic">🔧</div><div class="es-t">尚無進度記錄</div><div class="es-s">新增合約時會自動建立，或點右上方「新增案場」</div></div>';return;}
  list.innerHTML='';
  const tagMap={pending:{l:'📋 未開始',cls:'start'},ing:{l:'🔨 進行中',cls:'ing'},done:{l:'✅ 結案',cls:'done'}};
  data.forEach(p=>{
    const card=document.createElement('div');card.className='progress-card';
    const tag=tagMap[p.status]||tagMap.pending;
    const done=(p.items||[]).filter(x=>x.done).length;
    const total=(p.items||[]).length;
    const pct=total?Math.round(done/total*100):0;
    card.innerHTML=
      '<div class="pc-hd">'+
        '<div style="flex:1">'+
          '<div style="font-size:.95rem;font-weight:900">'+p.caseN+'</div>'+
          (p.client?'<div style="font-size:.78rem;color:var(--g400);margin-top:2px">👤 '+p.client+'</div>':'')+
        '</div>'+
        '<span class="pc-tag '+tag.cls+'">'+tag.l+'</span>'+
        '<div style="font-size:.8rem;font-family:\'DM Mono\',monospace;font-weight:800;color:var(--g400);margin-left:8px">'+done+'/'+total+'</div>'+
        '<div style="display:flex;gap:5px;margin-left:8px">'+
          '<button class="btn bo bxs" data-pedit="'+p._id+'">✏️ 編輯</button>'+
          '<button class="btn brd bxs" data-pdel="'+p._id+'">🗑</button>'+
        '</div>'+
      '</div>'+
      '<div class="pc-body">'+
        // 進度條
        '<div style="background:var(--g200);border-radius:4px;height:6px;margin-bottom:12px;overflow:hidden">'+
          '<div style="background:linear-gradient(90deg,var(--gold-d),var(--gold));height:100%;width:'+pct+'%;border-radius:4px;transition:width .4s ease"></div>'+
        '</div>'+
        (p.items||[]).map(it=>
          '<div class="prog-item">'+
            '<div class="prog-dot '+(it.done?'done':it.date?'ing':'todo')+'"></div>'+
            '<div style="flex:1;font-size:.85rem;font-weight:'+(it.done?'700':'500')+';color:'+(it.done?'var(--ok)':'var(--g700)')+'">'+it.text+'</div>'+
            (it.date?'<div style="font-size:.72rem;color:var(--g400);font-family:\'DM Mono\',monospace">'+it.date+'</div>':'')+
          '</div>'
        ).join('')+
      '</div>';
    card.querySelector('[data-pedit]')?.addEventListener('click',()=>{
      progEditId=p._id;progItems=p.items?p.items.map(x=>({...x})):[];
      document.getElementById('progCase').value=p.caseN||'';
      document.getElementById('progClient').value=p.client||'';
      document.getElementById('progStatus').value=p.status||'pending';
      document.getElementById('progModalTitle').innerHTML='編輯進度：'+p.caseN+' <button class="mcl" data-close="progressModal">✕</button>';
      renderProgItems();openModal('progressModal');
    });
    card.querySelector('[data-pdel]')?.addEventListener('click',()=>{if(!confirm('確定刪除「'+p.caseN+'」進度？'))return;DB.del('progress',p._id);renderProgress();showToast('✅ 已刪除。');});
    list.appendChild(card);
  });
}

// ══ 員工管理 ══════════════════════════════════════════════
let empEditId=null;

// 勞健保自動計算
function calcSalaryInsurance(){
  const salary=parseFloat(document.getElementById('empSalary')?.value)||0;
  const meal=parseFloat(document.getElementById('empMeal')?.value)||0;
  const transport=parseFloat(document.getElementById('empTransport')?.value)||0;
  const other=parseFloat(document.getElementById('empOther')?.value)||0;
  const gross=salary+meal+transport+other;
  // 勞保：級距約 salary*0.105，員工負擔 20%
  const labor=Math.round(salary*0.105*0.2);
  // 健保：(salary+meal)*0.0517*0.3（員工負擔30%）
  const health=Math.round((salary+meal)*0.0517*0.3);
  // 勞退：雇主提撥6%（員工不扣，由公司付）
  const retire=Math.round(salary*0.06);
  const net=gross-labor-health;
  const set=(id,v)=>{const el=document.getElementById(id);if(el)el.textContent='NT$'+v.toLocaleString();};
  set('empLabor',labor);set('empHealth',health);set('empRetire',retire);set('empNet',net);
}
['empSalary','empMeal','empTransport','empOther'].forEach(id=>{
  document.getElementById(id)?.addEventListener('input',calcSalaryInsurance);
});

document.getElementById('addEmpBtn')?.addEventListener('click',()=>{
  empEditId=null;
  ['empName','empTitle','empPhone','empId','empBank','empAccount','empPassword'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
  document.getElementById('empSalary').value='32000';
  document.getElementById('empMeal').value='2400';
  document.getElementById('empTransport').value='0';
  document.getElementById('empOther').value='0';
  document.getElementById('empStartDate').value=new Date().toISOString().split('T')[0];
  document.getElementById('empModalTitle').innerHTML='新增員工 <button class="mcl" data-close="empModal">✕</button>';
  calcSalaryInsurance();openModal('empModal');
});

document.getElementById('saveEmpBtn')?.addEventListener('click',()=>{
  const name=document.getElementById('empName').value.trim();
  if(!name){showToast('⚠️ 請填入員工姓名');return;}
  const salary=parseFloat(document.getElementById('empSalary').value)||0;
  const meal=parseFloat(document.getElementById('empMeal').value)||0;
  const transport=parseFloat(document.getElementById('empTransport').value)||0;
  const other=parseFloat(document.getElementById('empOther').value)||0;
  const labor=Math.round(salary*0.105*0.2);
  const health=Math.round((salary+meal)*0.0517*0.3);
  const retire=Math.round(salary*0.06);
  const net=salary+meal+transport+other-labor-health;
  const account=(document.getElementById('empAccount')?.value||'').trim();
  const password=(document.getElementById('empPassword')?.value||'').trim();
  // 帳號重複檢查（排除自己）
  if(account){
    const dup=DB.get('employees').find(e=>e.account===account&&e._id!==empEditId);
    if(dup){showToast('⚠️ 此打卡帳號已被「'+dup.name+'」使用，請換一個');return;}
    if(!password){showToast('⚠️ 設定了帳號就需要設定密碼');return;}
  }
  const data={name,title:document.getElementById('empTitle').value.trim(),phone:document.getElementById('empPhone').value.trim(),idNum:document.getElementById('empId').value.trim(),bank:document.getElementById('empBank').value.trim(),startDate:document.getElementById('empStartDate').value,salary,meal,transport,other,labor,health,retire,net,account,password,summary:'員工 '+name};
  if(empEditId){DB.upd('employees',empEditId,data);showToast('✅ 員工資料已更新！'+(account?'（打卡帳號：'+account+'）':''));}
  else{DB.push('employees',data);showToast('✅ 員工已新增！'+(account?'（打卡帳號：'+account+'）':''));}
  closeModal('empModal');renderEmployees();updHRStats();empEditId=null;
});

function updHRStats(){
  const emps=DB.get('employees');
  const total=emps.reduce((s,e)=>s+(e.net||0),0);
  const today=new Date().toLocaleDateString('zh-TW');
  const punched=new Set(DB.get('punch_recs').filter(r=>r.date===today).map(r=>r.user)).size;
  const set=(id,v)=>{const el=document.getElementById(id);if(el)el.textContent=v;};
  set('hrEmpCnt',emps.length);
  set('hrTotalSalary',total?'NT$'+total.toLocaleString():'—');
  set('hrPunchToday',punched);
}

function renderEmployees(){
  const list=document.getElementById('empList');if(!list)return;
  const emps=DB.get('employees');
  if(!emps.length){list.innerHTML='<div class="empty-state"><div class="es-ic">👤</div><div class="es-t">尚無員工資料</div><div class="es-s">點右上方「新增員工」</div></div>';return;}
  list.innerHTML='';
  emps.forEach(e=>{
    const card=document.createElement('div');card.className='emp-card';
    card.innerHTML=
      '<div style="display:flex;align-items:center;gap:12px;margin-bottom:14px">'+
        '<div class="emp-avatar">'+e.name.charAt(0)+'</div>'+
        '<div style="flex:1"><div style="font-size:.95rem;font-weight:900">'+e.name+'</div><div style="font-size:.78rem;color:var(--g400);margin-top:2px">'+( e.title||'員工')+' ｜ 到職：'+e.startDate+'</div></div>'+
        '<div style="display:flex;gap:5px">'+
          '<button class="btn bo bxs" data-eedit="'+e._id+'">✏️ 編輯</button>'+
          '<button class="btn brd bxs" data-edel="'+e._id+'">🗑</button>'+
        '</div>'+
      '</div>'+
      '<div style="background:var(--g50);border-radius:var(--rs);padding:12px 14px">'+
        '<div class="salary-row"><span class="sl-label">底薪</span><span class="sl-val">NT$'+( e.salary||0).toLocaleString()+'</span></div>'+
        '<div class="salary-row"><span class="sl-label">伙食+交通+其他</span><span class="sl-val">NT$'+( (e.meal||0)+(e.transport||0)+(e.other||0)).toLocaleString()+'</span></div>'+
        '<div class="salary-row"><span class="sl-label">勞保（員工負擔）</span><span class="sl-val" style="color:var(--bad)">-NT$'+( e.labor||0).toLocaleString()+'</span></div>'+
        '<div class="salary-row"><span class="sl-label">健保（員工負擔）</span><span class="sl-val" style="color:var(--bad)">-NT$'+( e.health||0).toLocaleString()+'</span></div>'+
        '<div class="salary-row"><span class="sl-label">勞退（公司提撥）</span><span class="sl-val" style="color:var(--info)">NT$'+( e.retire||0).toLocaleString()+'</span></div>'+
        '<div class="salary-row"><span class="sl-label" style="font-weight:800">本月實領</span><span class="sl-val total">NT$'+( e.net||0).toLocaleString()+'</span></div>'+
      '</div>'+
      (e.bank?'<div style="font-size:.75rem;color:var(--g400);margin-top:8px">🏦 匯款帳號：'+e.bank+'</div>':'')+
      (e.account?'<div style="font-size:.75rem;color:var(--gold-d);margin-top:4px;font-weight:700">🔑 打卡帳號：'+esc(e.account)+'</div>':'');
    card.querySelector('[data-eedit]')?.addEventListener('click',()=>{
      empEditId=e._id;
      document.getElementById('empName').value=e.name||'';document.getElementById('empTitle').value=e.title||'';
      document.getElementById('empPhone').value=e.phone||'';document.getElementById('empId').value=e.idNum||'';
      document.getElementById('empBank').value=e.bank||'';document.getElementById('empStartDate').value=e.startDate||'';
      document.getElementById('empSalary').value=e.salary||32000;document.getElementById('empMeal').value=e.meal||2400;
      document.getElementById('empTransport').value=e.transport||0;document.getElementById('empOther').value=e.other||0;
      const accEl=document.getElementById('empAccount');if(accEl)accEl.value=e.account||'';
      const pwEl=document.getElementById('empPassword');if(pwEl)pwEl.value=e.password||'';
      document.getElementById('empModalTitle').innerHTML='編輯員工：'+e.name+' <button class="mcl" data-close="empModal">✕</button>';
      calcSalaryInsurance();openModal('empModal');
    });
    card.querySelector('[data-edel]')?.addEventListener('click',()=>{confirmAction('刪除員工「'+e.name+'」？歷史打卡和薪資記錄仍會保留。',()=>{DB.upd('employees',e._id,{deleted:true,deletedAt:new Date().toLocaleString('zh-TW')});renderEmployees();updHRStats();showToast('✅ 員工已移除，歷史記錄保留');});});
    list.appendChild(card);
  });
}

// renderSalaryList removed (duplicate)


// ══ GROUPS 加員工管理到人資 ══
// 更新 setupApp 加入 progress 初始化
// setupApp 覆寫 v2 - 移到下方統一版本

// ══ 每月薪資管理 ══════════════════════════════════════════
function getPayDate(){return parseInt(localStorage.getItem('zeju_pay_date'))||5;}

function renderSalaryList(){
  const list=document.getElementById('salaryList');if(!list)return;
  const emps=DB.get('employees');
  const payDate=getPayDate();
  const now=new Date();

  // ── 自動建立未來兩個月記錄（每月1號觸發）──
  if(now.getDate()===1){
    const autoMonths=[
      fmtMonth(now.getFullYear(),now.getMonth()+1),
      fmtMonth(now.getFullYear(),now.getMonth()+2),
    ];
    let months=JSON.parse(localStorage.getItem('zeju_salary_months')||'[]');
    autoMonths.forEach(m=>{if(!months.includes(m))months.push(m);});
    localStorage.setItem('zeju_salary_months',JSON.stringify(months));
  }

  if(!emps.length){
    list.innerHTML='<div class="empty-state"><div class="es-ic">💰</div><div class="es-t">尚無員工資料</div><div class="es-s">請先至「員工資料」新增員工</div></div>';
    return;
  }

  // ── 建立6個月 + 額外月份 ──
  const recentMonths=[];
  for(let i=0;i<6;i++){
    const d=new Date(now.getFullYear(),now.getMonth()-i,1);
    recentMonths.push(fmtMonth(d.getFullYear(),d.getMonth()));
  }
  // 也加未來2個月
  for(let i=1;i<=2;i++){
    const d=new Date(now.getFullYear(),now.getMonth()+i,1);
    recentMonths.unshift(fmtMonth(d.getFullYear(),d.getMonth()));
  }

  const allStoredMonths=JSON.parse(localStorage.getItem('zeju_salary_months')||'[]');
  const extraMonths=allStoredMonths.filter(m=>!recentMonths.includes(m)).sort().reverse();

  const curMonthKey=localStorage.getItem('zeju_salary_cur_month')||fmtMonth(now.getFullYear(),now.getMonth());

  list.innerHTML='';

  // 發薪日設定
  const settingDiv=document.createElement('div');
  settingDiv.style.cssText='background:var(--gold-pale);border:1.5px solid var(--gold-l);border-radius:var(--rs);padding:12px 16px;margin-bottom:14px;display:flex;align-items:center;gap:12px;flex-wrap:wrap';
  settingDiv.innerHTML=`
    <span style="font-size:.88rem;font-weight:800;color:var(--gold-d)">⚙️ 每月發薪日</span>
    <select id="payDateSel" style="padding:7px 12px;border:1.5px solid var(--gold-l);border-radius:var(--rxs);font-size:.88rem;font-family:inherit;outline:none;background:var(--w)" onchange="savePayDate(this.value)">
      ${Array.from({length:28},(_,i)=>`<option value="${i+1}" ${i+1===payDate?'selected':''}>每月 ${i+1} 日</option>`).join('')}
    </select>
    <span style="font-size:.78rem;color:var(--g400)">下次發薪：${now.getMonth()+1}月${payDate}日</span>`;
  list.appendChild(settingDiv);

  // 月份選擇區：最近6個月 + 未來2個月（顯示為Tab列）
  const tabDiv=document.createElement('div');
  tabDiv.style.cssText='display:flex;gap:5px;flex-wrap:wrap;margin-bottom:12px;align-items:center';

  recentMonths.forEach(m=>{
    const b=document.createElement('button');
    b.className='btn '+(m===curMonthKey?'bg':'bo')+' bsm';
    b.style.padding='6px 12px';b.style.fontSize='.78rem';
    b.textContent=m.replace('-','年')+'月'+(m===fmtMonth(now.getFullYear(),now.getMonth())?' (本月)':m>fmtMonth(now.getFullYear(),now.getMonth())?' ▶':'');
    b.addEventListener('click',()=>{localStorage.setItem('zeju_salary_cur_month',m);renderSalaryList();});
    tabDiv.appendChild(b);
  });

  // 「其他月份」下拉
  if(extraMonths.length){
    const sep=document.createElement('span');sep.style.cssText='font-size:.75rem;color:var(--g400);margin:0 4px';sep.textContent='｜';tabDiv.appendChild(sep);
    const sel=document.createElement('select');
    sel.style.cssText='padding:6px 10px;border:1.5px solid var(--g200);border-radius:var(--rxs);font-size:.78rem;font-family:inherit;outline:none;background:var(--w)';
    sel.innerHTML='<option value="">📅 其他月份…</option>'+extraMonths.map(m=>`<option value="${m}" ${m===curMonthKey?'selected':''}>${m.replace('-','年')}月</option>`).join('');
    sel.addEventListener('change',()=>{if(sel.value){localStorage.setItem('zeju_salary_cur_month',sel.value);renderSalaryList();}});
    tabDiv.appendChild(sel);
  }
  list.appendChild(tabDiv);

  // 月份薪資表
  const tableDiv=document.createElement('div');tableDiv.id='monthSalaryTable';list.appendChild(tableDiv);
  renderMonthSalary(curMonthKey);
}

function fmtMonth(year,month){
  // month 是 0-based
  const m=(month%12+12)%12;
  const y=year+Math.floor(month/12);
  return y+'-'+(m+1).toString().padStart(2,'0');
}


function savePayDate(v){localStorage.setItem('zeju_pay_date',v);showToast('✅ 發薪日已設定為每月 '+v+' 日');}

function renderMonthSalary(monthKey){
  const wrap=document.getElementById('monthSalaryTable');if(!wrap)return;
  const emps=DB.get('employees');
  const payKey='pay_'+monthKey;
  const payRecords=JSON.parse(localStorage.getItem(payKey)||'{}');
  wrap.innerHTML='';

  // 標題
  const title=document.createElement('div');
  title.style.cssText='font-size:.9rem;font-weight:900;color:var(--g700);margin-bottom:12px;padding:10px 0;border-bottom:2px solid var(--g200)';
  title.textContent=monthKey.replace('-','年')+'月 薪資表';
  wrap.appendChild(title);

  // 每個員工
  let totalNet=0,totalAll=0;
  emps.forEach(e=>{
    const paid=payRecords[e._id]||false;
    // 從打卡記錄計算出勤
    const empPunchId=e._id?('emp_'+e._id):null;
    const monthRecs=DB.get('punch_recs').filter(r=>(r.user===empPunchId||r.userName===e.name)&&(r.date||'').startsWith(monthKey));
    const workDays=new Set(monthRecs.filter(r=>r.type==='in').map(r=>r.date)).size;
    const net=e.net||0;const gross=((e.salary||0)+(e.meal||0)+(e.transport||0)+(e.other||0));
    const compCost=gross+(e.retire||0)+(Math.round((e.salary||0)*0.105*0.8))+(Math.round(((e.salary||0)+(e.meal||0))*0.0517*0.7));
    totalNet+=net;totalAll+=compCost;
    const card=document.createElement('div');
    card.style.cssText='background:var(--w);border:1.5px solid '+(paid?'var(--ok-bd)':'var(--g200)')+';border-radius:var(--rs);padding:14px 16px;margin-bottom:8px;transition:all var(--ease)';
    card.innerHTML=`
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
        <div class="emp-avatar" style="width:38px;height:38px;font-size:.9rem">${e.name.charAt(0)}</div>
        <div style="flex:1">
          <div style="font-size:.9rem;font-weight:900">${e.name}</div>
          <div style="font-size:.75rem;color:var(--g400)">${e.title||'員工'} ${workDays?'· 出勤 '+workDays+' 天':''}</div>
        </div>
        <div style="text-align:right;margin-right:10px">
          <div style="font-size:.75rem;color:var(--g400)">實領薪資</div>
          <div style="font-family:'DM Mono',monospace;font-weight:900;font-size:1rem;color:var(--gold-d)">NT$${net.toLocaleString()}</div>
        </div>
        <button onclick="togglePayStatus('${e._id}','${monthKey}')" 
          style="padding:8px 16px;border-radius:var(--rs);font-size:.82rem;font-weight:800;cursor:pointer;border:none;font-family:inherit;
          background:${paid?'var(--ok-bg)':'var(--gold)'};color:${paid?'var(--ok)':'#fff'};
          border:1.5px solid ${paid?'var(--ok-bd)':'var(--gold-d)'}">
          ${paid?'✅ 已匯款':'💳 標記匯款'}
        </button>
      </div>
      <div style="background:var(--g50);border-radius:var(--rxs);padding:10px 12px;font-size:.82rem">
        <div style="display:flex;justify-content:space-between;margin-bottom:4px"><span style="color:var(--g500)">底薪</span><span style="font-family:'DM Mono',monospace">NT$${(e.salary||0).toLocaleString()}</span></div>
        <div style="display:flex;justify-content:space-between;margin-bottom:4px"><span style="color:var(--g500)">津貼合計</span><span style="font-family:'DM Mono',monospace">NT$${((e.meal||0)+(e.transport||0)+(e.other||0)).toLocaleString()}</span></div>
        <div style="display:flex;justify-content:space-between;margin-bottom:4px"><span style="color:var(--bad)">勞保（員工）</span><span style="font-family:'DM Mono',monospace;color:var(--bad)">-NT$${(e.labor||0).toLocaleString()}</span></div>
        <div style="display:flex;justify-content:space-between;margin-bottom:4px"><span style="color:var(--bad)">健保（員工）</span><span style="font-family:'DM Mono',monospace;color:var(--bad)">-NT$${(e.health||0).toLocaleString()}</span></div>
        <div style="display:flex;justify-content:space-between;padding-top:6px;border-top:1px solid var(--g200)"><span style="font-weight:800">銀行帳號</span><span style="font-family:'DM Mono',monospace;color:var(--g500)">${e.bank||'尚未設定'}</span></div>
      </div>
    `;
    wrap.appendChild(card);
  });

  // 合計
  const tot=document.createElement('div');
  tot.style.cssText='background:linear-gradient(135deg,var(--gold-pale),#FFF0C0);border:1.5px solid var(--gold-l);border-radius:var(--rs);padding:14px 18px;margin-top:8px;display:flex;justify-content:space-between;align-items:center';
  tot.innerHTML=`<div><div style="font-size:.85rem;font-weight:800;color:var(--gold-d)">本月薪資合計</div><div style="font-size:.75rem;color:var(--g400)">含勞退等公司總負擔：NT$${totalAll.toLocaleString()}</div></div><div style="font-family:'DM Mono',monospace;font-size:1.3rem;font-weight:900;color:var(--gold-d)">NT$${totalNet.toLocaleString()}</div>`;
  wrap.appendChild(tot);

  // 列印按鈕
  const printBtn=document.createElement('button');
  printBtn.className='btn bo bsm';printBtn.style.cssText='width:100%;margin-top:10px';
  printBtn.textContent='🖨 列印薪資表';
  printBtn.addEventListener('click',()=>window.print());
  wrap.appendChild(printBtn);
}

function togglePayStatus(empId,monthKey){
  const payKey='pay_'+monthKey;
  const rec=JSON.parse(localStorage.getItem(payKey)||'{}');
  rec[empId]=!rec[empId];
  localStorage.setItem(payKey,JSON.stringify(rec));
  renderMonthSalary(monthKey);
  showToast(rec[empId]?'✅ 已標記匯款！':'已取消匯款標記');
}

// ══ setupApp 統一覆寫（打卡/一般/老闆）════════════════════
// setupApp merged above
;

// ══ 澤居自有工程快速新增 ══════════════════════════════════
const ZEJU_DEFAULT_ITEMS = {
  '拆除工程': [{name:'現場拆除',unit:'式',qty:1,price:0},{name:'廢棄物清運',unit:'車',qty:1,price:0}],
  '泥作工程': [{name:'磁磚鋪貼',unit:'坪',qty:0,price:0},{name:'防水工程',unit:'式',qty:1,price:0}],
  '木作工程': [{name:'天花板造型',unit:'式',qty:1,price:0},{name:'木作隔間',unit:'式',qty:1,price:0}],
  '水電工程': [{name:'電路配置',unit:'式',qty:1,price:0},{name:'給排水',unit:'式',qty:1,price:0}],
  '系統傢俱': [{name:'系統衣櫃',unit:'尺',qty:0,price:0},{name:'系統廚具',unit:'式',qty:1,price:0}],
  '油漆工程': [{name:'全室油漆',unit:'坪',qty:0,price:0},{name:'批土整平',unit:'式',qty:1,price:0}],
  '衛浴工程': [{name:'衛浴設備更換',unit:'式',qty:1,price:0},{name:'浴室磁磚',unit:'式',qty:1,price:0}],
  '燈具工程': [{name:'燈具安裝',unit:'式',qty:1,price:0},{name:'線路配置',unit:'式',qty:1,price:0}],
  '其他工程': [{name:'工程項目',unit:'式',qty:1,price:0}],
};

function addZejuSection(icon, name){
  const defaults = ZEJU_DEFAULT_ITEMS[name] || [{name:'工程項目',unit:'式',qty:1,price:0}];
  adSections.push({
    id:'s'+Date.now(),
    icon, name,
    items: defaults.map(it=>({...it}))
  });
  renderProQuote('adSections', adSections, {allowDelSec:true, totIds:{sub:'adSub',mgmt:'adMgmt',total:'adTotal'}});
  // 滾動到最新加入的分類
  setTimeout(()=>{
    const c=document.getElementById('adSections');
    if(c)c.lastElementChild?.scrollIntoView({behavior:'smooth',block:'nearest'});
  },100);
  showToast('✅ 已加入「'+name+'」，請展開填入細項與單價');
}

function addCustomZejuSection(){
  const inp = document.getElementById('customSecName');
  const name = inp?.value.trim();
  if(!name){showToast('⚠️ 請輸入分類名稱');return;}
  addZejuSection('🔧', name);
  if(inp) inp.value = '';
}

// ══ 快速生圖（一鍵選風格生成）═══════════════════════════
function quickGenImg(style){
  // 選中對應風格
  document.querySelectorAll('.img-style-btn').forEach(b=>{
    b.classList.toggle('on', b.dataset.style===style);
  });
  curImgStyle=style;
  // 如果有貼文就直接生成，沒有先提示
  const postText=document.getElementById('pstBd')?.textContent?.trim()||'';
  if(!postText){
    showToast('⚠️ 請先生成貼文，再生成圖片');
    document.getElementById('imgGenCard').style.display='block';
    return;
  }
  document.getElementById('imgGenCard').style.display='block';
  genMktImg();
}

// ══ 雙價報價單模式 ════════════════════════════════════════

function setQuoteMode(mode){
  curQuoteMode = mode;
  document.getElementById('modeInternal')?.classList.toggle('on', mode==='internal');
  document.getElementById('modeClient')?.classList.toggle('on', mode==='client');
  // 重繪報價單
  renderProQuote('adSections', adSections, {allowDelSec:true, totIds:{sub:'adSub',mgmt:'adMgmt',total:'adTotal'}});
  updProfitBar();
}

function updProfitBar(){
  const costTotal=adSections.reduce((s,sec)=>s+sec.items.reduce((ss,it)=>ss+(parseFloat(it.cost)||0)*(parseFloat(it.qty)||0),0),0);
  const sellTotal=adSections.reduce((s,sec)=>s+sec.items.reduce((ss,it)=>ss+(parseFloat(it.price)||0)*(parseFloat(it.qty)||0),0),0);
  const gross=sellTotal-costTotal;
  const rate=sellTotal>0?((gross/sellTotal)*100).toFixed(1):0;
  const set=(id,v)=>{const el=document.getElementById(id);if(el)el.textContent=v;};
  set('adCostTotal',fmt(costTotal));
  set('adSellTotal',fmt(sellTotal));
  set('adGrossProfit',(gross>=0?'▲ ':'▼ ')+fmt(Math.abs(gross)));
  const profEl=document.getElementById('adGrossProfit');
  if(profEl)profEl.style.color=gross>=0?'var(--ok)':'var(--bad)';
  const rateEl=document.getElementById('adProfitRate');
  if(rateEl){
    rateEl.textContent=rate+'%';
    rateEl.style.color=rate>=30?'var(--ok)':rate>=20?'var(--warn)':'var(--bad)';
    rateEl.className='profit-value rate';
  }
}

// 覆寫 refreshGlobalTotals 加入毛利更新


// ══ 資料備份 ══════════════════════════════════════════════




// ══ 多客戶管理 ════════════════════════════════════════════







// ══ 出缺勤統計 ════════════════════════════════════════════
function renderAttendance(){
  const list=document.getElementById('attendList');if(!list)return;
  const emps=DB.get('employees');
  const allRecs=DB.get('punch_recs');
  if(!emps.length){list.innerHTML='<div class="empty-state"><div class="es-ic">📊</div><div class="es-t">尚無員工資料</div></div>';return;}

  const now=new Date();
  const monthKey=now.getFullYear()+'-'+(now.getMonth()+1).toString().padStart(2,'0');
  const workDays=getWorkDaysInMonth(now.getFullYear(),now.getMonth());

  list.innerHTML='<div style="font-size:.8rem;font-weight:800;color:var(--g400);margin-bottom:12px;padding:8px 12px;background:var(--info-bg);border-radius:var(--rxs)">📅 '+monthKey+'月份出缺勤統計 · 本月工作天 '+workDays+' 天</div>';

  emps.concat([{_id:'punch',name:'公務帳號',title:'打卡'}]).forEach(emp=>{
    // 找這個帳號的打卡記錄
    const roleId=emp._id==='punch'?'punch':'staff';
    const myRecs=allRecs.filter(r=>{
      if(!r.date)return false;
      const [y,m]=r.date.includes('/')
        ?r.date.split('/').map(Number)
        :r.date.split('-').map(Number);
      return (y===now.getFullYear()||(y>2000&&r.date.includes(now.getFullYear().toString())))&&r.user===roleId;
    });

    // 統計
    const inDays=new Set(myRecs.filter(r=>r.type==='in').map(r=>r.date)).size;
    const outDays=new Set(myRecs.filter(r=>r.type==='out').map(r=>r.date)).size;
    const absentDays=Math.max(0,workDays-inDays);
    const pct=workDays>0?Math.round(inDays/workDays*100):0;

    const card=document.createElement('div');
    card.style.cssText='background:var(--w);border:1px solid var(--g200);border-radius:var(--r);padding:16px 20px;margin-bottom:10px;box-shadow:var(--sh1)';
    card.innerHTML=
      '<div style="display:flex;align-items:center;gap:12px;margin-bottom:12px">'+
        '<div class="emp-avatar" style="width:40px;height:40px;font-size:.9rem">'+emp.name.charAt(0)+'</div>'+
        '<div style="flex:1"><div style="font-size:.9rem;font-weight:900">'+emp.name+'</div><div style="font-size:.75rem;color:var(--g400)">'+(emp.title||'員工')+'</div></div>'+
        '<div style="font-family:monospace;font-size:1.1rem;font-weight:900;color:'+(pct>=80?'var(--ok)':pct>=60?'var(--warn)':'var(--bad)')+'">'+pct+'%</div>'+
      '</div>'+
      '<div style="background:var(--g200);border-radius:4px;height:8px;margin-bottom:12px;overflow:hidden">'+
        '<div style="background:linear-gradient(90deg,'+(pct>=80?'var(--ok)':pct>=60?'var(--warn)':'var(--bad)')+','+( pct>=80?'#4ADE80':pct>=60?'#FCD34D':'#F87171')+');height:100%;width:'+pct+'%;border-radius:4px"></div>'+
      '</div>'+
      '<div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:8px">'+
        ['出勤 '+inDays+'天','未打退 '+(inDays-outDays>0?inDays-outDays:0)+'天','缺勤 '+absentDays+'天','出勤率 '+pct+'%'].map((txt,i)=>
          '<div style="text-align:center;padding:8px;background:var(--g50);border-radius:var(--rxs)">'+
            '<div style="font-size:.72rem;color:var(--g400);margin-bottom:3px">'+['出勤','未打退卡','缺勤','出勤率'][i]+'</div>'+
            '<div style="font-weight:900;font-size:.88rem;font-family:monospace">'+['出勤 '+inDays+'天','未打退 '+(inDays-outDays>0?inDays-outDays:0)+'天','缺勤 '+absentDays+'天',pct+'%'][i].split(' ')[1]+'</div>'+
          '</div>'
        ).join('')+
      '</div>';
    list.appendChild(card);
  });
}

function getWorkDaysInMonth(year,month){
  let count=0;const date=new Date(year,month,1);
  while(date.getMonth()===month&&date<=new Date()){
    const day=date.getDay();if(day!==0&&day!==6)count++;
    date.setDate(date.getDate()+1);
  }
  return count;
}

// switchHRTab 覆寫加出缺勤
function switchHRTab(tab){
  // 更新 tab 樣式
  document.querySelectorAll('.ltab[data-ht]').forEach(t=>t.classList.toggle('on',t.dataset.ht===tab));
  // 顯示對應 body
  document.querySelectorAll('[id^="hrb-"]').forEach(b=>b.classList.remove('on'));
  const body=document.getElementById('hrb-'+tab);
  if(body)body.classList.add('on');
  // 各 tab 初始化
  if(tab==='salary')renderSalaryList();
  if(tab==='attend')renderAttendance();
  if(tab==='punch')renderHRPanel();
  if(tab==='request')renderHRPanel();
};

// ══ 廠商比價 ══════════════════════════════════════════════
function compareVendorsByCat(cat){
  const vendors=DB.get('vendors').filter(v=>v.cat===cat);
  if(vendors.length<2){showToast('同類別廠商不足 2 家，無法比較');return;}
  const rows=vendors.map(v=>'<tr><td style="padding:10px 14px;font-weight:700">'+v.vendor+'</td><td style="padding:10px 14px;color:var(--g400)">'+( v.caseN||'—')+'</td><td style="padding:10px 14px;font-family:monospace;font-weight:900;color:var(--gold-d)">NT$'+( v.amount||0).toLocaleString()+'</td><td style="padding:10px 14px;font-size:.8rem;color:var(--g400)">'+( v._ts||'').split(' ')[0]+'</td></tr>').join('');
  const min=Math.min(...vendors.map(v=>v.amount||0));
  const modal=document.createElement('div');modal.className='mov show';
  modal.innerHTML='<div class="modal" style="max-width:600px"><div class="mtit">'+cat+' 廠商比價 <button class="mcl" onclick="this.closest(\'.mov\').remove()">✕</button></div>'+
    '<div style="overflow-x:auto"><table class="tbl"><thead><tr><th>廠商</th><th>案場</th><th>報價</th><th>日期</th></tr></thead><tbody>'+rows+'</tbody></table></div>'+
    '<div style="margin-top:12px;padding:12px 16px;background:var(--ok-bg);border:1.5px solid var(--ok-bd);border-radius:var(--rs);font-size:.85rem;font-weight:700;color:var(--ok)">💡 最低報價：NT$'+min.toLocaleString()+'（'+vendors.find(v=>v.amount===min)?.vendor+'）</div>'+
    '</div>';
  document.body.appendChild(modal);
  modal.addEventListener('click',e=>{if(e.target===modal)modal.remove();});
}

// ══ 進度連結付款提醒 ══════════════════════════════════════


// ══ 行銷發文記錄 ══════════════════════════════════════════
function savePostRecord(platform,content){
  DB.push('post_history',{summary:'貼文 '+platform+' '+content.slice(0,40),platform,content,date:new Date().toLocaleDateString('zh-TW')});
}

// setupApp 加入初始化

function renderPostHistory(){
  const list=document.getElementById('postHistoryList');if(!list)return;
  const posts=DB.get('post_history');
  if(!posts.length){list.innerHTML='<div class="empty-state"><div class="es-ic">📋</div><div class="es-t">尚無發文記錄</div></div>';return;}
  list.innerHTML='';
  // 按日期分組統計
  const byDate={};
  posts.forEach(p=>{if(!byDate[p.date])byDate[p.date]=[];byDate[p.date].push(p);});
  list.innerHTML='<div style="font-size:.78rem;color:var(--g400);margin-bottom:10px">共 '+posts.length+' 篇記錄</div>';
  posts.slice(0,20).forEach(p=>{
    const row=document.createElement('div');
    row.style.cssText='padding:10px 14px;background:var(--g50);border-radius:var(--rs);margin-bottom:7px;cursor:pointer;transition:all var(--ease)';
    row.innerHTML=
      '<div style="display:flex;justify-content:space-between;margin-bottom:4px">'+
        '<span style="font-size:.78rem;font-weight:800;background:var(--info-bg);color:var(--info);padding:2px 8px;border-radius:10px">'+(p.platform||'IG')+'</span>'+
        '<span style="font-size:.72rem;color:var(--g400);font-family:monospace">'+p.date+'</span>'+
      '</div>'+
      '<div style="font-size:.84rem;color:var(--g700);line-height:1.5">'+(p.content||p.summary||'').slice(0,80)+'...</div>';
    row.addEventListener('click',()=>{
      // 點擊恢復這篇貼文到預覽
      if(p.content){
        const bd=document.getElementById('pstBd');if(bd)bd.textContent=p.content;
        document.getElementById('pstPrev').style.display='block';
        document.getElementById('postHistoryCard').style.display='none';
        showToast('✅ 已恢復貼文！');
      }
    });
    list.appendChild(row);
  });
}


// 頁面載入後顯示已儲存的 Key
setTimeout(()=>{
  const inp = document.getElementById('apiInp');
  if(inp && API_KEY) inp.value = API_KEY;
  const dot = document.getElementById('apiDot');
  if(dot && API_KEY){
    dot.textContent='✅ 已設定'; dot.style.background='var(--ok-bg)'; dot.style.color='var(--ok)';
  }
}, 500);

// ══ 遺失的按鈕監聽器（補全）══════════════════════════════

// ── 發票管理 ──────────────────────────────────────────────
document.getElementById('openInv')?.addEventListener('click',()=>{
  invImgUrl=null; invIItems=[];
  const fc=document.getElementById('invFileCard'); if(fc)fc.style.display='none';
  const fa=document.getElementById('invFormArea'); if(fa)fa.style.display='none';
  const op=document.getElementById('ocrProg'); if(op)op.classList.remove('show');
  const ok=document.getElementById('ocrOk'); if(ok)ok.style.display='none';
  const it=document.getElementById('invItemsTable'); if(it)it.innerHTML='';
  const ts=document.getElementById('invTotalShow'); if(ts)ts.textContent='NT$0';
  ['invNo','invAmt','invDesc'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
  const dt=document.getElementById('invDt'); if(dt)dt.value=new Date().toISOString().split('T')[0];
  const fi=document.getElementById('invFile'); if(fi)fi.value='';
  openModal('invModal');
});

document.getElementById('invAddItem')?.addEventListener('click',()=>{
  invIItems.push({name:'',qty:1,amount:0});
  renderInvItems();
});

document.getElementById('addInvBtn')?.addEventListener('click',()=>{
  const no=(document.getElementById('invNo')?.value||'').trim()||'—';
  const dt=document.getElementById('invDt')?.value||'';
  const amt=parseInt(document.getElementById('invAmt')?.value||0)||invIItems.reduce((s,it)=>s+(it.amount||0),0);
  const cat=document.getElementById('invCat')?.value||'材料費';
  const desc=(document.getElementById('invDesc')?.value||'').trim();
  DB.push('invoices',{summary:'發票 '+no+' '+cat+' '+fmt(amt),no,date:dt,amount:amt,cat,desc,items:[...invIItems],imgDataUrl:invImgUrl});
  closeModal('invModal');
  renderInvoices(document.getElementById('invSrch')?.value||'');
  updStats(); renderHistory();
  showToast('✅ 發票已儲存！');
});

// ── 發票編輯 ──────────────────────────────────────────────
document.getElementById('ieBtn')?.addEventListener('click',()=>{
  if(!ieId)return;
  const no=(document.getElementById('ieNo')?.value||'').trim();
  const amt=parseInt(document.getElementById('ieAmt')?.value||0);
  const cat=document.getElementById('ieCat')?.value||'材料費';
  const desc=(document.getElementById('ieDesc')?.value||'').trim();
  DB.upd('invoices',ieId,{no,date:document.getElementById('ieDt')?.value||'',amount:amt,cat,desc,summary:'發票 '+no+' '+cat+' '+fmt(amt)});
  closeModal('invEditModal');
  renderInvoices(document.getElementById('invSrch')?.value||'');
  updStats(); renderHistory();
  showToast('✅ 發票已更新！');
});

// ── 合約刪除上傳 ──────────────────────────────────────────
;

// ── 發票 Zone 點擊 ────────────────────────────────────────

// ── 廠商 Zone 點擊 ────────────────────────────────────────
document.getElementById('vZone')?.addEventListener('click',()=>{
  document.getElementById('vFile')?.click();
});

// ══ Modal 點外面關閉（覆寫確保正確）══════════════════════
document.querySelectorAll('.mov').forEach(mov=>{
  mov.addEventListener('click',e=>{
    if(e.target===mov) mov.classList.remove('show');
  });
});

// 確保 data-close 也正常運作
document.querySelectorAll('[data-close]').forEach(btn=>{
  btn.addEventListener('click',()=>closeModal(btn.dataset.close));
});

// lightbox：僅可點右上角 ✕ 關閉，避免滑動瀏覽圖片時誤觸背景關閉
document.getElementById('lbx')?.addEventListener('click',()=>{
  document.getElementById('lb').classList.remove('show');
});

// ══ 其他遺失的按鈕 ════════════════════════════════════════
document.getElementById('clrCs')?.addEventListener('click',()=>{
  const ms=document.getElementById('ms-cs-'+curClientId);
  if(ms)ms.innerHTML='';
});
document.getElementById('clearCsBtn')?.addEventListener('click',()=>{
  if(!curClientId)return;
  if(!confirm('確定清除此客戶的對話記錄？'))return;
  const ms=document.getElementById('ms-cs-'+curClientId);
  if(ms)ms.innerHTML='';
  showToast('✅ 對話已清除');
});

document.getElementById('cpRpl')?.addEventListener('click',()=>{
  const txt=document.getElementById('rplTxt')?.textContent||'';
  navigator.clipboard?.writeText(txt).then(()=>showToast('✅ 已複製！'));
});

document.getElementById('svRpl')?.addEventListener('click',()=>{
  DB.push('chat_cs',{summary:'客服回覆：'+(document.getElementById('rplTxt')?.textContent||'').slice(0,60)});
  renderHistory(); showToast('✅ 已儲存！');
});

document.getElementById('qAddSec')?.addEventListener('click',()=>{
  qSections.push({id:'s'+Date.now(),icon:'🔧',name:'新增分類',items:[{name:'',unit:'式',qty:1,price:0,cost:0}]});
  renderProQuote('qSections',qSections,{allowDelSec:true,totIds:{sub:'pqSub',total:'pqTotal'}});
});

document.getElementById('adAddSec')?.addEventListener('click',()=>{
  adSections.push({id:'s'+Date.now(),icon:'🔧',name:'新增分類',items:[{name:'',unit:'式',qty:1,price:0,cost:0}]});
  renderProQuote('adSections',adSections,{allowDelSec:true,totIds:{sub:'adSub',mgmt:'adMgmt',total:'adTotal'}});
});

document.getElementById('qXls')?.addEventListener('click',()=>{
  dlXls(document.getElementById('qN')?.value||'客戶', document.getElementById('qTp')?.value||'工程', qSections);
});

document.getElementById('dlImgBtn')?.addEventListener('click',()=>{
  const svg=document.getElementById('mkImgCanvas')?.querySelector('svg');
  if(!svg)return;
  const blob=new Blob([svg.outerHTML],{type:'image/svg+xml'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');a.href=url;a.download='zeju_'+Date.now()+'.svg';a.click();
  URL.revokeObjectURL(url); showToast('✅ 圖片已下載！');
});

document.getElementById('regenImgBtn')?.addEventListener('click',()=>genMktImg());
document.getElementById('rgnPst')?.addEventListener('click',()=>chatQ('mk-chat','幫我重新生成一個不同角度的版本'));

document.getElementById('outBtn')?.addEventListener('click',()=>{
  document.getElementById('app').style.display='none';
  const ls=document.getElementById('ls');
  ls.style.opacity='1'; ls.style.display='flex';
});

// 報表按鈕
document.querySelectorAll('[data-rpt]').forEach(btn=>{
  btn.addEventListener('click',()=>{
    const t=btn.dataset.rpt;
    const sp=document.getElementById('rptSp'); if(sp)sp.classList.add('show');
    setTimeout(()=>{
      if(sp)sp.classList.remove('show');
      const def=RPTS[t]; if(!def)return;
      const tit=document.getElementById('rptTit'); if(tit)tit.textContent=def.t;
      const met=document.getElementById('rptMet'); if(met)met.textContent='報表日期：'+new Date().toLocaleDateString('zh-TW');
      const bd=document.getElementById('rptBd'); if(bd)bd.innerHTML=def.b();
      const card=document.getElementById('rptCard'); if(card)card.style.display='block';
    },600);
  });
});
document.getElementById('svRpt')?.addEventListener('click',()=>{
  DB.push('reports',{summary:'報表：'+(document.getElementById('rptTit')?.textContent||'')});
  renderHistory(); showToast('✅ 已儲存！');
});

// 回覆格式按鈕
document.querySelectorAll('[data-fmt]').forEach(btn=>{
  btn.addEventListener('click',()=>genReply(btn.dataset.fmt));
});

// ══════════════════════════════════════════════════════════
// 補全遺失函式
// ══════════════════════════════════════════════════════════

// ── 點數顯示 ──────────────────────────────────────────────