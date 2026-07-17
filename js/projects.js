// ══ 案場管理系統 ══════════════════════════════════════════
// 核心：所有功能（報價、合約、帳款、廠商）都以案場為中心

// ── 案場狀態定義 ─────────────────────────────────────────
const PROJECT_STATUS = {
  inquiry:  {label:'詢價中',   color:'var(--info)',    bg:'var(--info-bg)',  icon:'💬'},
  quoting:  {label:'報價中',   color:'var(--warn)',    bg:'var(--warn-bg)',  icon:'📋'},
  signed:   {label:'已簽約',   color:'var(--ok)',      bg:'var(--ok-bg)',    icon:'✅'},
  progress: {label:'施工中',   color:'#7C3AED',        bg:'#F3E8FF',         icon:'🔨'},
  done:     {label:'完工',     color:'var(--g500)',    bg:'var(--g100)',      icon:'🏠'},
  paused:   {label:'暫停',     color:'var(--bad)',     bg:'var(--bad-bg)',   icon:'⏸️'},
};

const PROJECT_TYPES = ['全室翻新','老屋翻新','局部裝修','新成屋裝修','商業空間','辦公室','廚衛翻修','其他'];

// ── 取得所有案場（含統計）────────────────────────────────
function getProjects(){
  return DB.get('projects').map(p=>({
    ...p,
    quotes: DB.get('quotes').filter(q=>q.projectId===p._id),
    vendors: DB.get('vendors').filter(v=>v.projectId===p._id&&!v.deleted),
    ledger: DB.get('ledger').filter(l=>l.projectId===p._id),
  }));
}

function getProject(id){
  return DB.get('projects').find(p=>p._id===id);
}

// ── 首頁待辦計算 ──────────────────────────────────────────
function getTodayTodos(){
  const todos=[];
  const now=Date.now();
  const projects=DB.get('projects');

  // 1. 報價單等待中（超過3天未轉合約）
  const pendingQuotes=DB.get('quotes').filter(q=>{
    if(q.status==='signed'||q.status==='rejected') return false;
    const age=(now-q._id)/86400000;
    return age>3;
  });
  if(pendingQuotes.length){
    todos.push({type:'quote',level:'warn',icon:'📋',
      title:`${pendingQuotes.length} 份報價單等待超過3天`,
      desc:'點此查看 → 可追蹤業主是否回覆',
      action:()=>showPanel('ad-quote')});
  }

  // 2. 待收款（外帳有未結清的）
  const unpaid=DB.get('ledger').filter(l=>l.book==='in'&&l.type==='in'&&!l.paid);
  const unpaidAmt=unpaid.reduce((s,l)=>s+(l.amount||0),0);
  if(unpaid.length){
    todos.push({type:'payment',level:'bad',icon:'💰',
      title:`${unpaid.length} 筆應收款尚未到帳　共 NT$${unpaidAmt.toLocaleString()}`,
      desc:'點此查看帳款總覽',
      action:()=>showPanel('ac-overview')});
  }

  // 3. 施工中但超過7天沒更新進度
  const stale=projects.filter(p=>{
    if(p.status!=='progress') return false;
    const prog=DB.get('progress').filter(r=>r.projectId===p._id);
    if(!prog.length) return true;
    const latest=Math.max(...prog.map(r=>r._id));
    return (now-latest)/86400000>7;
  });
  if(stale.length){
    todos.push({type:'progress',level:'warn',icon:'🔨',
      title:`${stale.length} 個施工案場超過7天未更新進度`,
      desc:stale.map(p=>p.name).join('、'),
      action:()=>showPanel('ad-progress')});
  }

  // 4. 待審核補登打卡
  const pendingPunch=DB.get('punch_requests').filter(r=>r.status==='pending');
  if(pendingPunch.length){
    todos.push({type:'punch',level:'info',icon:'🕐',
      title:`${pendingPunch.length} 筆員工補登打卡等待審核`,
      desc:'點此前往人資管理審核',
      action:()=>showPanel('hr-settings')});
  }

  // 5. 案場完工超過30天但未結算
  const unsettled=projects.filter(p=>{
    if(p.status!=='done') return false;
    const doneAge=p.doneDate?(now-new Date(p.doneDate).getTime())/86400000:0;
    return doneAge>30;
  });
  if(unsettled.length){
    todos.push({type:'settle',level:'info',icon:'🏠',
      title:`${unsettled.length} 個案場完工超過30天，可確認是否已結案`,
      desc:unsettled.map(p=>p.name).join('、'),
      action:()=>showPanel('projects')});
  }

  return todos;
}

// ── 渲染首頁儀表板 ────────────────────────────────────────
function renderDashboard(){
  const projects=DB.get('projects');
  const quotes=DB.get('quotes');
  const ledger=DB.get('ledger');

  // 統計
  const active=projects.filter(p=>p.status==='progress').length;
  const thisMonth=new Date().toISOString().slice(0,7);
  const monthIncome=ledger.filter(l=>l.book==='in'&&l.type==='in'&&(l.date||'').startsWith(thisMonth))
    .reduce((s,l)=>s+(l.amount||0),0);
  const monthCost=ledger.filter(l=>l.book==='out'&&l.type==='out'&&(l.date||'').startsWith(thisMonth))
    .reduce((s,l)=>s+(l.amount||0),0);
  const monthProfit=monthIncome-monthCost;

  // 更新統計卡
  const set=(id,v)=>{const el=document.getElementById(id);if(el)el.textContent=v;};
  set('dash-active', active);
  set('dash-month-income', monthIncome?'NT$'+monthIncome.toLocaleString():'NT$0');
  set('dash-month-cost', monthCost?'NT$'+monthCost.toLocaleString():'NT$0');
  set('dash-month-profit', (monthProfit>=0?'+':'')+'NT$'+Math.abs(monthProfit).toLocaleString());
  const pfEl=document.getElementById('dash-month-profit');
  if(pfEl) pfEl.style.color=monthProfit>=0?'var(--ok)':'var(--bad)';

  // 待辦清單
  const todoList=document.getElementById('dashTodos');
  if(!todoList) return;
  const todos=getTodayTodos();
  if(!todos.length){
    todoList.innerHTML='<div style="text-align:center;padding:30px;color:var(--g400)"><div style="font-size:2rem;margin-bottom:8px">✅</div><div style="font-weight:700">今日沒有待辦事項</div><div style="font-size:.82rem;margin-top:4px">所有案場進度正常</div></div>';
    return;
  }
  todoList.innerHTML='';
  todos.forEach(todo=>{
    const card=document.createElement('div');
    const colors={bad:'var(--bad)',warn:'var(--warn)',info:'var(--info)'};
    const bgs={bad:'var(--bad-bg)',warn:'var(--warn-bg)',info:'var(--info-bg)'};
    const bds={bad:'var(--bad-bd)',warn:'var(--warn-bd)',info:'var(--info-bd)'};
    card.style.cssText=`display:flex;align-items:center;gap:14px;padding:14px 16px;background:${bgs[todo.level]};border:1.5px solid ${bds[todo.level]};border-radius:var(--r);cursor:pointer;transition:all var(--ease);margin-bottom:10px`;
    card.innerHTML=`<div style="font-size:1.5rem;flex-shrink:0">${todo.icon}</div>
      <div style="flex:1;min-width:0">
        <div style="font-weight:800;color:${colors[todo.level]};font-size:.9rem">${todo.title}</div>
        <div style="font-size:.78rem;color:var(--g500);margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${todo.desc}</div>
      </div>
      <div style="color:${colors[todo.level]};font-size:1rem;flex-shrink:0">→</div>`;
    card.addEventListener('click', todo.action);
    card.addEventListener('mouseenter',()=>card.style.transform='translateX(3px)');
    card.addEventListener('mouseleave',()=>card.style.transform='');
    todoList.appendChild(card);
  });

  // 近期案場
  renderRecentProjects();
}

// ── 渲染近期案場（首頁下半部）────────────────────────────
function renderRecentProjects(){
  const c=document.getElementById('dashRecentProjects');if(!c)return;
  const projects=DB.get('projects').slice(0,5); // 最新5個
  if(!projects.length){
    c.innerHTML='<div style="text-align:center;padding:20px;color:var(--g400);font-size:.85rem">尚無案場，點上方「＋ 新增案場」開始</div>';
    return;
  }
  c.innerHTML='';
  projects.forEach(p=>{
    const st=PROJECT_STATUS[p.status||'inquiry']||PROJECT_STATUS.inquiry;
    const card=document.createElement('div');
    card.style.cssText='display:flex;align-items:center;gap:12px;padding:12px 16px;background:var(--w);border:1px solid var(--g200);border-radius:var(--r);cursor:pointer;transition:all var(--ease);margin-bottom:8px';
    card.innerHTML=`
      <div style="width:40px;height:40px;border-radius:10px;background:${st.bg};display:flex;align-items:center;justify-content:center;font-size:1.1rem;flex-shrink:0">${st.icon}</div>
      <div style="flex:1;min-width:0">
        <div style="font-weight:800;font-size:.9rem;color:var(--g700)">${esc(p.name||'未命名案場')}</div>
        <div style="font-size:.75rem;color:var(--g400);margin-top:2px">${esc(p.client||'業主未填')} ${p.address?' · '+esc(p.address.slice(0,12)):''}</div>
      </div>
      <div style="flex-shrink:0;text-align:right">
        <span style="font-size:.72rem;font-weight:700;padding:3px 8px;border-radius:20px;background:${st.bg};color:${st.color}">${st.label}</span>
      </div>`;
    card.addEventListener('click',()=>openProject(p._id));
    card.addEventListener('mouseenter',()=>{card.style.background='var(--g50)';card.style.borderColor='var(--gold-l)';});
    card.addEventListener('mouseleave',()=>{card.style.background='var(--w)';card.style.borderColor='var(--g200)';});
    c.appendChild(card);
  });
}

// ── 案場總覽頁面 ──────────────────────────────────────────
let curProjSearch='';
let curProjFilter='all';

let curProjView='list'; // 'list' 或 'kanban'

function setProjView(view){
  curProjView=view;
  localStorage.setItem('zeju_proj_view',view);
  document.querySelectorAll('.vt-btn').forEach(b=>b.classList.toggle('on',b.dataset.view===view));
  const listEl=document.getElementById('projectList');
  const kbEl=document.getElementById('projectKanban');
  const filterTabs=document.getElementById('projFilterTabs');
  if(listEl)listEl.style.display=view==='list'?'block':'none';
  if(kbEl)kbEl.style.display=view==='kanban'?'block':'none';
  // 看板模式下狀態篩選頁籤沒有意義（看板本身就是依狀態分欄），先隱藏
  if(filterTabs)filterTabs.style.display=view==='kanban'?'none':'flex';
  if(view==='kanban')renderProjectsKanban();
  else renderProjects();
}

function renderProjects(filter){
  if(filter!==undefined) curProjFilter=filter;
  filter=curProjFilter;
  const c=document.getElementById('projectList');if(!c)return;
  let projects=DB.get('projects');

  // 更新統計（不受篩選/搜尋影響，永遠顯示全部真實數字）
  const all=projects;
  const set=(id,v)=>{const el=document.getElementById(id);if(el)el.textContent=v;};
  set('proj-cnt-all',all.filter(p=>!p.archived).length);
  set('proj-cnt-active',all.filter(p=>p.status==='progress').length);
  set('proj-cnt-inquiry',all.filter(p=>p.status==='inquiry'||p.status==='quoting').length);
  set('proj-cnt-done',all.filter(p=>p.status==='done').length);
  set('proj-cnt-archived',all.filter(p=>p.archived).length);

  // 篩選：預設不顯示已封存案場，除非篩選就是「已封存」
  if(filter==='archived'){
    projects=projects.filter(p=>p.archived);
  } else {
    projects=projects.filter(p=>!p.archived);
    if(filter!=='all') projects=projects.filter(p=>p.status===filter);
  }

  // 搜尋（案場名稱／業主／地址）
  const term=(curProjSearch||'').trim().toLowerCase();
  if(term){
    projects=projects.filter(p=>
      (p.name||'').toLowerCase().includes(term) ||
      (p.client||'').toLowerCase().includes(term) ||
      (p.address||'').toLowerCase().includes(term)
    );
  }

  if(!projects.length){
    const msg=term?'找不到符合「'+esc(curProjSearch)+'」的案場':(filter==='archived'?'尚無已封存案場':(filter==='all'?'尚無案場':'此分類沒有案場'));
    c.innerHTML='<div class="empty-state"><div class="es-ic">🏗️</div><div class="es-t">'+msg+'</div><div class="es-s">'+(term?'換個關鍵字試試':'點右上角「＋ 新增案場」開始')+'</div></div>';
    return;
  }
  c.innerHTML='';
  projects.forEach(p=>{
    const st=PROJECT_STATUS[p.status||'inquiry']||PROJECT_STATUS.inquiry;
    const vCount=DB.get('vendors').filter(v=>v.projectId===p._id&&!v.deleted).length;
    const income=DB.get('ledger').filter(l=>l.projectId===p._id&&l.book==='in'&&l.type==='in').reduce((s,l)=>s+(l.amount||0),0);

    const card=document.createElement('div');
    card.className='card';
    card.style.cssText='cursor:pointer;transition:all var(--ease);margin-bottom:12px;position:relative';
    card.innerHTML=`
      <div style="display:flex;align-items:flex-start;gap:14px">
        <div style="width:48px;height:48px;border-radius:12px;background:${st.bg};display:flex;align-items:center;justify-content:center;font-size:1.3rem;flex-shrink:0">${st.icon}</div>
        <div style="flex:1;min-width:0">
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:4px">
            <span style="font-weight:900;font-size:1rem;color:var(--g800)">${esc(p.name||'未命名')}</span>
            <span style="font-size:.72rem;font-weight:700;padding:3px 9px;border-radius:20px;background:${st.bg};color:${st.color}">${st.label}</span>
            ${p.archived?'<span style="font-size:.72rem;font-weight:700;padding:3px 9px;border-radius:20px;background:var(--g100);color:var(--g400)">📦 已封存</span>':''}
          </div>
          <div style="font-size:.8rem;color:var(--g500);margin-bottom:8px">${esc(p.client||'業主未填')}${p.type?' · '+p.type:''}${p.address?' · '+esc(p.address.slice(0,16)):''}</div>
          <div style="display:flex;gap:16px;font-size:.75rem;color:var(--g400)">
            ${income?`<span style="color:var(--ok);font-weight:700">💰 已收 NT$${income.toLocaleString()}</span>`:''}
            ${vCount?`<span>🏗️ 廠商報價 ${vCount} 筆</span>`:''}
            ${p.startDate?`<span>📅 ${p.startDate}</span>`:''}
          </div>
        </div>
        <div style="display:flex;flex-direction:column;gap:6px;flex-shrink:0;align-items:flex-end">
          <button class="btn bg bsm" onclick="event.stopPropagation();openProject(${p._id})">進入案場 →</button>
          <div style="display:flex;gap:4px">
            <button title="${p.archived?'取消封存':'封存'}" onclick="event.stopPropagation();toggleProjectArchive(${p._id})" style="width:28px;height:28px;border:1.5px solid var(--g200);background:var(--w);border-radius:var(--rxs);cursor:pointer;font-size:.75rem;color:var(--g400)">${p.archived?'↩️':'📦'}</button>
            <button title="刪除" onclick="event.stopPropagation();deleteProjectCard(${p._id},'${esc(p.name||'').replace(/'/g,"\\'")}')" style="width:28px;height:28px;border:1.5px solid var(--bad-bd);background:var(--bad-bg);border-radius:var(--rxs);cursor:pointer;font-size:.75rem;color:var(--bad)">🗑</button>
          </div>
        </div>
      </div>`;
    card.addEventListener('click',()=>openProject(p._id));
    card.addEventListener('mouseenter',()=>card.style.boxShadow='var(--sh3)');
    card.addEventListener('mouseleave',()=>card.style.boxShadow='');
    c.appendChild(card);
  });
  if(typeof renderProjectCalendar==='function')renderProjectCalendar();
}

function searchProjects(val){
  curProjSearch=val;
  if(curProjView==='kanban')renderProjectsKanban();
  else renderProjects();
}

// ── 看板檢視（拖拉卡片切換案場狀態）─────────────────────────
const KANBAN_STATUSES=['inquiry','quoting','signed','progress','paused','done'];

function renderProjectsKanban(){
  const el=document.getElementById('projectKanban');if(!el)return;
  let projects=DB.get('projects').filter(p=>!p.archived);

  const term=(curProjSearch||'').trim().toLowerCase();
  if(term){
    projects=projects.filter(p=>
      (p.name||'').toLowerCase().includes(term) ||
      (p.client||'').toLowerCase().includes(term) ||
      (p.address||'').toLowerCase().includes(term)
    );
  }

  el.innerHTML='<div class="kanban" id="kanbanRow"></div>';
  const row=document.getElementById('kanbanRow');

  KANBAN_STATUSES.forEach(statusKey=>{
    const st=PROJECT_STATUS[statusKey];
    const items=projects.filter(p=>(p.status||'inquiry')===statusKey);
    const col=document.createElement('div');
    col.className='kb-col';
    col.dataset.status=statusKey;
    col.innerHTML=`<div class="kb-col-hd"><span class="kb-col-t">${st.icon} ${st.label}</span><span class="kb-col-n">${items.length}</span></div><div class="kb-body"></div>`;
    const body=col.querySelector('.kb-body');

    if(!items.length){
      body.innerHTML='<div class="kb-empty">沒有案場</div>';
    } else {
      items.forEach(p=>{
        const income=DB.get('ledger').filter(l=>l.projectId===p._id&&l.book==='in'&&l.type==='in').reduce((s,l)=>s+(l.amount||0),0);
        const card=document.createElement('div');
        card.className='kb-card';
        card.draggable=true;
        card.dataset.id=p._id;
        card.innerHTML=`<div class="kb-card-t">${esc(p.name||'未命名')}</div><div class="kb-card-c">${esc(p.client||'業主未填')}</div>${income?`<div class="kb-card-amt">💰 NT$${income.toLocaleString()}</div>`:''}`;
        // 文字選單移動狀態：手機/平板點拖曳常常不準或根本拖不動（HTML5 原生拖曳對觸控支援不好），
        // 這裡加一個下拉選單當作「一定能用」的替代方案，選了就直接換分類，不用靠拖曳手勢。
        const moveWrap=document.createElement('div');
        moveWrap.className='kb-card-move';
        moveWrap.innerHTML=`<select>
          <option value="">↕️ 移到...</option>
          ${KANBAN_STATUSES.filter(k=>k!==statusKey).map(k=>`<option value="${k}">${PROJECT_STATUS[k].icon} ${PROJECT_STATUS[k].label}</option>`).join('')}
        </select>`;
        const moveSelect=moveWrap.querySelector('select');
        moveSelect.addEventListener('click',e=>e.stopPropagation());
        moveSelect.addEventListener('change',e=>{
          e.stopPropagation();
          if(!moveSelect.value)return;
          updateProjectStatus(p._id,moveSelect.value);
          renderProjectsKanban();
          if(typeof renderDashboard==='function')renderDashboard();
        });
        card.appendChild(moveWrap);
        card.addEventListener('click',()=>openProject(p._id));
        card.addEventListener('dragstart',e=>{
          card.classList.add('dragging');
          e.dataTransfer.setData('text/plain',String(p._id));
          e.dataTransfer.effectAllowed='move';
        });
        card.addEventListener('dragend',()=>card.classList.remove('dragging'));
        body.appendChild(card);
      });
    }

    // 欄位接收拖放
    col.addEventListener('dragover',e=>{e.preventDefault();col.classList.add('drag-over');});
    col.addEventListener('dragleave',()=>col.classList.remove('drag-over'));
    col.addEventListener('drop',e=>{
      e.preventDefault();
      col.classList.remove('drag-over');
      const draggedId=parseInt(e.dataTransfer.getData('text/plain'));
      const proj=getProject(draggedId);
      if(!proj)return;
      const newStatus=col.dataset.status;
      if(proj.status===newStatus)return;
      updateProjectStatus(draggedId,newStatus);
      renderProjectsKanban();
      if(typeof renderDashboard==='function')renderDashboard();
    });

    row.appendChild(col);
  });
  if(typeof renderProjectCalendar==='function')renderProjectCalendar();
}

// ── 案場日行事曆（依開工日排程，卡片可拖到別的日期改開工日）──────
let calViewDate=new Date(); // 目前行事曆顯示的月份

function ymd(d){ // Date -> 'YYYY-MM-DD'，跟 <input type="date"> 存的格式一致
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
}

function renderProjectCalendar(){
  const grid=document.getElementById('calGrid');if(!grid)return;
  const label=document.getElementById('calMonthLabel');
  const y=calViewDate.getFullYear(), m=calViewDate.getMonth();
  if(label)label.textContent=y+'年'+(m+1)+'月';

  const firstDay=new Date(y,m,1);
  const startOffset=firstDay.getDay(); // 0=週日
  const daysInMonth=new Date(y,m+1,0).getDate();
  const daysInPrevMonth=new Date(y,m,0).getDate();
  const todayStr=ymd(new Date());

  // 這個月（含前後補位天）每一天要放哪些案場：用開工日 startDate 對應
  const projects=DB.get('projects').filter(p=>!p.archived&&p.startDate);
  const byDate={};
  projects.forEach(p=>{ (byDate[p.startDate]=byDate[p.startDate]||[]).push(p); });

  const cells=[];
  // 補上個月尾巴
  for(let i=startOffset-1;i>=0;i--){
    const dnum=daysInPrevMonth-i;
    const dateStr=ymd(new Date(y,m-1,dnum));
    cells.push({dnum,dateStr,otherMonth:true});
  }
  // 本月
  for(let d=1;d<=daysInMonth;d++){
    cells.push({dnum:d,dateStr:ymd(new Date(y,m,d)),otherMonth:false});
  }
  // 補下個月開頭，湊滿整週（7 的倍數）
  let next=1;
  while(cells.length%7!==0){
    cells.push({dnum:next,dateStr:ymd(new Date(y,m+1,next)),otherMonth:true});
    next++;
  }

  grid.innerHTML='';
  cells.forEach(cell=>{
    const el=document.createElement('div');
    el.className='pc-day'+(cell.otherMonth?' other-month':'')+(cell.dateStr===todayStr?' today':'');
    el.dataset.date=cell.dateStr;
    el.innerHTML='<div class="pc-day-num">'+cell.dnum+'</div>';
    (byDate[cell.dateStr]||[]).forEach(p=>{
      const st=PROJECT_STATUS[p.status||'inquiry']||PROJECT_STATUS.inquiry;
      const chip=document.createElement('div');
      chip.className='pc-chip';
      chip.draggable=true;
      chip.dataset.id=p._id;
      chip.style.cssText='background:'+st.bg+';color:'+st.color+';border-left-color:'+st.color;
      chip.textContent=st.icon+' '+(p.name||p.client||'未命名案場');
      chip.title=(p.name||'未命名案場')+'（點擊查看，拖曳可改開工日）';
      chip.addEventListener('click',e=>{e.stopPropagation();openProject(p._id);});
      chip.addEventListener('dragstart',e=>{
        chip.classList.add('dragging');
        e.dataTransfer.setData('text/plain',String(p._id));
        e.dataTransfer.effectAllowed='move';
      });
      chip.addEventListener('dragend',()=>chip.classList.remove('dragging'));
      el.appendChild(chip);
    });
    el.addEventListener('dragover',e=>{e.preventDefault();el.classList.add('drag-over');});
    el.addEventListener('dragleave',()=>el.classList.remove('drag-over'));
    el.addEventListener('drop',e=>{
      e.preventDefault();
      el.classList.remove('drag-over');
      const draggedId=parseInt(e.dataTransfer.getData('text/plain'));
      const proj=getProject(draggedId);
      if(!proj||!proj.startDate)return;
      const newDate=el.dataset.date;
      if(proj.startDate===newDate)return;
      // 保留原本工期長度：完工日跟著開工日一起平移，不會因為拖曳而把工期拉長或縮短
      const patch={startDate:newDate};
      if(proj.endDate){
        const oldStart=new Date(proj.startDate+'T00:00:00');
        const oldEnd=new Date(proj.endDate+'T00:00:00');
        const durationDays=Math.round((oldEnd-oldStart)/86400000);
        const newStart=new Date(newDate+'T00:00:00');
        const newEnd=new Date(newStart.getTime()+durationDays*86400000);
        patch.endDate=ymd(newEnd);
      }
      DB.upd('projects',draggedId,patch);
      renderProjectCalendar();
      showToast('📅 已把「'+(proj.name||'案場')+'」的開工日改到 '+newDate);
    });
    grid.appendChild(el);
  });
}

document.getElementById('calPrevM')?.addEventListener('click',()=>{
  calViewDate=new Date(calViewDate.getFullYear(),calViewDate.getMonth()-1,1);
  renderProjectCalendar();
});
document.getElementById('calNextM')?.addEventListener('click',()=>{
  calViewDate=new Date(calViewDate.getFullYear(),calViewDate.getMonth()+1,1);
  renderProjectCalendar();
});
document.getElementById('calTodayBtn')?.addEventListener('click',()=>{
  calViewDate=new Date();
  renderProjectCalendar();
});


function toggleProjectArchive(id){
  const p=getProject(id);if(!p)return;
  DB.upd('projects',id,{archived:!p.archived});
  if(typeof curProjView!=='undefined'&&curProjView==='kanban')renderProjectsKanban();
  else renderProjects();
  showToast(p.archived?'✅ 已從封存取出':'📦 案場已封存（可在「已封存」分類找到）');
}

function deleteProjectCard(id,name){
  confirmAction('刪除案場「'+name+'」？此案場的報價、合約、帳款紀錄不會被刪除，但會失去案場歸屬。',()=>{
    DB.softDel('projects',id);
    renderProjects();
    if(typeof renderDashboard==='function')renderDashboard();
    showToast('✅ 案場已刪除（可在系統設定→垃圾桶復原）');
  });
}


// ── 新增/編輯案場 Modal ────────────────────────────────────
let projEditId=null;

function openAddProject(id=null){
  projEditId=id;
  const p=id?getProject(id):null;
  const set=(elId,v)=>{const el=document.getElementById(elId);if(el)el.value=v||'';};
  set('projName',p?.name);set('projClient',p?.client);set('projAddress',p?.address);
  set('projType',p?.type||PROJECT_TYPES[0]);set('projStart',p?.startDate);set('projEnd',p?.endDate);
  set('projNote',p?.note);

  // 狀態選項
  const stSel=document.getElementById('projStatus');
  if(stSel){
    stSel.innerHTML=Object.entries(PROJECT_STATUS).map(([k,v])=>`<option value="${k}"${(p?.status||'inquiry')===k?' selected':''}>${v.icon} ${v.label}</option>`).join('');
  }

  // 負責員工
  const empSel=document.getElementById('projEmployee');
  if(empSel){
    const emps=DB.get('employees');
    empSel.innerHTML='<option value="">不指定</option>'+emps.map(e=>`<option value="${e._id}"${p?.employeeId===e._id?' selected':''}>${esc(e.name)}</option>`).join('');
  }

  document.getElementById('projModalTitle').textContent=id?'編輯案場':'新增案場';
  openModal('projModal');
}

function saveProject(){
  const get=id=>document.getElementById(id)?.value?.trim()||'';
  const name=get('projName');
  if(!name){showToast('⚠️ 請填入案場名稱');return;}
  const existing=projEditId?getProject(projEditId):null;
  const data={
    name, client:get('projClient'), address:get('projAddress'),
    type:get('projType')||PROJECT_TYPES[0], status:get('projStatus')||'inquiry',
    startDate:get('projStart'), endDate:get('projEnd'), note:get('projNote'),
    employeeId:document.getElementById('projEmployee')?.value||'',
    token:existing?.token||('zj'+Math.random().toString(36).slice(2,10)+Date.now().toString(36).slice(-4)),
    summary:'案場 '+name,
  };
  if(projEditId){
    DB.upd('projects',projEditId,data);
    showToast('✅ 案場資料已更新');
  } else {
    const arr=DB.push('projects',data);
    const newId=arr[0]._id;
    showToast('✅ 案場已建立！');
    // 建立後提示下一步
    setTimeout(()=>{
      showNextStep('案場已建立！接下來可以：', [
        {label:'📋 建立報價單', action:()=>{closeModal('projModal');openProject(newId,'quote');}},
        {label:'📝 上傳合約',  action:()=>{closeModal('projModal');openProject(newId,'contract');}},
        {label:'稍後再說',     action:()=>closeModal('projModal')},
      ]);
      return;
    }, 300);
    closeModal('projModal');
    renderProjects();
    return;
  }
  closeModal('projModal');
  renderProjects();
}

// ── 下一步提示 ────────────────────────────────────────────
function showNextStep(msg, options){
  const old=document.getElementById('_nextStepBox');if(old)old.remove();
  const box=document.createElement('div');
  box.id='_nextStepBox';
  box.style.cssText='position:fixed;bottom:30px;right:24px;background:var(--w);border:1.5px solid var(--gold-l);border-radius:var(--r);padding:18px 20px;z-index:8000;box-shadow:var(--sh4);min-width:240px;max-width:300px;animation:slideUp .2s ease';
  const close=()=>box.remove();
  box.innerHTML=`<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
    <div style="font-weight:800;color:var(--g700);font-size:.88rem">${msg}</div>
    <button onclick="this.closest('#_nextStepBox').remove()" style="background:none;border:none;color:var(--g400);font-size:1.1rem;cursor:pointer;padding:0 0 0 8px">✕</button>
  </div>
  <div id="_nextStepBtns" style="display:flex;flex-direction:column;gap:7px"></div>`;
  document.body.appendChild(box);
  const btnC=box.querySelector('#_nextStepBtns');
  options.forEach((opt,i)=>{
    const btn=document.createElement('button');
    btn.style.cssText=`padding:9px 14px;border-radius:var(--rs);border:1.5px solid ${i===0?'var(--gold)':'var(--g200)'};background:${i===0?'var(--gold-pale)':'none'};color:${i===0?'var(--gold-d)':'var(--g500)'};font-size:.82rem;cursor:pointer;font-weight:${i===0?'800':'600'};font-family:inherit;text-align:left;transition:all var(--ease)`;
    btn.textContent=opt.label;
    btn.addEventListener('click',()=>{close();opt.action();});
    btnC.appendChild(btn);
  });
  setTimeout(close, 10000);
}

// ── 進入案場 ──────────────────────────────────────────────
function openProject(id, tab='overview'){
  curProjectId=id;
  const p=getProject(id);if(!p)return;
  showPanel('project-detail');
  renderProjectDetail(id, tab);
}

// ── 案場詳情頁 ────────────────────────────────────────────
function renderProjectDetail(id, activeTab='overview'){
  const p=getProject(id);if(!p)return;
  const st=PROJECT_STATUS[p.status||'inquiry']||PROJECT_STATUS.inquiry;

  // 標題
  const header=document.getElementById('projDetailHeader');
  if(header){
    const emps=DB.get('employees');
    const emp=p.employeeId?emps.find(e=>e._id===p.employeeId):null;
    header.innerHTML=`
      <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
        <button onclick="showPanel('projects')" style="background:none;border:none;color:var(--g400);cursor:pointer;font-size:.85rem;padding:0">← 返回</button>
        <div style="font-size:1.5rem;font-weight:900;color:var(--g800)">${esc(p.name)}</div>
        <span style="padding:4px 12px;border-radius:20px;background:${st.bg};color:${st.color};font-size:.78rem;font-weight:800">${st.icon} ${st.label}</span>
      </div>
      <div style="font-size:.82rem;color:var(--g400);margin-top:4px;display:flex;gap:16px;flex-wrap:wrap">
        ${p.client?`<span>👤 業主：${esc(p.client)}</span>`:''}
        ${p.address?`<span>📍 ${esc(p.address)}</span>`:''}
        ${p.type?`<span>🏠 ${p.type}</span>`:''}
        ${emp?`<span>👷 負責：${esc(emp.name)}</span>`:''}
        ${p.startDate?`<span>📅 開工：${p.startDate}</span>`:''}
      </div>`;
  }

  // Tab 切換
  const tabs=['overview','quote','vendor','contract','ledger','progress'];
  const tabLabels={overview:'📊 總覽',quote:'📋 報價',vendor:'🏗️ 廠商報價',contract:'📝 合約',ledger:'💰 帳款',progress:'🔨 進度'};
  const tabBar=document.getElementById('projDetailTabs');
  if(tabBar){
    tabBar.innerHTML=tabs.map(t=>`<div class="ltab${t===activeTab?' on':''}" onclick="renderProjectDetail(${id},'${t}')">${tabLabels[t]}</div>`).join('');
  }

  // Tab 內容
  const content=document.getElementById('projDetailContent');
  if(!content) return;

  switch(activeTab){
    case 'overview': renderProjOverview(id,p,content); break;
    case 'quote':    renderProjQuotes(id,p,content);   break;
    case 'vendor':   renderProjVendors(id,p,content);  break;
    case 'contract': renderProjContract(id,p,content); break;
    case 'ledger':   renderProjLedger(id,p,content);   break;
    case 'progress': renderProjProgress(id,p,content); break;
  }
}

// ── 案場總覽 Tab ──────────────────────────────────────────
function renderProjOverview(id,p,c){
  const quotes=DB.get('quotes').filter(q=>q.projectId===id);
  const vendors=DB.get('vendors').filter(v=>v.projectId===id&&!v.deleted);
  const contracts=DB.get('contracts').filter(ct=>ct.projectId===id&&!ct.deleted);
  const ledgerItems=DB.get('ledger').filter(l=>l.projectId===id);
  const income=ledgerItems.filter(l=>l.book==='in'&&l.type==='in').reduce((s,l)=>s+(l.amount||0),0);
  const cost=ledgerItems.filter(l=>l.book==='out'&&l.type==='out').reduce((s,l)=>s+(l.amount||0),0);
  const vendorCost=vendors.reduce((s,v)=>s+(v.amount||0),0);
  const profit=income-cost-vendorCost;
  const st=PROJECT_STATUS[p.status||'inquiry'];

  c.innerHTML=`
    <div class="g3" style="margin-bottom:20px">
      <div class="stat"><div class="sn" style="color:var(--ok)">${income?'NT$'+income.toLocaleString():'NT$0'}</div><div class="sl">客戶收款</div></div>
      <div class="stat"><div class="sn" style="color:var(--bad)">${(cost+vendorCost)?'NT$'+(cost+vendorCost).toLocaleString():'NT$0'}</div><div class="sl">工程成本</div></div>
      <div class="stat"><div class="sn" style="color:${profit>=0?'var(--ok)':'var(--bad)'}">${(profit>=0?'+':'')}NT$${Math.abs(profit).toLocaleString()}</div><div class="sl">毛利</div></div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:20px">
      ${[
        {icon:'📋',label:'報價單',count:quotes.length,action:`renderProjectDetail(${id},'quote')`,btn:'查看報價',color:'var(--info)'},
        {icon:'🏗️',label:'廠商報價',count:vendors.length,action:`renderProjectDetail(${id},'vendor')`,btn:'查看廠商',color:'var(--warn)'},
        {icon:'📝',label:'合約',count:contracts.length,action:`renderProjectDetail(${id},'contract')`,btn:'查看合約',color:'var(--ok)'},
        {icon:'💰',label:'帳款紀錄',count:ledgerItems.length,action:`renderProjectDetail(${id},'ledger')`,btn:'查看帳款',color:'var(--gold-d)'},
      ].map(item=>`
        <div onclick="${item.action}" style="padding:16px;background:var(--w);border:1px solid var(--g200);border-radius:var(--r);cursor:pointer;transition:all var(--ease)" 
          onmouseenter="this.style.borderColor='var(--gold-l)';this.style.boxShadow='var(--sh2)'"
          onmouseleave="this.style.borderColor='var(--g200)';this.style.boxShadow=''">
          <div style="font-size:.75rem;color:var(--g400);margin-bottom:4px">${item.icon} ${item.label}</div>
          <div style="font-size:1.4rem;font-weight:900;color:${item.color}">${item.count}</div>
          <div style="font-size:.72rem;color:var(--g400);margin-top:4px">${item.btn} →</div>
        </div>`).join('')}
    </div>
    <div style="display:flex;gap:8px;flex-wrap:wrap">
      <button class="btn bg" onclick="shareProjectToClient(${id})" style="background:var(--ok);color:#fff">📱 分享給業主</button>
      <button class="btn bo" onclick="openAddProject(${id})">✏️ 編輯案場資料</button>
      <select onchange="if(this.value)updateProjectStatus(${id},this.value)" style="padding:8px 12px;border:1.5px solid var(--g200);border-radius:var(--rs);font-size:.82rem;font-family:inherit;color:var(--g600);background:var(--w);cursor:pointer">
        <option value="">更改狀態...</option>
        ${Object.entries(PROJECT_STATUS).map(([k,v])=>`<option value="${k}">${v.icon} ${v.label}</option>`).join('')}
      </select>
    </div>`;
}

function updateProjectStatus(id,status){
  DB.upd('projects',id,{status,doneDate:status==='done'?new Date().toISOString().split('T')[0]:undefined});
  // 只在目前正顯示這個案場的詳情頁時才重繪，避免從案場總覽（列表/看板）呼叫時做多餘的DOM操作
  const detailPanel=document.getElementById('p-project-detail');
  if(detailPanel&&detailPanel.classList.contains('on')&&curProjectId===id){
    renderProjectDetail(id,'overview');
  }
  showToast('✅ 案場狀態已更新：'+PROJECT_STATUS[status].label);
  if(status==='done'&&typeof showNextStep==='function'){
    setTimeout(()=>{
      showNextStep('案場已完工！要不要封存它？', [
        {label:'📦 封存（案場總覽不再顯示）',action:()=>{toggleProjectArchive(id);if(detailPanel?.classList.contains('on'))renderProjectDetail(id,'overview');}},
        {label:'先不要，繼續留在列表',action:()=>{}},
      ]);
    },600);
  }
}

// ── 案場報價 Tab ──────────────────────────────────────────
function renderProjQuotes(id,p,c){
  const quotes=DB.get('quotes').filter(q=>q.projectId===id);
  c.innerHTML=`
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
      <div style="font-weight:800;color:var(--g700)">報價單（${quotes.length} 份）</div>
      <button class="btn bg bsm" onclick="newProjQuote(${id})">＋ 新建報價單</button>
    </div>
    ${quotes.length?quotes.map(q=>`
      <div class="card" style="margin-bottom:10px;cursor:pointer" onclick="openQuoteEdit(${q._id})">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <div>
            <div style="font-weight:800">${esc(q.name||'報價單')}</div>
            <div style="font-size:.78rem;color:var(--g400);margin-top:2px">${q._ts||''}</div>
          </div>
          <div style="font-weight:900;color:var(--gold-d)">NT$${Math.round((q.sections||[]).reduce((s,sec)=>(sec.items||[]).reduce((a,it)=>a+(parseFloat(it.price)||0)*(parseFloat(it.qty)||1),s),0)*1.05).toLocaleString()}</div>
        </div>
      </div>`).join(''):'<div class="empty-state"><div class="es-ic">📋</div><div class="es-t">尚無報價單</div><div class="es-s">點右上方新建此案場的報價單</div></div>'}`;
}

function newProjQuote(projectId){
  curProjectId=projectId;
  const p=getProject(projectId);
  showPanel('ad-newquote');
  // 從案場資料預填業主、案場名稱、地址、工程類型，不用重複輸入
  setTimeout(()=>{
    if(!p)return;
    const set=(id,v)=>{const el=document.getElementById(id);if(el&&v)el.value=v;};
    set('adN',p.client||p.name);
    set('adCase',p.name);
    set('adAd',p.address);
    set('adTp',p.type);
    showToast('✅ 已從案場帶入業主與地址資料');
  }, 300);
}

// ── 案場廠商報價 Tab ──────────────────────────────────────
function renderProjVendors(id,p,c){
  const vendors=DB.get('vendors').filter(v=>v.projectId===id&&!v.deleted);
  const total=vendors.reduce((s,v)=>s+(v.amount||0),0);
  c.innerHTML=`
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
      <div>
        <div style="font-weight:800;color:var(--g700)">廠商報價（${vendors.length} 筆）</div>
        ${total?`<div style="font-size:.82rem;color:var(--bad);font-weight:700">合計成本：NT$${total.toLocaleString()}</div>`:''}
      </div>
      <button class="btn bg bsm" onclick="openVendorForProject(${id})">＋ 新增廠商報價</button>
    </div>
    ${vendors.length?vendors.map(v=>`
      <div class="card" style="margin-bottom:8px">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <div>
            <div style="font-weight:700">${esc(v.vendor||'廠商')}</div>
            <div style="font-size:.75rem;color:var(--g400)">${esc(v.cat||'')} ${v.caseN?' · '+esc(v.caseN):''}</div>
          </div>
          <div style="font-weight:900;color:var(--bad)">NT$${(v.amount||0).toLocaleString()}</div>
        </div>
      </div>`).join(''):'<div class="empty-state"><div class="es-ic">🏗️</div><div class="es-t">尚無廠商報價</div></div>'}`;
}

function openVendorForProject(projectId){
  curProjectId=projectId;
  const p=getProject(projectId);
  vItems=[];
  // 修正重點：這裡原本把「廠商名稱」「備注」兩個欄位也一起設成案場名稱（跟合約表單同一種殘留/欄位對錯的問題），
  // 廠商名稱應該是空的讓使用者自己填，不是案場名稱；同時原本也沒清照片預覽跟 AI 辨識狀態，
  // 上一次上傳的照片、辨識結果會殘留在畫面上。這裡改成比照「行政 → 廠商報價」通用的重置邏輯，確保每次都是乾淨的表單。
  ['vVd','vNt'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
  document.getElementById('vTotal').textContent='NT$0';
  document.getElementById('vItemsTable').innerHTML='';
  const vAmt=document.getElementById('vAmt');if(vAmt)vAmt.value='';
  const vCs=document.getElementById('vCs');if(vCs)vCs.value=p?.name||'';
  const ocr=document.getElementById('vOcr');if(ocr)ocr.classList.remove('show');
  const res=document.getElementById('vResult');if(res)res.style.display='none';
  const prev=document.getElementById('vPrev');if(prev)prev.innerHTML='';
  const ok=document.getElementById('vOcrOk');if(ok)ok.style.display='none';
  const vFileEl=document.getElementById('vFile');if(vFileEl)vFileEl.value='';
  if(typeof setVType==='function')setVType('image');
  if(typeof buildCatSelectWithAdd==='function')buildCatSelectWithAdd(document.getElementById('vCat'),'vendorCat');
  openModal('vModal');
}

// ── 案場合約 Tab ──────────────────────────────────────────
function renderProjContract(id,p,c){
  const contracts=DB.get('contracts').filter(ct=>ct.projectId===id&&!ct.deleted);
  c.innerHTML=`
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
      <div style="font-weight:800;color:var(--g700)">合約（${contracts.length} 份）</div>
      <button class="btn bg bsm" onclick="openContractForProject(${id})">＋ 上傳合約</button>
    </div>
    ${contracts.length?contracts.map(ct=>`
      <div class="card" style="margin-bottom:8px;cursor:pointer" onclick="previewContract(${ct._id})">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <div>
            <div style="font-weight:700">${esc(ct.name||'合約')}</div>
            <div style="font-size:.75rem;color:var(--g400)">${ct._ts||''} ${ct.amount?'· NT$'+ct.amount.toLocaleString():''}</div>
          </div>
          <span style="font-size:.75rem;padding:3px 9px;border-radius:20px;background:var(--ok-bg);color:var(--ok)">點擊查看</span>
        </div>
      </div>`).join(''):'<div class="empty-state"><div class="es-ic">📝</div><div class="es-t">尚無合約</div><div class="es-s">上傳合約檔案，業主可隨時查看</div></div>'}`;
}

function openContractForProject(projectId){
  curProjectId=projectId;
  const p=getProject(projectId);
  ctEditId=null;
  // 修正重點：這裡原本沒有重置 ctImgUrl，導致如果剛剛在別的案場合約表單選過照片、
  // 沒存就跳走，再從這個案場點「＋上傳合約」時，舊案場選的照片會殘留在這個新表單裡，
  // 使用者以為自己還沒選任何照片，實際上已經被前一次殘留的照片佔住了。
  ctImgUrl=[];
  const fcEl=document.getElementById('ctFileCard');if(fcEl)fcEl.style.display='none';
  const gridEl=document.getElementById('ctPhotoGrid');if(gridEl)gridEl.innerHTML='';
  const cfEl=document.getElementById('ctFile');if(cfEl)cfEl.value='';
  const stEl=document.getElementById('ctStatus');if(stEl)stEl.value='pending';
  const btnEl=document.getElementById('addCtBtn');if(btnEl)btnEl.textContent='💾 儲存合約';
  ['ctName','ctClient','ctAmt2','ctNote'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
  if(p){
    const ctN=document.getElementById('ctName');if(ctN)ctN.value=p.name||'';
    const ctCl=document.getElementById('ctClient');if(ctCl)ctCl.value=p.client||'';
    // 帶入這個案場最新一份報價單的總價，不用再手動重算重打一次
    // 修正重點：原本這裡找的是 'ctAmt'，但表單欄位實際 id 是 'ctAmt2'，
    // 兩者對不起來導致這個自動帶入金額的功能完全沒作用（找不到元素，靜默失敗）。
    const quotes=DB.get('quotes').filter(q=>q.projectId===projectId).sort((a,b)=>b._id-a._id);
    if(quotes.length){
      const latest=quotes[0];
      const {grand}=typeof calcQuoteTotals==='function'?calcQuoteTotals(latest.sections||[]):{grand:latest.total||0};
      const ctAmt=document.getElementById('ctAmt2');
      if(ctAmt&&grand){ctAmt.value=grand;showToast('💡 已帶入報價單金額 NT$'+grand.toLocaleString()+'，可依實際簽約內容調整');}
    }
  }
  openModal('contractModal');
}

// ── 案場帳款 Tab ──────────────────────────────────────────
function renderProjLedger(id,p,c){
  const items=DB.get('ledger').filter(l=>l.projectId===id).sort((a,b)=>b._id-a._id);
  const income=items.filter(l=>l.book==='in'&&l.type==='in').reduce((s,l)=>s+(l.amount||0),0);
  const cost=items.filter(l=>l.book==='out'&&l.type==='out').reduce((s,l)=>s+(l.amount||0),0);

  c.innerHTML=`
    <div class="g3" style="margin-bottom:16px">
      <div class="stat"><div class="sn" style="color:var(--ok)">${income?'NT$'+income.toLocaleString():'NT$0'}</div><div class="sl">外帳收入</div></div>
      <div class="stat"><div class="sn" style="color:var(--bad)">${cost?'NT$'+cost.toLocaleString():'NT$0'}</div><div class="sl">內帳支出</div></div>
      <div class="stat"><div class="sn" style="color:${income-cost>=0?'var(--ok)':'var(--bad)'}">${(income-cost>=0?'+':'')+'NT$'+Math.abs(income-cost).toLocaleString()}</div><div class="sl">毛利</div></div>
    </div>
    <div style="display:flex;gap:8px;margin-bottom:16px">
      <button class="btn bg bsm" onclick="openProjLedgerModal(${id},'in')">＋ 新增收款</button>
      <button class="btn bo bsm" onclick="openProjLedgerModal(${id},'out')">＋ 新增支出</button>
    </div>
    <div id="projLedgerList">
    ${items.length?items.map(l=>`
      <div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--g100)">
        <div style="width:36px;height:36px;border-radius:8px;background:${l.type==='in'?'var(--ok-bg)':'var(--bad-bg)'};display:flex;align-items:center;justify-content:center;font-size:.9rem;flex-shrink:0">${l.type==='in'?'💰':'📤'}</div>
        <div style="flex:1;min-width:0">
          <div style="font-size:.85rem;font-weight:700;color:var(--g700)">${esc(l.desc||l.cat||'記錄')}</div>
          <div style="font-size:.72rem;color:var(--g400)">${l.date||''} ${l.cat?' · '+esc(l.cat):''}</div>
        </div>
        <div style="font-weight:900;color:${l.type==='in'?'var(--ok)':'var(--bad)'};font-size:.95rem">${l.type==='in'?'+':'-'}NT$${(l.amount||0).toLocaleString()}</div>
      </div>`).join(''):'<div class="empty-state"><div class="es-ic">💰</div><div class="es-t">尚無帳款紀錄</div></div>'}
    </div>`;
}

function openProjLedgerModal(projectId, dir){
  curProjectId=projectId;
  const p=getProject(projectId);
  curLedgerBook=dir==='in'?'in':'out';
  curLedgerType=dir;
  openLedgerModal(curLedgerBook);
  // 預填案場
  setTimeout(()=>{
    const ldCase=document.getElementById('ldCase');
    if(ldCase&&p) ldCase.value=p.name||'';
  }, 100);
}

// ── 案場進度 Tab ──────────────────────────────────────────
function renderProjProgress(id,p,c){
  const items=DB.get('progress').filter(r=>r.projectId===id).sort((a,b)=>a._id-b._id);
  const nextItem=items.find(x=>!x.done);

  c.innerHTML=`
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
      <div style="font-weight:800;color:var(--g700)">工程進度</div>
      <button class="btn bg bsm" onclick="openAddProgressEntry(${id})">📷 新增進度</button>
    </div>
    ${nextItem?`<div style="display:flex;align-items:center;gap:12px;padding:14px 16px;background:var(--gold-pale);border:1.5px solid var(--gold-l);border-radius:var(--r);margin-bottom:18px">
      <span style="font-size:1.4rem">👉</span>
      <div><div style="font-size:.7rem;font-weight:900;color:var(--gold-d);letter-spacing:.06em">下一步</div><div style="font-weight:800;color:var(--g800);font-size:.92rem">${esc(nextItem.text)}</div></div>
    </div>`:''}
    <div style="position:relative;padding-left:20px">
      ${items.length?items.map((item,i)=>`
        <div style="position:relative;margin-bottom:20px">
          <div style="position:absolute;left:-20px;top:4px;width:12px;height:12px;border-radius:50%;background:${item.done?'var(--ok)':'var(--gold)'};border:2px solid var(--w);box-shadow:var(--sh1)"></div>
          ${i<items.length-1?`<div style="position:absolute;left:-14px;top:16px;width:1px;height:calc(100% + 4px);background:var(--g200)"></div>`:''}
          <div class="card" style="padding:12px 14px">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">
              <div style="min-width:0">
                <div style="font-weight:800;font-size:.88rem">${esc(item.text||item.name||'進度')}</div>
                <div style="font-size:.72rem;color:var(--g400);margin-top:2px">${item.date||''}</div>
              </div>
              <div style="display:flex;gap:6px;flex-shrink:0;align-items:center">
                <span style="font-size:.72rem;padding:2px 8px;border-radius:20px;background:${item.done?'var(--ok-bg)':'var(--warn-bg)'};color:${item.done?'var(--ok)':'var(--warn)'};white-space:nowrap">${item.done?'✅ 完成':'進行中'}</span>
                <button onclick="openAddProgressEntry(${id},${item._id})" style="background:none;border:none;color:var(--g300);cursor:pointer;font-size:.85rem;padding:2px">✏️</button>
                <button onclick="deleteProgressEntry(${item._id},${id})" style="background:none;border:none;color:var(--g300);cursor:pointer;font-size:.85rem;padding:2px">🗑</button>
              </div>
            </div>
            ${item.note?`<div style="font-size:.78rem;color:var(--g500);margin-top:6px">${esc(item.note)}</div>`:''}
            ${item.photoUrl?`<img src="${item.photoUrl}" onclick="openLB('${item.photoUrl}')" style="max-width:100%;max-height:200px;border-radius:var(--rxs);margin-top:8px;cursor:pointer;object-fit:cover">`:''}
          </div>
        </div>`).join(''):'<div class="empty-state"><div class="es-ic">🔨</div><div class="es-t">尚無進度記錄</div><div class="es-s">拍張現場照片，記錄今天做到哪</div></div>'}
    </div>`;
}

function openProgressForProject(projectId){
  openAddProgressEntry(projectId);
}

// ══ 案場進度記錄（含照片上傳）══════════════════════════════
// 注意：這是「進度」分頁專用的簡易記錄，跟舊的「行政→工程進度」整案清單勾選表是不同系統，
// 各自對應不同用途，這裡只處理案場詳情頁的進度時間軸（也是業主端QR Code看到的內容）
function openAddProgressEntry(projectId, editId){
  const p=getProject(projectId);if(!p)return;
  const existing=editId?DB.get('progress').find(r=>r._id===editId):null;

  const old=document.getElementById('_progBox');if(old)old.remove();
  const box=document.createElement('div');
  box.id='_progBox';
  box.style.cssText='position:fixed;inset:0;background:rgba(15,20,15,.4);z-index:9600;display:flex;align-items:center;justify-content:center;padding:20px';
  box.innerHTML=`<div style="background:var(--w);border-radius:var(--r);padding:22px 24px;max-width:420px;width:100%;box-shadow:0 12px 40px rgba(0,0,0,.25);max-height:88vh;overflow-y:auto" onclick="event.stopPropagation()">
    <div style="font-weight:800;font-size:.98rem;color:var(--g800);margin-bottom:4px">${editId?'✏️ 編輯進度':'🔨 新增工程進度'}</div>
    <div style="font-size:.78rem;color:var(--g400);margin-bottom:16px">${esc(p.name)}</div>

    <input type="text" id="_progText" placeholder="例：水電配管完成、木作進場…" value="${existing?esc(existing.text||''):''}" style="width:100%;padding:11px 14px;border:1.5px solid var(--g200);border-radius:var(--rs);font-size:.9rem;font-family:inherit;margin-bottom:10px;box-sizing:border-box">
    <input type="date" id="_progDate" value="${existing?existing.date||'':new Date().toISOString().split('T')[0]}" style="width:100%;padding:10px 14px;border:1.5px solid var(--g200);border-radius:var(--rs);font-size:.85rem;font-family:inherit;margin-bottom:10px;box-sizing:border-box">
    <textarea id="_progNote" placeholder="補充說明（選填，業主也看得到）" rows="2" style="width:100%;padding:10px 14px;border:1.5px solid var(--g200);border-radius:var(--rs);font-size:.85rem;font-family:inherit;margin-bottom:10px;box-sizing:border-box;resize:none">${existing?esc(existing.note||''):''}</textarea>

    <div style="margin-bottom:10px">
      <div id="_progPhotoZone" style="border:2px dashed var(--g200);border-radius:var(--rs);padding:16px;text-align:center;cursor:pointer;transition:border-color var(--ease)">
        <div id="_progPhotoPreview" style="${existing?.photoUrl?'':'display:none'}margin-bottom:8px">
          <img src="${existing?.photoUrl||''}" style="max-width:100%;max-height:160px;border-radius:var(--rxs);object-fit:cover">
        </div>
        <div id="_progPhotoHint" style="font-size:.82rem;color:var(--g400)${existing?.photoUrl?';display:none':''}">📷 點這裡上傳現場照片（選填，業主可以看到）</div>
      </div>
      <input type="file" id="_progPhotoFile" accept="image/*" style="display:none">
    </div>

    <label style="display:flex;align-items:center;gap:9px;font-size:.86rem;color:var(--g600);cursor:pointer;margin-bottom:16px">
      <input type="checkbox" id="_progDone" ${existing?.done?'checked':''} style="width:17px;height:17px;cursor:pointer;accent-color:var(--ok)"> 這個項目已經完成
    </label>

    <div style="display:flex;gap:8px">
      <button id="_progCancel" style="flex:1;padding:11px;border:1.5px solid var(--g200);border-radius:var(--rs);background:none;color:var(--g500);font-size:.86rem;cursor:pointer;font-family:inherit">取消</button>
      <button id="_progSave" style="flex:2;padding:11px;border:none;border-radius:var(--rs);background:var(--gold-d);color:#fff;font-weight:700;font-size:.86rem;cursor:pointer;font-family:inherit">💾 儲存</button>
    </div>
  </div>`;
  box.addEventListener('click',()=>box.remove());
  document.body.appendChild(box);

  let photoUrl=existing?.photoUrl||null;
  const zone=document.getElementById('_progPhotoZone');
  const fileInp=document.getElementById('_progPhotoFile');
  zone.addEventListener('click',()=>fileInp.click());
  fileInp.addEventListener('change',async e=>{
    const f=e.target.files[0];if(!f)return;
    zone.querySelector('#_progPhotoHint').textContent='壓縮處理中…';
    const compressed=await compressImage(f,1280,0.7);
    photoUrl=compressed;
    const prev=document.getElementById('_progPhotoPreview');
    prev.style.display='block';prev.querySelector('img').src=photoUrl;
    document.getElementById('_progPhotoHint').style.display='none';
  });

  document.getElementById('_progCancel').addEventListener('click',()=>box.remove());
  document.getElementById('_progSave').addEventListener('click',()=>{
    const text=document.getElementById('_progText').value.trim();
    if(!text){showToast('⚠️ 請填入進度說明');return;}
    const data={
      projectId,text,
      date:document.getElementById('_progDate').value,
      note:document.getElementById('_progNote').value.trim(),
      done:document.getElementById('_progDone').checked,
      photoUrl,
    };
    if(editId){DB.upd('progress',editId,data);showToast('✅ 進度已更新');}
    else{DB.push('progress',{...data,summary:'進度 '+p.name+' '+text});showToast('✅ 進度已新增');}
    box.remove();
    renderProjectDetail(projectId,'progress');
  });
}

function deleteProgressEntry(id,projectId){
  confirmAction('刪除這筆進度記錄？',()=>{
    DB.del('progress',id);
    renderProjectDetail(projectId,'progress');
    showToast('✅ 已刪除');
  });
}

// ══ 工班付款管理（參考 QuickBooks 帳單付款）══════════════
// vendors 資料不變，新增 payments 陣列記錄付款歷史
function getVendorPaid(v){
  return (v.payments||[]).reduce((s,p)=>s+(p.amount||0),0);
}
function getVendorPayStatus(v){
  const paid=getVendorPaid(v);
  const total=v.amount||0;
  if(paid<=0)return {label:'未付款',color:'var(--bad)',bg:'var(--bad-bg)',bd:'var(--bad-bd)'};
  if(paid<total)return {label:'部分付款',color:'var(--warn)',bg:'var(--warn-bg)',bd:'var(--warn-bd)'};
  return {label:'已付清',color:'var(--ok)',bg:'var(--ok-bg)',bd:'var(--ok-bd)'};
}

// 開啟付款視窗
let _payVendorId=null;
function openVendorPay(vendorId){
  _payVendorId=vendorId;
  const v=DB.get('vendors').find(r=>r._id===vendorId);if(!v)return;
  const paid=getVendorPaid(v);
  const remain=(v.amount||0)-paid;

  const old=document.getElementById('_payBox');if(old)old.remove();
  const box=document.createElement('div');
  box.id='_payBox';
  box.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:9500;display:flex;align-items:center;justify-content:center;padding:20px';
  box.innerHTML=`
   <div style="background:var(--w);border-radius:var(--rl);padding:24px;max-width:420px;width:100%;box-shadow:var(--sh4)" onclick="event.stopPropagation()">
    <div style="font-size:1.05rem;font-weight:900;color:var(--g800);margin-bottom:4px">💳 付款給 ${esc(v.vendor||'廠商')}</div>
    <div style="font-size:.8rem;color:var(--g400);margin-bottom:16px">${esc(v.cat||'')} ${v.caseN?'· '+esc(v.caseN):''}</div>

    <div style="background:var(--g50);border-radius:var(--rs);padding:14px;margin-bottom:16px">
     <div style="display:flex;justify-content:space-between;font-size:.85rem;margin-bottom:6px"><span style="color:var(--g500)">報價總額</span><span style="font-weight:800">NT$${(v.amount||0).toLocaleString()}</span></div>
     <div style="display:flex;justify-content:space-between;font-size:.85rem;margin-bottom:6px"><span style="color:var(--g500)">已付</span><span style="font-weight:800;color:var(--ok)">NT$${paid.toLocaleString()}</span></div>
     <div style="display:flex;justify-content:space-between;font-size:.9rem;padding-top:8px;border-top:1px solid var(--g200)"><span style="font-weight:800">尚欠</span><span style="font-weight:900;color:var(--bad)">NT$${remain.toLocaleString()}</span></div>
    </div>

    <div style="font-size:.78rem;font-weight:800;color:var(--g500);margin-bottom:8px">這次付多少？</div>
    <div style="display:flex;gap:6px;margin-bottom:10px;flex-wrap:wrap">
     <button onclick="document.getElementById('_payAmt').value=${Math.round(remain*0.3)}" style="padding:6px 12px;border:1.5px solid var(--g200);border-radius:20px;background:var(--w);font-size:.78rem;cursor:pointer;font-family:inherit">3成 NT$${Math.round(remain*0.3).toLocaleString()}</button>
     <button onclick="document.getElementById('_payAmt').value=${Math.round(remain*0.5)}" style="padding:6px 12px;border:1.5px solid var(--g200);border-radius:20px;background:var(--w);font-size:.78rem;cursor:pointer;font-family:inherit">5成 NT$${Math.round(remain*0.5).toLocaleString()}</button>
     <button onclick="document.getElementById('_payAmt').value=${remain}" style="padding:6px 12px;border:1.5px solid var(--gold-l);border-radius:20px;background:var(--gold-pale);color:var(--gold-d);font-size:.78rem;cursor:pointer;font-family:inherit;font-weight:800">付清 NT$${remain.toLocaleString()}</button>
    </div>
    <input type="number" id="_payAmt" placeholder="輸入金額" value="${remain}" style="width:100%;padding:12px 14px;border:1.5px solid var(--g200);border-radius:var(--rs);font-size:1rem;font-family:monospace;font-weight:700;margin-bottom:10px;box-sizing:border-box">
    <input type="text" id="_payNote" placeholder="備注（例：第二期款）" style="width:100%;padding:10px 14px;border:1.5px solid var(--g200);border-radius:var(--rs);font-size:.85rem;font-family:inherit;margin-bottom:16px;box-sizing:border-box">

    <div style="display:flex;gap:8px">
     <button onclick="document.getElementById('_payBox').remove()" style="flex:1;padding:12px;border:1.5px solid var(--g200);border-radius:var(--rs);background:none;color:var(--g500);font-size:.9rem;cursor:pointer;font-family:inherit">取消</button>
     <button onclick="confirmVendorPay()" style="flex:2;padding:12px;border:none;border-radius:var(--rs);background:var(--gold);color:#fff;font-size:.9rem;font-weight:800;cursor:pointer;font-family:inherit">✅ 確認付款並記帳</button>
    </div>
   </div>`;
  box.addEventListener('click',e=>{if(e.target===box)box.remove();});
  document.body.appendChild(box);
}

function confirmVendorPay(){
  const v=DB.get('vendors').find(r=>r._id===_payVendorId);if(!v)return;
  const amt=parseInt(document.getElementById('_payAmt')?.value)||0;
  if(amt<=0){showToast('⚠️ 請輸入付款金額');return;}
  const note=document.getElementById('_payNote')?.value?.trim()||'';
  const today=new Date().toISOString().split('T')[0];

  // 1. 記錄到廠商付款歷史
  const payments=[...(v.payments||[]),{amount:amt,date:today,note}];
  const totalPaid=payments.reduce((s,p)=>s+(p.amount||0),0);
  DB.upd('vendors',v._id,{payments,paid:totalPaid>=(v.amount||0)});

  // 2. 自動記入內帳支出（雙式記帳，這是 ERP 核心）
  DB.push('ledger',{
    summary:'內帳支出 付款給'+(v.vendor||'廠商')+' '+fmt(amt),
    book:'out',type:'out',amount:amt,
    desc:'付款給 '+(v.vendor||'廠商')+(note?'（'+note+'）':''),
    cat:'廠商費用',date:today,
    caseN:v.caseN||'',projectId:v.projectId||null,
    vendorId:v._id,
  });

  document.getElementById('_payBox')?.remove();
  showToast('✅ 已付款 NT$'+amt.toLocaleString()+'，並自動記入內帳');
  if(typeof renderVendors==='function')renderVendors(vCurrentFilter);
  if(typeof renderLedger==='function')renderLedger();
  if(typeof renderDashboard==='function')renderDashboard();
}

// ══ 雜項快速記帳（3 秒完成）═══════════════════════════════
function quickExpense(cat){
  const old=document.getElementById('_qeBox');if(old)old.remove();
  const box=document.createElement('div');
  box.id='_qeBox';
  box.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:9500;display:flex;align-items:center;justify-content:center;padding:20px';
  const icons={'材料費':'🧱','工資':'👷','雜項':'📦','交通油錢':'⛽'};
  const projects=DB.get('projects').filter(p=>p.status==='progress'||p.status==='signed');
  box.innerHTML=`
   <div style="background:var(--w);border-radius:var(--rl);padding:24px;max-width:380px;width:100%;box-shadow:var(--sh4)" onclick="event.stopPropagation()">
    <div style="font-size:1.05rem;font-weight:900;color:var(--g800);margin-bottom:16px">${icons[cat]||'💸'} 記一筆${cat}</div>
    <input type="number" id="_qeAmt" placeholder="金額" autofocus style="width:100%;padding:14px;border:1.5px solid var(--gold-l);border-radius:var(--rs);font-size:1.3rem;font-family:monospace;font-weight:800;margin-bottom:10px;box-sizing:border-box;text-align:center">
    <input type="text" id="_qeNote" placeholder="說明（選填）" style="width:100%;padding:10px 14px;border:1.5px solid var(--g200);border-radius:var(--rs);font-size:.85rem;font-family:inherit;margin-bottom:10px;box-sizing:border-box">
    <select id="_qeProj" style="width:100%;padding:10px 14px;border:1.5px solid var(--g200);border-radius:var(--rs);font-size:.85rem;font-family:inherit;margin-bottom:16px;box-sizing:border-box;background:var(--w);cursor:pointer">
     <option value="">不指定案場</option>
     ${projects.map(p=>'<option value="'+p._id+'">'+esc(p.name)+'</option>').join('')}
    </select>
    <div style="display:flex;gap:8px">
     <button onclick="document.getElementById('_qeBox').remove()" style="flex:1;padding:12px;border:1.5px solid var(--g200);border-radius:var(--rs);background:none;color:var(--g500);font-size:.9rem;cursor:pointer;font-family:inherit">取消</button>
     <button onclick="saveQuickExpense('${cat}')" style="flex:2;padding:12px;border:none;border-radius:var(--rs);background:var(--gold);color:#fff;font-size:.9rem;font-weight:800;cursor:pointer;font-family:inherit">💾 記帳</button>
    </div>
   </div>`;
  box.addEventListener('click',e=>{if(e.target===box)box.remove();});
  document.body.appendChild(box);
  setTimeout(()=>document.getElementById('_qeAmt')?.focus(),100);
}

function saveQuickExpense(cat){
  const amt=parseInt(document.getElementById('_qeAmt')?.value)||0;
  if(amt<=0){showToast('⚠️ 請輸入金額');return;}
  const note=document.getElementById('_qeNote')?.value?.trim()||'';
  const projId=document.getElementById('_qeProj')?.value||null;
  DB.push('ledger',{
    summary:'內帳支出 '+cat+' '+fmt(amt),
    book:'out',type:'out',amount:amt,
    desc:note||cat,cat:cat==='交通油錢'?'其他支出':cat,
    date:new Date().toISOString().split('T')[0],
    projectId:projId?parseInt(projId):null,
  });
  document.getElementById('_qeBox')?.remove();
  showToast('✅ 已記帳 NT$'+amt.toLocaleString());
  if(typeof renderLedger==='function')renderLedger();
  if(typeof renderDashboard==='function')renderDashboard();
}


// ══ 分享給業主（產生 QR Code + 連結）════════════════════
function shareProjectToClient(id){
  const p=getProject(id);if(!p)return;
  // 確保有 token
  if(!p.token){
    const token='zj'+Math.random().toString(36).slice(2,10)+Date.now().toString(36).slice(-4);
    DB.upd('projects',id,{token});
  }
  renderShareBox(id);
}

function renderShareBox(id){
  const p=getProject(id);if(!p)return;
  const base=location.origin+location.pathname.replace(/[^/]*$/,'');
  const url=base+'client.html?c='+p.token;

  const old=document.getElementById('_shareBox');if(old)old.remove();
  const box=document.createElement('div');
  box.id='_shareBox';
  box.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:9500;display:flex;align-items:center;justify-content:center;padding:20px';
  box.innerHTML=`
   <div style="background:var(--w);border-radius:var(--rl);padding:26px;max-width:400px;width:100%;box-shadow:var(--sh4);text-align:center" onclick="event.stopPropagation()">
    <div style="font-size:1.1rem;font-weight:900;color:var(--g800);margin-bottom:4px">📱 分享給業主</div>
    <div style="font-size:.82rem;color:var(--g400);margin-bottom:18px">${esc(p.name)}</div>
    <div id="_qrImg" style="width:200px;height:200px;margin:0 auto 18px;background:var(--g50);border-radius:var(--rs);display:flex;align-items:center;justify-content:center;padding:10px"></div>
    <div style="font-size:.78rem;color:var(--g500);margin-bottom:8px;text-align:left;font-weight:700">業主專屬連結</div>
    <div style="display:flex;gap:6px;margin-bottom:12px">
      <input id="_shareUrl" readonly value="${url}" style="flex:1;padding:10px 12px;border:1.5px solid var(--g200);border-radius:var(--rs);font-size:.78rem;font-family:monospace;background:var(--g50);color:var(--g600);min-width:0">
      <button onclick="navigator.clipboard.writeText('${url}').then(()=>showToast('✅ 已複製連結'))" style="padding:10px 14px;border:none;border-radius:var(--rs);background:var(--gold);color:#fff;font-weight:800;cursor:pointer;font-family:inherit;white-space:nowrap">複製</button>
    </div>
    <button id="_shareRegenBtn" style="width:100%;padding:9px;border:1.5px solid var(--bad-bd);border-radius:var(--rs);background:var(--bad-bg);color:var(--bad);font-size:.8rem;font-weight:700;cursor:pointer;font-family:inherit;margin-bottom:16px">🔄 重新產生連結（舊連結會立刻失效）</button>
    <div style="font-size:.72rem;color:var(--g400);margin-bottom:16px;text-align:left;line-height:1.5">💡 業主打開連結就能看到：施工進度、收款紀錄、合約摘要。<br>看不到你的成本內帳，安全放心。</div>
    <button onclick="document.getElementById('_shareBox').remove()" style="width:100%;padding:11px;border:1.5px solid var(--g200);border-radius:var(--rs);background:none;color:var(--g500);font-size:.9rem;cursor:pointer;font-family:inherit">關閉</button>
   </div>`;
  box.addEventListener('click',e=>{if(e.target===box)box.remove();});
  document.body.appendChild(box);

  document.getElementById('_shareRegenBtn').addEventListener('click',()=>{
    confirmAction('重新產生連結後，舊的QR Code和連結會立刻失效，業主要重新掃新的才看得到進度。確定要換一組嗎？',()=>{
      const newToken='zj'+Math.random().toString(36).slice(2,10)+Date.now().toString(36).slice(-4);
      DB.upd('projects',id,{token:newToken});
      showToast('✅ 已產生新連結，記得重新傳給業主');
      renderShareBox(id);
    });
  });

  // 產生 QR Code（用免費 QR API）
  const qrDiv=document.getElementById('_qrImg');
  if(qrDiv){
    const img=document.createElement('img');
    img.src='https://api.qrserver.com/v1/create-qr-code/?size=200x200&margin=0&data='+encodeURIComponent(url);
    img.style.cssText='width:100%;height:100%;object-fit:contain';
    img.alt='QR Code';
    img.onerror=()=>{qrDiv.innerHTML='<div style="font-size:.75rem;color:var(--g400)">QR 產生失敗<br>請直接複製連結</div>';};
    qrDiv.innerHTML='';qrDiv.appendChild(img);
  }
}
