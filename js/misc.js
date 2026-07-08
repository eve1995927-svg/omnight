function exportBackup(){
  const keys=['projects','quotes','vendors','invoices','contracts','progress','ledger','billing','employees','punch_recs','punch_requests','clients','post_history'];
  const backup={version:'v14',date:new Date().toLocaleString('zh-TW'),data:{}};
  keys.forEach(k=>backup.data[k]=DB.get(k));
  backup.settings={pts:localStorage.getItem('zeju_pts'),bank:localStorage.getItem('zeju_bank_acct'),payDate:localStorage.getItem('zeju_pay_date')};
  backup.companyProfile=typeof getCompanyProfile==='function'?getCompanyProfile():null;
  const blob=new Blob([JSON.stringify(backup,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob);
  const companyName=(typeof getCompanyProfile==='function'?getCompanyProfile().name:'')||'案場通';
  const a=document.createElement('a');a.href=url;a.download=companyName+'備份_'+new Date().toLocaleDateString('zh-TW').replace(/\//g,'')+'.json';
  a.click();URL.revokeObjectURL(url);
  showToast('✅ 資料備份完成！');
}
function importBackup(input){
  const file=input.files[0];if(!file)return;
  const reader=new FileReader();
  reader.onload=e=>{
    try{
      const backup=JSON.parse(e.target.result);
      if(!backup.data)throw new Error('格式不正確');
      confirmAction('確定還原備份？現有資料將被覆蓋，此動作無法復原！',()=>{
        Object.entries(backup.data).forEach(([k,v])=>DB.set(k,v));
        if(backup.settings){
          if(backup.settings.pts)localStorage.setItem('zeju_pts',backup.settings.pts);
          if(backup.settings.bank)localStorage.setItem('zeju_bank_acct',backup.settings.bank);
          if(backup.settings.payDate)localStorage.setItem('zeju_pay_date',backup.settings.payDate);
        }
        if(backup.companyProfile&&typeof saveCompanyProfile==='function'){
          saveCompanyProfile(backup.companyProfile);
        }
        showToast('✅ 資料還原完成！即將重新整理…');
        setTimeout(()=>location.reload(),2000);
      });
    }catch(err){showToast('❌ 備份格式錯誤：'+err.message);}
  };
  reader.readAsText(file);
  input.value='';
}

// ══ Modal 事件委派 ══
document.addEventListener('click',function(e){
  const cb=e.target.closest('[data-close]');
  if(cb){closeModal(cb.dataset.close);return;}
  const mcl=e.target.closest('.mcl');
  if(mcl){const mov=mcl.closest('.mov');if(mov)mov.classList.remove('show');return;}
  if(e.target.classList?.contains('mov')){e.target.classList.remove('show');return;}
  // lightbox：僅 ✕ 按鈕可關閉（避免滑動瀏覽圖片時誤觸背景而關閉）
  if(e.target.id==='lbx'||e.target.closest('#lbx')){
    document.getElementById('lb')?.classList.remove('show');return;
  }
});

// ══ 合約上傳（用函式確保 DOM 已載入）══════════════════════
function initContractListeners(){
  function bind(id,evt,fn){
    const el=document.getElementById(id);
    if(el&&!el['_b_'+evt]){el['_b_'+evt]=true;el.addEventListener(evt,fn);}
  }
  bind('ctZone','click',()=>document.getElementById('ctFile')?.click());
  bind('ctFile','change',async e=>{
    const files=Array.from(e.target.files);if(!files.length)return;e.target.value='';
    if(!Array.isArray(ctImgUrl))ctImgUrl=[];
    const rf=async f=>{
      // 圖片先壓縮再存，PDF/其他檔案原樣保留
      if(f.type.startsWith('image/')){
        const compressed=await compressImage(f,1600,0.75);
        return {name:f.name,type:'image/jpeg',url:compressed||await new Promise(res=>{const rd=new FileReader();rd.onload=ev=>res(ev.target.result);rd.readAsDataURL(f);})};
      }
      return new Promise(res=>{const rd=new FileReader();rd.onload=ev=>res({name:f.name,type:f.type,url:ev.target.result});rd.readAsDataURL(f);});
    };
    ctImgUrl.push(...await Promise.all(files.map(rf)));
    renderCtPhotos();
  });
  bind('ctDelFile','click',()=>{
    ctImgUrl=[];
    const fc=document.getElementById('ctFileCard');if(fc)fc.style.display='none';
    const fi=document.getElementById('ctFile');if(fi)fi.value='';
    const grid=document.getElementById('ctPhotoGrid');if(grid)grid.innerHTML='';
  });
  bind('openContract','click',()=>{
    ctEditId=null;ctImgUrl=[];
    ['ctName','ctClient','ctAmt2','ctNote'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
    const stEl=document.getElementById('ctStatus');if(stEl)stEl.value='pending';
    const fcEl=document.getElementById('ctFileCard');if(fcEl)fcEl.style.display='none';
    const cfEl=document.getElementById('ctFile');if(cfEl)cfEl.value='';
    const btn=document.getElementById('addCtBtn');if(btn)btn.textContent='💾 儲存合約';
    const nte=document.getElementById('ctEditNote');if(nte)nte.style.display='none';
    openModal('contractModal');
  });
  bind('addCtBtn','click',()=>{
    const name=(document.getElementById('ctName')?.value||'').trim();
    const client=(document.getElementById('ctClient')?.value||'').trim();
    const amt=parseInt(document.getElementById('ctAmt2')?.value||0)||0;
    const status=document.getElementById('ctStatus')?.value||'pending';
    const note=(document.getElementById('ctNote')?.value||'').trim();
    if(!name){showToast('⚠️ 請填入合約名稱');return;}
    const fileUrls=Array.isArray(ctImgUrl)?ctImgUrl:(ctImgUrl?[ctImgUrl]:[]);
    if(ctEditId){
      DB.upd('contracts',ctEditId,{name,client,amount:amt,status,note,fileUrls,fileUrl:fileUrls[0]?.url||null,summary:'合約 '+name+' '+client});
      ctEditId=null;showToast('✅ 合約已更新！');
    }else{
      const newCt=DB.push('contracts',{summary:'合約 '+name+' '+client,name,client,amount:amt,status,note,projectId:curProjectId||null,fileUrls,fileUrl:fileUrls[0]?.url||null})[0];
      if(newCt){DB.push('progress',{summary:'進度 '+name,caseN:name,client,contractId:newCt._id,status:'pending',items:[{text:'合約簽訂',done:true,date:new Date().toLocaleDateString('zh-TW')},{text:'開工日期確認',done:false,date:''},{text:'施工進行中',done:false,date:''},{text:'驗收',done:false,date:''},{text:'結案',done:false,date:''}]});}
      showToast('✅ 合約已儲存！');
    }
    closeModal('contractModal');renderContracts();updContractStats();
    const btn=document.getElementById('addCtBtn');if(btn)btn.textContent='💾 儲存合約';
  });
}

// ══ 發票上傳 AI 辨識 ══════════════════════════════════════
document.getElementById('invZone')?.addEventListener('click',()=>document.getElementById('invFile')?.click());
document.getElementById('invFile')?.addEventListener('change',async e=>{
  const f=e.target.files[0];if(!f)return;e.target.value='';
  const rd=new FileReader();
  rd.onload=async ev=>{
    invImgUrl=ev.target.result;
    const fc=document.getElementById('invFileCard');if(fc)fc.style.display='block';
    const th=document.getElementById('invThumb');
    if(th&&f.type.startsWith('image/')){th.src=invImgUrl;th.onclick=()=>openLB(invImgUrl);th.style.display='block';}
    const fn=document.getElementById('invFileName');if(fn)fn.textContent=f.name;
    const fs=document.getElementById('invFileStatus');if(fs)fs.textContent='已上傳';
    const fa=document.getElementById('invFormArea');if(fa)fa.style.display='block';
    const dt=document.getElementById('invDt');if(dt&&!dt.value)dt.value=new Date().toISOString().split('T')[0];
    const ocr=document.getElementById('ocrProg');if(ocr)ocr.classList.add('show');
    try{
      const b64=invImgUrl.split(',')[1],mime=f.type.startsWith('image/')?f.type:'application/pdf';
      const isImg=f.type.startsWith('image/');
      const parts=[
        isImg?{type:'image',source:{type:'base64',media_type:mime,data:b64}}:
              {type:'document',source:{type:'base64',media_type:'application/pdf',data:b64}},
        {type:'text',text:'請辨識這張發票的所有資訊，只回覆純JSON（不加```）：{"no":"發票號碼","date":"YYYY-MM-DD","amount":含稅總金額數字,"desc":"開立單位或說明","items":[{"name":"費用項目","qty":數量,"amount":金額數字}]}。無法辨識的填空字串或0。'}
      ];
      const rep=await callAI('ac',parts,3000);
      const dat=JSON.parse(rep.replace(/```json|```/g,'').trim());
      if(dat.no){const el=document.getElementById('invNo');if(el)el.value=dat.no;}
      if(dat.date){const el=document.getElementById('invDt');if(el)el.value=dat.date;}
      if(dat.amount){const el=document.getElementById('invAmt');if(el)el.value=dat.amount;}
      if(dat.desc){const el=document.getElementById('invDesc');if(el)el.value=dat.desc;}
      if(dat.items&&dat.items.length){invIItems=dat.items.map(x=>({...x}));renderInvItems();}
      if(fs)fs.textContent='✅ AI辨識完成，請確認';
      const ok=document.getElementById('ocrOk');if(ok)ok.style.display='block';
      updInvTotal();
    }catch(err){
      const fs2=document.getElementById('invFileStatus');
      if(fs2)fs2.textContent='AI辨識失敗，請手動填寫（'+friendlyAIError(err).replace('⚠️ ','')+'）';
    }
    const ocr2=document.getElementById('ocrProg');if(ocr2)ocr2.classList.remove('show');
  };rd.readAsDataURL(f);
});
document.getElementById('invDelFile')?.addEventListener('click',()=>{
  invImgUrl=null;invIItems=[];
  const fc=document.getElementById('invFileCard');if(fc)fc.style.display='none';
  const fa=document.getElementById('invFormArea');if(fa)fa.style.display='none';
  const ok=document.getElementById('ocrOk');if(ok)ok.style.display='none';
  const fi=document.getElementById('invFile');if(fi)fi.value='';
  document.getElementById('invItemsTable')&&(document.getElementById('invItemsTable').innerHTML='');
  document.getElementById('invTotalShow')&&(document.getElementById('invTotalShow').textContent='NT$0');
});
document.getElementById('qSave')?.addEventListener('click',()=>{
  const n=document.getElementById('qN')?.value||'業主';
  const tp=document.getElementById('qTp')?.value||'全室裝修';
  const sub=calcAll(qSections);
  const savedQ=DB.push('quotes',{summary:'報價 '+n+' '+sub,name:n,type:tp,projectId:curProjectId||null,sections:JSON.parse(JSON.stringify(qSections)),total:sub});
  updStats();renderQTable();
  // 下一步提示
  if(typeof showNextStep==='function'){
    showNextStep('報價單已儲存！下一步呢？',[
      {label:'🏗️ 新增為案場',action:()=>{
        if(typeof openAddProject==='function'){
          openAddProject();
          setTimeout(()=>{
            const pN=document.getElementById('projName');if(pN)pN.value=n;
            const pC=document.getElementById('projClient');if(pC)pC.value=n;
            const pT=document.getElementById('projType');if(pT)pT.value=tp||'全室翻新';
          },200);
        }
      }},
      {label:'📤 下載 Excel 給業主',action:()=>dlXls(n,tp,qSections,'client')},
      {label:'稍後再說',action:()=>{}},
    ]);
  } else {
    showToast('✅ 已儲存！');
  }
});
// ══ 行銷圖片生成 ═════════════════════════════════════════
async function genMktImg(){
  const sp=document.getElementById('imgSp');if(sp)sp.classList.add('show');
  document.getElementById('imgPreviewWrap').style.display='none';
  const postText=document.getElementById('pstBd')?.textContent||'';
  const caption=document.getElementById('imgCaption')?.value||'';
  const style=curImgStyle||'luxury';
  // 先顯示 fallback
  const canvas=document.getElementById('mkImgCanvas');
  if(canvas)canvas.innerHTML=genDefaultSvg(style,postText);
  const wrap=document.getElementById('imgPreviewWrap');if(wrap)wrap.style.display='block';
  // proxy 處理 API Key，無需前端檢查
  const styleDesc={
    luxury:'高端輕奢，深色背景，金色線條，精緻幾何',
    minimal:'日式極簡，米白淺灰，黑色細線，大量留白',
    warm:'溫暖自然，深棕暖橘，木質感線條',
    modern:'現代科技感，深夜藍，藍色發光線條，幾何切割',
  }[style]||'高端質感';
  const postClean=postText.replace(/#[^ ]*/g,'').trim();
  const tagline=postClean.substring(0,postClean.indexOf('。')>0?postClean.indexOf('。'):20)||'打造理想居家空間';
  const prompt=`你是SVG圖片生成器。請輸出一個完整的行銷SVG圖，不要任何說明文字。
要求：viewBox="0 0 640 640"，風格：${styleDesc}，右上角「澤居」金色大字，副標ZEJU INTERIOR，中央精美室內設計幾何圖，底部標語「${tagline}」${caption?'，特別要求：'+caption:''}。
直接輸出SVG，從<svg開始，以</svg>結束。`;
  try{
    const r=await fetch('/.netlify/functions/ai-proxy', { method:'POST', headers:{'Content-Type':'application/json'},
      body:JSON.stringify({model:'claude-sonnet-4-6',max_tokens:3000,messages:[{role:'user',content:prompt}]})
    });
    if(!r.ok)throw new Error('api '+r.status);
    const d=await r.json();
    const rep=d.content?.map(c=>c.text||'').join('')||'';
    const svgM=rep.match(/<svg[\s\S]*?<\/svg>/i);
    if(svgM&&svgM[0].length>200&&canvas)canvas.innerHTML=svgM[0];
    // 扣點
    const tu=(d.usage?.input_tokens||0)+(d.usage?.output_tokens||0);
    const pts=Math.min(500,Math.max(1,Math.round(tu/20)));
    POINTS=Math.max(0,POINTS-pts);
    localStorage.setItem('zeju_pts',POINTS);
    if(typeof window.storage!=='undefined')window.storage.set('zeju_pts',String(POINTS)).catch(()=>{});
    const pe=document.getElementById('ptsNum');if(pe)pe.textContent=POINTS.toLocaleString();
  }catch(err){
    console.log('img gen err',err);
    showToast(friendlyAIError(err)+'（已顯示預設圖片）');
  }
  if(sp)sp.classList.remove('show');
}

// ══ 合約多頁照片 ═════════════════════════════════════════
function renderCtPhotos(){
  const photos=Array.isArray(ctImgUrl)?ctImgUrl:[];
  const fc=document.getElementById('ctFileCard');
  const grid=document.getElementById('ctPhotoGrid');
  const cnt=document.getElementById('ctFileCount');
  if(!photos.length){if(fc)fc.style.display='none';return;}
  if(fc)fc.style.display='block';
  if(cnt)cnt.textContent='已上傳 '+photos.length+' 張';
  if(!grid)return;
  grid.innerHTML='';
  photos.forEach((p,i)=>{
    const wrap=document.createElement('div');
    wrap.style.cssText='position:relative;aspect-ratio:3/4;border-radius:var(--rxs);overflow:hidden;background:var(--g100);cursor:pointer;border:1.5px solid var(--g200)';
    const url=p.url||p;
    if(p.type&&p.type.startsWith('image/')||typeof url==='string'&&url.startsWith('data:image')){
      const img=document.createElement('img');
      img.src=url;img.style.cssText='width:100%;height:100%;object-fit:cover';
      img.onclick=()=>openLB(url);wrap.appendChild(img);
    }else{
      wrap.innerHTML='<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:4px"><div style="font-size:1.6rem">📄</div><div style="font-size:.65rem;color:var(--g500);text-align:center;padding:0 4px">'+(p.name||'文件')+'</div></div>';
    }
    const pg=document.createElement('div');
    pg.style.cssText='position:absolute;top:4px;left:4px;background:rgba(0,0,0,.6);color:#fff;font-size:.65rem;font-weight:700;padding:2px 6px;border-radius:10px';
    pg.textContent='P'+(i+1);
    const del=document.createElement('button');
    del.style.cssText='position:absolute;top:4px;right:4px;width:22px;height:22px;background:rgba(0,0,0,.6);border:none;color:#fff;border-radius:50%;cursor:pointer;font-size:.7rem;display:flex;align-items:center;justify-content:center';
    del.textContent='✕';del.onclick=e=>{e.stopPropagation();if(Array.isArray(ctImgUrl))ctImgUrl.splice(i,1);renderCtPhotos();};
    wrap.appendChild(pg);wrap.appendChild(del);grid.appendChild(wrap);
  });
  const addMore=document.createElement('div');
  addMore.style.cssText='aspect-ratio:3/4;border:2px dashed var(--g300);border-radius:var(--rxs);display:flex;flex-direction:column;align-items:center;justify-content:center;cursor:pointer;gap:4px;color:var(--g400);font-size:.75rem;font-weight:700;transition:all var(--ease)';
  addMore.innerHTML='<div style="font-size:1.4rem">＋</div><div>新增</div>';
  addMore.onclick=()=>document.getElementById('ctFile')?.click();
  grid.appendChild(addMore);
}

// ══ 行銷貼文生成 ══════════════════════════════════════════
// ── 行銷貼文：案場選擇 ──────────────────────────────────
function initMkProjectSel(){
  const sel=document.getElementById('mkProject');if(!sel||sel._built)return;
  sel._built=true;
  const projects=DB.get('projects');
  sel.innerHTML='<option value="">不選案場（手動填寫）</option>'+
    projects.map(p=>'<option value="'+p._id+'">'+esc(p.name)+'</option>').join('');
}
function fillMkFromProject(){
  const sel=document.getElementById('mkProject');
  const id=sel?.value;if(!id)return;
  const p=DB.get('projects').find(proj=>String(proj._id)===String(id));if(!p)return;
  const ntEl=document.getElementById('mkNt');
  if(ntEl)ntEl.value=(p.type?p.type+' ':'')+
    (p.address?p.address.slice(0,10)+'完工，':'')+
    (p.client?'業主'+p.client.slice(0,3)+'私宅':'');
}

async function genPost(){
  const pl=document.getElementById('mkPl')?.value||'Instagram';
  const tp=document.getElementById('mkTp')?.value||'案例分享 — 日式風格';
  const sp=document.getElementById('mkSp');if(sp)sp.classList.add('show');
  const p=SYS.mk+'\n\n請幫我寫一篇'+pl+'的'+tp+'行銷貼文，要有吸引力、使用繁體中文、加上適當的emoji和hashtag，大約200字。';
  try{const rep=await callAI('mk',p,3000);showPost(pl,tp,rep);}
  catch(err){
    console.log('genPost err',err);
    showToast(friendlyAIError(err)+'（已套用預設文案，可手動修改）');
    showPost(pl,tp,'✨ 澤居帶你打造理想居家空間！\n\n我們專注台北、新北、桃園的室內裝修，從設計到施工全程陪伴 🏠\n\n#澤居室內裝修 #台北裝修 #室內設計 #統包裝修\n歡迎私訊詢問！');
  }
  if(sp)sp.classList.remove('show');
}

// ══ 打卡月曆 ══════════════════════════════════════════════
let _punchCalYear=new Date().getFullYear();
let _punchCalMonth=new Date().getMonth();
let _punchSelDate=null;

function changePunchMonth(delta){
  _punchCalMonth+=delta;
  if(_punchCalMonth>11){_punchCalMonth=0;_punchCalYear++;}
  if(_punchCalMonth<0){_punchCalMonth=11;_punchCalYear--;}
  renderPunchCal();
}

function renderPunchCal(){
  const grid=document.getElementById('punchCalGrid');
  const lbl=document.getElementById('punchMonthLabel');
  if(!grid)return;
  if(lbl)lbl.textContent=_punchCalYear+'年'+(_punchCalMonth+1)+'月';
  const recs=DB.get('punch_recs').filter(r=>r.user===curPunchUser);
  const today=new Date().toLocaleDateString('zh-TW');
  const recMap={};
  recs.forEach(r=>{if(!recMap[r.date])recMap[r.date]=[];recMap[r.date].push(r);});
  const firstDay=new Date(_punchCalYear,_punchCalMonth,1).getDay();
  const daysInMonth=new Date(_punchCalYear,_punchCalMonth+1,0).getDate();
  grid.innerHTML='';
  const calDiv=document.createElement('div');
  calDiv.style.cssText='display:grid;grid-template-columns:repeat(7,1fr);gap:2px';
  for(let i=0;i<firstDay;i++){const e=document.createElement('div');e.style.height='60px';calDiv.appendChild(e);}
  for(let d=1;d<=daysInMonth;d++){
    const dateObj=new Date(_punchCalYear,_punchCalMonth,d);
    const dateStr=dateObj.toLocaleDateString('zh-TW');
    const dayRecs=recMap[dateStr]||[];
    const hasIn=dayRecs.some(r=>r.type==='in');
    const hasOut=dayRecs.some(r=>r.type==='out');
    const isToday=dateStr===today;
    const isSel=dateStr===_punchSelDate;
    const isFuture=dateObj>new Date();
    const isWeekend=dateObj.getDay()===0||dateObj.getDay()===6;
    const cell=document.createElement('div');
    cell.style.cssText='height:60px;display:flex;flex-direction:column;align-items:center;justify-content:center;border-radius:10px;cursor:'+(isFuture?'default':'pointer')+';transition:all .15s;position:relative;';
    if(isSel){cell.style.background='var(--gold)';cell.style.boxShadow='0 4px 12px rgba(200,164,74,.4)';}
    else if(isToday){cell.style.background='var(--gold-pale)';cell.style.border='2px solid var(--gold)';}
    const dayNum=document.createElement('div');
    dayNum.style.cssText='font-size:1rem;font-weight:'+(isToday||isSel?'900':'500')+';color:'+(isSel?'#fff':isToday?'var(--gold-d)':isFuture?'var(--g200)':isWeekend?'#E53E3E':'var(--g700)');
    dayNum.textContent=d;
    const dots=document.createElement('div');dots.style.cssText='display:flex;gap:2px;margin-top:3px';
    if(hasIn){const d1=document.createElement('div');d1.style.cssText='width:5px;height:5px;border-radius:50%;background:'+(isSel?'#fff':'var(--ok)');dots.appendChild(d1);}
    if(hasOut){const d2=document.createElement('div');d2.style.cssText='width:5px;height:5px;border-radius:50%;background:'+(isSel?'rgba(255,255,255,.7)':'var(--info)');dots.appendChild(d2);}
    else if(hasIn&&!isFuture&&dateStr!==today){const d3=document.createElement('div');d3.style.cssText='width:5px;height:5px;border-radius:50%;background:'+(isSel?'rgba(255,200,0,.8)':'var(--warn)');dots.appendChild(d3);}
    cell.appendChild(dayNum);cell.appendChild(dots);
    if(!isFuture){
      cell.addEventListener('click',()=>{_punchSelDate=dateStr;renderPunchCal();showPunchDayDetail(dateStr,dayRecs);});
      cell.addEventListener('mouseenter',()=>{if(!isSel&&!isToday)cell.style.background='var(--g100)';});
      cell.addEventListener('mouseleave',()=>{if(!isSel&&!isToday)cell.style.background='';});
    }
    calDiv.appendChild(cell);
  }
  grid.appendChild(calDiv);
}

function showPunchDayDetail(dateStr,recs){
  const detail=document.getElementById('punchDayDetail');if(!detail)return;
  if(!recs.length){
    detail.innerHTML='<div style="padding:12px 16px;display:flex;justify-content:space-between;align-items:center"><span style="font-size:.85rem;color:var(--g400)">'+dateStr+' 無打卡記錄</span><button class="btn bo bxs" onclick="openPunchRequest()">補打卡</button></div>';
    detail.style.display='block';return;
  }
  const inRec=recs.find(r=>r.type==='in');
  const outRec=recs.find(r=>r.type==='out');
  let workHours='';
  if(inRec&&outRec){
    const [ih,im]=(inRec.time||'0:0').split(':').map(Number);
    const [oh,om]=(outRec.time||'0:0').split(':').map(Number);
    const mins=(oh*60+om)-(ih*60+im);
    if(mins>0)workHours='⏱ 工時 '+Math.floor(mins/60)+'小時'+(mins%60?mins%60+'分':'');
  }
  detail.innerHTML='<div style="padding:12px 16px;border-bottom:1px solid var(--g100);font-size:.8rem;font-weight:800;color:var(--g600)">📅 '+dateStr+'</div>'+
    '<div style="display:flex;gap:10px;padding:12px 16px;flex-wrap:wrap">'+
    (inRec?'<div style="flex:1;min-width:100px;background:var(--ok-bg);border:1.5px solid var(--ok-bd);border-radius:var(--rs);padding:10px 14px"><div style="font-size:.7rem;font-weight:800;color:var(--ok);margin-bottom:4px">🟢 上班打卡</div><div style="font-size:1.2rem;font-weight:900;font-family:monospace">'+inRec.time+'</div></div>':'<div style="flex:1;min-width:100px;background:var(--g50);border:1.5px dashed var(--g200);border-radius:var(--rs);padding:10px 14px;color:var(--g400);font-size:.82rem;display:flex;align-items:center;justify-content:center">未打上班卡</div>')+
    (outRec?'<div style="flex:1;min-width:100px;background:var(--info-bg);border:1.5px solid var(--info-bd);border-radius:var(--rs);padding:10px 14px"><div style="font-size:.7rem;font-weight:800;color:var(--info);margin-bottom:4px">🔵 下班打卡</div><div style="font-size:1.2rem;font-weight:900;font-family:monospace">'+outRec.time+'</div></div>':'<div style="flex:1;min-width:100px;background:var(--g50);border:1.5px dashed var(--g200);border-radius:var(--rs);padding:10px 14px;color:var(--g400);font-size:.82rem;display:flex;align-items:center;justify-content:center">未打下班卡</div>')+
    '</div>'+
    (workHours?'<div style="padding:6px 16px 12px"><div style="background:var(--gold-pale);border-radius:var(--rs);padding:8px 12px;font-size:.82rem;font-weight:700;color:var(--gold-d)">'+workHours+'</div></div>':'')+
    '<div style="padding:0 16px 12px;text-align:right"><button class="btn bo bxs" onclick="openPunchRequest()">✏️ 申請修改</button></div>';
  detail.style.display='block';
}

function renderPunchRec(){
  updatePunchBtn();
  if(typeof updateTodayCard==='function')updateTodayCard();
  renderPunchCal();
  const today=new Date().toLocaleDateString('zh-TW');
  if(!_punchSelDate||_punchSelDate===today){
    _punchSelDate=today;
    const recs=DB.get('punch_recs').filter(r=>r.user===curPunchUser&&r.date===today);
    showPunchDayDetail(today,recs);
  }
}


// ══ Firebase 同步狀態顯示 ═══════════════════════════════


function showFirebaseStatus(){
  const status=window._lastSyncStatus||'unknown';
  const time=window._lastSyncTime||'—';
  const fbOk=typeof firebase!=='undefined'&&window._fbReady;
  const msgs={
    ok:     '✅ Firebase 已連線，資料即時同步到雲端',
    syncing:'⏳ 正在連線 Firebase...',
    offline:'💾 本機模式：資料只存在此瀏覽器\n⚠️ 換裝置或清快取資料會消失！',
    error:  '❌ Firebase 連線失敗，請確認網路正常',
    unknown:'❓ 狀態不明',
  };
  const detail = fbOk
    ? `Firebase 狀態：已連線 ✅\n專案：zeju-62388\n最後同步：${time}\n\n所有資料已安全備份到雲端。`
    : `Firebase 狀態：未連線 ❌\n最後更新：${time}\n\n⚠️ 建議到「系統設定」匯出備份！`;
  showInfoBox('☁️ 同步狀態',(msgs[status]||msgs.unknown)+'\n\n'+detail);
}
// ══ 打卡修改申請 ═══════════════════════════════════════
function openPunchRequest(){
  // 找 punchRequestModal，如果不存在就動態建立
  let modal = document.getElementById('punchRequestModal');
  if(!modal){
    modal = document.createElement('div');
    modal.id = 'punchRequestModal';
    modal.className = 'mov';
    modal.innerHTML = `
      <div class="modal" style="max-width:440px">
        <div class="mtit">✏️ 申請補打卡 / 修改記錄
          <button class="mcl" data-close="punchRequestModal">✕</button>
        </div>
        <div class="field">
          <label class="fl">日期</label>
          <input class="fi" id="prDate" type="date">
        </div>
        <div class="field">
          <label class="fl">申請類型</label>
          <select class="fs" id="prType">
            <option value="in">補打上班卡</option>
            <option value="out">補打下班卡</option>
            <option value="fix">修改錯誤時間</option>
            <option value="other">其他</option>
          </select>
        </div>
        <div class="field">
          <label class="fl">正確時間（若適用）</label>
          <input class="fi" id="prTime" type="time">
        </div>
        <div class="field">
          <label class="fl">申請原因</label>
          <textarea class="fi" id="prReason" rows="3" placeholder="請說明原因，例如：忘記打卡、手機沒訊號等"></textarea>
        </div>
        <button class="btn bg bfull" id="prSubmit" style="padding:14px;font-size:.95rem">📨 送出申請</button>
      </div>`;
    document.body.appendChild(modal);
    // 綁定送出
    document.getElementById('prSubmit').addEventListener('click',()=>{
      const date = document.getElementById('prDate').value;
      const type = document.getElementById('prType').value;
      const time = document.getElementById('prTime').value;
      const reason = document.getElementById('prReason').value.trim();
      if(!date){showToast('⚠️ 請選擇日期');return;}
      if(!reason){showToast('⚠️ 請填寫申請原因');return;}
      const typeMap={in:'補打上班卡',out:'補打下班卡',fix:'修改時間',other:'其他'};
      DB.push('punch_requests',{
        summary:'打卡申請：'+typeMap[type],
        user: curRole,
        userName: document.getElementById('uName')?.textContent||curRole,
        date, type, time, reason,
        status:'pending',
      });
      showToast('✅ 申請已送出，等待老闆審核！');
      closeModal('punchRequestModal');
      // 清空
      document.getElementById('prDate').value='';
      document.getElementById('prTime').value='';
      document.getElementById('prReason').value='';
    });
  }
  // 預設今天日期
  document.getElementById('prDate').value = new Date().toISOString().split('T')[0];
  openModal('punchRequestModal');
}

// ══ 把 localStorage 現有資料一次性上傳到 Firebase ══
async function uploadLocalToFirebase(){
  if(!_fbDB||!_fbReady){
    showToast('⚠️ Firebase 未連線，請先確認設定');
    return;
  }
  setSyncStatus('syncing');
  let count=0;
  const uploads=_KEYS.map(async k=>{
    // 從 localStorage 讀取
    try{
      const raw=localStorage.getItem('z7_'+k);
      if(raw){
        const data=JSON.parse(raw);
        if(Array.isArray(data)&&data.length>0){
          await _fbDB.ref('zeju_data/'+k).set(data);
          _cache[k]=data;
          count++;
        }
      }
    }catch(e){console.warn('upload err:',k,e);}
  });
  await Promise.all(uploads);
  setSyncStatus('ok');
  showToast('✅ 已上傳 '+count+' 筆資料到 Firebase！所有裝置現在可以同步。');
}

// ── 檢查是否需要上傳本地資料 ──────────────────────────
async function checkAndOfferUpload(){
  if(!_fbDB||!_fbReady) return; // Firebase 未連
  // 檢查 Firebase 是否有資料
  try{
    const snap = await _fbDB.ref('zeju_data/quotes').once('value');
    const fbData = snap.val();
    // Firebase 空但 localStorage 有資料
    const localData = localStorage.getItem('z7_quotes');
    if((!fbData||fbData.length===0) && localData && JSON.parse(localData).length>0){
      confirmAction('偵測到本地有資料但雲端是空的，要上傳同步嗎？',()=>uploadLocalToFirebase(),false);
    }
  }catch{}
}

// ══ 廠商上傳類型切換 ══════════════════════════════════
function setVType(type){
  curVType=type;
  document.querySelectorAll('.vtype-btn').forEach(b=>{
    b.classList.toggle('on', b.dataset.vtype===type);
  });
  const zone=document.getElementById('vZone');
  const zoneIc=document.getElementById('vZoneIc');
  const zoneTitle=document.getElementById('vZoneTitle');
  const zoneSub=document.getElementById('vZoneSub');
  if(type==='image'){
    if(zoneIc)zoneIc.textContent='📷';
    if(zoneTitle)zoneTitle.textContent='上傳報價單照片（可多頁）';
    if(zoneSub)zoneSub.textContent='多頁報價單：每頁拍一張，一次全選上傳，AI 辨識全部';
    document.getElementById('vFile').accept='image/*';
  }else if(type==='pdf'){
    if(zoneIc)zoneIc.textContent='📄';
    if(zoneTitle)zoneTitle.textContent='上傳 PDF 報價單';
    if(zoneSub)zoneSub.textContent='PDF 格式，AI 自動辨識';
    document.getElementById('vFile').accept='.pdf';
  }else if(type==='excel'){
    if(zoneIc)zoneIc.textContent='📊';
    if(zoneTitle)zoneTitle.textContent='上傳 Excel 報價單';
    if(zoneSub)zoneSub.textContent='Excel/CSV 格式';
    document.getElementById('vFile').accept='.xlsx,.xls,.csv';
  }
}

// ══ 澤居報價庫 Modal ══════════════════════════════════
function openZejuQuoteModal(){
  const n=document.getElementById('adN')?.value||'';
  const c=document.getElementById('adCase')?.value||document.getElementById('adAd')?.value||'';
  const nEl=document.getElementById('zqName');if(nEl)nEl.value=n?n+' 報價':'';
  const cEl=document.getElementById('zqCase');if(cEl)cEl.value=c;
  const noEl=document.getElementById('zqNote');if(noEl)noEl.value='';
  openModal('zejuQuoteModal');
}

function saveCurrentAsZejuQuote(){
  openZejuQuoteModal();
}

function renderZejuQuotes(filter){
  const list=document.getElementById('zejuQuoteList');if(!list)return;
  const caseF=document.getElementById('zejuCaseFilter')?.value||'';
  let data=DB.get('zeju_quotes');
  if(caseF)data=data.filter(q=>q.caseN===caseF);
  const cnt=document.getElementById('clientCount');
  if(cnt)cnt.textContent=DB.get('zeju_quotes').length+' 份報價';
  if(!data.length){
    list.innerHTML='<div style="padding:14px;text-align:center;font-size:.82rem;color:var(--g400)">尚無儲存的報價</div>';
    return;
  }
  list.innerHTML='';
  data.forEach(q=>{
    const row=document.createElement('div');
    row.style.cssText='padding:9px 12px;border-bottom:1px solid var(--g100);display:flex;align-items:center;gap:8px;cursor:pointer;transition:background var(--ease)';
    row.onmouseenter=()=>row.style.background='var(--g50)';
    row.onmouseleave=()=>row.style.background='';
    row.innerHTML=
      '<div style="flex:1;min-width:0">'+
        '<div style="font-size:.85rem;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+q.name+'</div>'+
        '<div style="font-size:.72rem;color:var(--g400);margin-top:1px">'+(q.caseN?'📍'+q.caseN+' · ':'')+fmt(q.total||0)+'</div>'+
      '</div>'+
      '<div style="display:flex;gap:4px;flex-shrink:0">'+
        '<button class="btn bg bxs" data-zqload="'+q._id+'">載入</button>'+
        '<button class="btn brd bxs" data-zqdel="'+q._id+'">🗑</button>'+
      '</div>';
    row.querySelector('[data-zqload]').addEventListener('click',e=>{
      e.stopPropagation();
      confirmAction('載入「'+q.name+'」？目前報價內容將被替換。',()=>{
        adSections=JSON.parse(JSON.stringify(q.sections||[]));
        renderProQuote('adSections',adSections,{allowDelSec:true,totIds:{sub:'adSub',mgmt:'adMgmt',tax:'adTax',total:'adTotal'}});
        if(typeof updProfitBar==='function')updProfitBar();
        if(q.clientName){const el=document.getElementById('adN');if(el)el.value=q.clientName;}
        if(q.caseN){const el=document.getElementById('adCase');if(el)el.value=q.caseN;}
        showToast('✅ 已載入「'+q.name+'」！');
      },false);
    });
    row.querySelector('[data-zqdel]').addEventListener('click',e=>{
      e.stopPropagation();
      confirmAction('刪除報價庫「'+q.name+'」？',()=>{
        DB.del('zeju_quotes',q._id);
        renderZejuQuotes();updZejuCaseFilter();
        showToast('✅ 已刪除');
      });
    });
    list.appendChild(row);
  });
}

function updZejuCaseFilter(){
  const sel=document.getElementById('zejuCaseFilter');if(!sel)return;
  const cases=[...new Set(DB.get('zeju_quotes').map(q=>q.caseN).filter(Boolean))];
  const cur=sel.value;
  sel.innerHTML='<option value="">全部案場</option>';
  cases.forEach(c=>{
    const o=document.createElement('option');
    o.value=c;o.textContent='📍 '+c;
    if(c===cur)o.selected=true;
    sel.appendChild(o);
  });
}

// saveZejuQuoteBtn listener
document.getElementById('saveZejuQuoteBtn')?.addEventListener('click',()=>{
  const name=(document.getElementById('zqName')?.value||'').trim();
  if(!name){showToast('⚠️ 請填入報價名稱');return;}
  const caseN=(document.getElementById('zqCase')?.value||'').trim();
  const note=(document.getElementById('zqNote')?.value||'').trim();
  const total=calcAll(adSections);
  DB.push('zeju_quotes',{
    summary:'澤居報價 '+name,
    name,caseN,note,
    sections:JSON.parse(JSON.stringify(adSections)),
    total,
    clientName:document.getElementById('adN')?.value||'',
  });
  closeModal('zejuQuoteModal');
  renderZejuQuotes();
  updZejuCaseFilter();
  showToast('✅ 已儲存到澤居報價庫！');
});

// ══ 新增客戶 Modal ═════════════════════════════════════
function openAddClientModal(){
  const n=document.getElementById('newClientName');
  const p=document.getElementById('newClientPhone');
  const a=document.getElementById('newClientAddr');
  if(n)n.value='';if(p)p.value='';if(a)a.value='';
  openModal('addClientModal');
  setTimeout(()=>n?.focus(),200);
}

document.getElementById('confirmAddClient')?.addEventListener('click',()=>{
  const name=(document.getElementById('newClientName')?.value||'').trim();
  if(!name){showToast('⚠️ 請填入客戶姓名');return;}
  const phone=(document.getElementById('newClientPhone')?.value||'').trim();
  const addr=(document.getElementById('newClientAddr')?.value||'').trim();
  const client={
    _id:Date.now(),
    name,phone,addr,
    created:new Date().toLocaleString('zh-TW')
  };
  const clients=DB.get('clients');
  clients.unshift(client);
  DB.set('clients',clients);
  closeModal('addClientModal');
  renderClientList();
  if(typeof switchClient==='function') switchClient(client._id);
  showToast('✅ 客戶「'+name+'」已建立！');
});

// Enter 鍵送出
document.getElementById('newClientName')?.addEventListener('keydown',e=>{
  if(e.key==='Enter') document.getElementById('confirmAddClient')?.click();
});