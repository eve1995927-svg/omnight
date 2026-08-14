function getVendorPrompt(){
  return '請仔細辨識這份廠商報價單的所有內容。\n只回覆純JSON（不要加```），格式：\n{"vendor":"廠商完整名稱","case":"案場名稱沒有則空字串","cat":"工程類別只能填系統櫃廚具玻璃鋁窗水電泥作油漆鐵件其他之一","note":"備注如含安裝不含稅等","items":[{"name":"工項名稱","qty":"數量與單位如3坪或1式","amount":金額數字}]}\n請盡量列出所有細項，金額盡量辨識為數字。無法辨識的填空字串或0。';
}

// 補充上傳用：新辨識到的工項「加進去」既有清單，不是整個蓋掉——
// 這樣一份很多頁的報價單，可以分好幾次上傳照片，每次辨識到的工項會累加，不用一次塞滿5張圖
function appendVendorItems(dat){
  const newItems=(dat.items||[]).filter(it=>it&&(it.name||'').trim()).map(it=>{
    const qty=it.qty||'1式';
    const qNum=parseFloat(qty.toString().replace(/[^\d.]/g,''))||1;
    let unitPrice=parseFloat(it.unitPrice)||0;
    let amount=parseFloat(it.amount)||0;
    if(unitPrice>0){amount=Math.round(unitPrice*qNum);}
    else if(amount>0){unitPrice=Math.round(amount/qNum);}
    return {...it, qty, unitPrice, amount};
  });
  if(!newItems.length){showToast('⚠️ 這幾張沒有辨識到新的工項，可能圖片不清楚或內容重複');return;}
  // 如果目前只有一筆空白的預設列，先把它清掉，不要留一筆空的在最前面
  if(vItems.length===1&&!vItems[0].name&&!vItems[0].amount)vItems=[];
  vItems=[...vItems,...newItems];
  renderVItems();
  updVTotal();
  showToast('✅ 已新增 '+newItems.length+' 筆工項，目前共 '+vItems.length+' 筆');
}

function applyVendorResult(dat){
  if(dat.vendor) document.getElementById('vVd').value=dat.vendor;
  // 修正重點：案場名稱欄位改成一定要從既有案場挑選，AI 辨識出來的是自由文字（可能跟案場名稱打法不完全一樣），
  // 沒辦法直接塞進選單，改成試著模糊比對現有案場名稱，比對得到才幫忙選好，比對不到就讓使用者自己選，
  // 不會硬塞一個選單裡根本沒有的值
  if(dat.case){
    const projects=DB.get('projects');
    const match=projects.find(p=>p.name&&(p.name.includes(dat.case)||dat.case.includes(p.name)));
    const vCsEl=document.getElementById('vCs');
    if(match&&vCsEl){
      vCsEl.value=String(match._id);
    }else if(dat.case){
      showToast('💡 AI 辨識到案場名稱「'+dat.case+'」，但找不到對應的既有案場，請手動選擇');
    }
  }
  if(dat.note)   document.getElementById('vNt').value=dat.note;
  if(dat.cat){
    const sel=document.getElementById('vCat');
    const opts=['系統櫃','廚具','玻璃','鋁窗','水電','泥作','油漆','鐵件','其他'];
    const mt=opts.find(o=>dat.cat.includes(o)||o.includes(dat.cat));
    if(mt) sel.value=mt;
  }
  // 修正 items：確保 unitPrice 和 amount 正確
  vItems=(dat.items||[]).map(it=>{
    const qty=it.qty||'1式';
    const qNum=parseFloat(qty.toString().replace(/[^\d.]/g,''))||1;
    let unitPrice=parseFloat(it.unitPrice)||0;
    let amount=parseFloat(it.amount)||0;
    // 如果有 unitPrice 就用它，amount = unitPrice × qty
    if(unitPrice>0){
      amount=Math.round(unitPrice*qNum);
    } else if(amount>0){
      // 只有 amount，反推 unitPrice
      unitPrice=Math.round(amount/qNum);
    }
    return {...it, qty, unitPrice, amount};
  });
  if(!vItems.length) vItems=[{name:'',qty:'1式',unitPrice:0,amount:0}];
  renderVItems();
  updVTotal();
}

function showVMsg(type, msg){
  const el=document.getElementById('vOcrOk');if(!el)return;
  const styles={
    ok:'background:var(--ok-bg);border:1.5px solid var(--ok-bd);color:var(--ok)',
    warn:'background:var(--warn-bg);border:1.5px solid var(--warn-bd);color:var(--warn)',
    info:'background:var(--info-bg);border:1.5px solid var(--info-bd);color:var(--info)',
  };
  el.style.cssText='display:flex;align-items:center;gap:8px;padding:11px 15px;border-radius:var(--rs);font-size:.85rem;font-weight:700;margin-bottom:14px;'+styles[type];
  el.textContent=msg;
}

// ── File change handler ────────────────────────────────────
document.getElementById('vFile').addEventListener('change',async e=>{
  const files=Array.from(e.target.files);if(!files.length)return;e.target.value='';
  const prev=document.getElementById('vPrev');

  // 顯示檔案預覽
  files.forEach(f=>{
    if(f.type.startsWith('image/')){
      const rd=new FileReader();rd.onload=ev=>{
        const url=ev.target.result;
        const w=document.createElement('div');w.className='ithw';
        const img=document.createElement('img');img.className='ith';img.src=url;
        img.addEventListener('click',()=>openLB(url));
        const d=document.createElement('div');d.className='idel';d.textContent='✕';
        d.addEventListener('click',()=>w.remove());
        w.appendChild(img);w.appendChild(d);prev.appendChild(w);
      };rd.readAsDataURL(f);
    } else {
      const icon=f.name.match(/\.pdf$/i)?'📄':f.name.match(/\.xlsx?|\.csv$/i)?'📊':'📎';
      const t=document.createElement('div');
      t.style.cssText='display:inline-flex;align-items:center;gap:7px;background:var(--info-bg);border:1.5px solid var(--info-bd);color:var(--info);padding:9px 14px;border-radius:var(--rs);font-size:.85rem;font-weight:700;margin:3px';
      t.innerHTML=icon+' '+esc(f.name)+'<span style="cursor:pointer;color:var(--bad);font-weight:900;margin-left:4px">✕</span>';
      t.querySelector('span').addEventListener('click',()=>t.remove());
      prev.appendChild(t);
    }
  });

  // 顯示結果區（立即有反應）
  document.getElementById('vResult').style.display='block';
  if(!vItems.length){vItems=[{name:'',qty:'1式',amount:0}];renderVItems();}

  const ocr=document.getElementById('vOcr');ocr.classList.add('show');
  const f0=files[0];

  try{
    let rep='';

    if(curVType==='image'){
      // 圖片：支援多張（多頁報價單）
      const imgFiles=files.filter(f=>f.type.startsWith('image/'));
      if(!imgFiles.length){showVMsg('warn','⚠️ 請選擇圖片檔案');ocr.classList.remove('show');return;}
      // 讀取所有圖片為 base64
      const readImg=f=>new Promise(res=>{const rd=new FileReader();rd.onload=e=>res({b64:e.target.result.split(',')[1],mime:f.type});rd.readAsDataURL(f);});
      const imgs=await Promise.all(imgFiles.map(readImg));
      // 組成多圖 content（最多 5 張）
      const content=[];
      imgs.slice(0,5).forEach((img,i)=>{
        content.push({type:'image',source:{type:'base64',media_type:img.mime,data:img.b64}});
        content.push({type:'text',text:'（第'+(i+1)+'頁）'});
      });
      content.push({type:'text',text:getVendorPrompt()+
        (imgs.length>1?'\n\n注意：共'+imgs.length+'頁圖片，請辨識所有頁面的所有細項。':'')});
      rep=await callAI('ad',content,3000,100,'廠商報價辨識');
      showVMsg('ok','✅ 辨識完成（共'+imgs.length+'頁）！請確認下方欄位，可直接修改');

    } else if(curVType==='pdf'){
      // PDF：Anthropic document block（支援多頁）
      const url=await new Promise(res=>{const rd=new FileReader();rd.onload=e=>res(e.target.result);rd.readAsDataURL(f0);});
      const b64=url.split(',')[1];
      // 先試多頁 PDF（最多 100 頁，Anthropic 原生支援）
      rep=await callAI('ad',[
        {type:'document',source:{type:'base64',media_type:'application/pdf',data:b64}},
        {type:'text',text:getVendorPrompt()+
          '\n\n注意：這是完整的報價單 PDF（可能有多頁），請辨識所有頁面的所有細項，不要只取第一頁。'+
          '所有頁面的工項都要列出來。'}
      ],2000,100,'廠商報價辨識');
      showVMsg('ok','✅ PDF 辨識完成（全頁）！請確認下方欄位，可直接修改');
      // 提示：如果內容不完整，可改用「圖片」模式逐頁上傳
      if(vItems.length<3){
        setTimeout(()=>showVMsg('warn','⚠️ 如內容不完整，建議改用「📷 圖片」模式，把每頁拍照後一次全選上傳'),3000);
      }

    } else {
      // Excel / CSV：讀成文字後給 AI 分析
      let text='';
      if(f0.name.match(/\.csv$/i)){
        text=await new Promise(res=>{const rd=new FileReader();rd.onload=e=>res(e.target.result);rd.readAsText(f0,'UTF-8');});
      } else {
        // xlsx/xls：讀 ArrayBuffer，掃出可讀字元
        const ab=await new Promise(res=>{const rd=new FileReader();rd.onload=e=>res(e.target.result);rd.readAsArrayBuffer(f0);});
        const bytes=new Uint8Array(ab);let raw='';
        for(let i=0;i<Math.min(bytes.length,80000);i++){
          const c=bytes[i];if(c>31&&c<128)raw+=String.fromCharCode(c);else if(c===0)raw+=' ';
        }
        // 取出看起來像表格的行（含數字和中文）
        text=raw.split(/\s{3,}/).filter(s=>s.trim().length>1&&/[\u4e00-\u9fff\d]/.test(s)).join('\n').slice(0,3000);
      }
      if(!text.trim()){showVMsg('warn','⚠️ 無法讀取檔案內容，請改用圖片或 PDF');ocr.classList.remove('show');return;}
      rep=await callAI('ad',getVendorPrompt()+'\n\n以下是報價單文字內容（請根據此內容辨識）：\n'+text,3000,100,'廠商報價辨識');
      showVMsg('ok','✅ '+f0.name.match(/\.csv$/i)?'CSV':'Excel'+' 辨識完成！請確認下方欄位');
    }

    const dat=JSON.parse(rep.replace(/```json|```/g,'').trim());
    applyVendorResult(dat);

  } catch(err){
    console.log('OCR err',err);
    showVMsg('warn',friendlyAIError(err)+'（已切換為手動填寫）');
  }
  ocr.classList.remove('show');
});
function renderVItems(){
  const c=document.getElementById('vItemsTable');if(!c)return;c.innerHTML='';
  if(!vItems.length){
    const empty=document.createElement('div');
    empty.style.cssText='padding:14px;text-align:center;color:var(--g400);font-size:.85rem';
    empty.textContent='尚無細項 — 點下方「＋ 新增細項」';
    c.appendChild(empty);return;
  }
  // 表頭：工項名稱 | 數量 | 單位 | 單價 | 小計 | 刪
  const hd=document.createElement('div');
  hd.style.cssText='display:grid;grid-template-columns:2fr 55px 50px 90px 90px 36px;padding:6px 14px;background:var(--g100);border-bottom:1px solid var(--g200);font-size:.7rem;font-weight:900;color:var(--g400);text-transform:uppercase;letter-spacing:.04em';
  hd.innerHTML=
    '<span>工項名稱</span>'+
    '<span style="text-align:center">數量</span>'+
    '<span style="text-align:center">單位</span>'+
    '<span style="text-align:right">單價</span>'+
    '<span style="text-align:right">小計</span>'+
    '<span></span>';
  c.appendChild(hd);

  vItems.forEach((it,i)=>{
    const row=document.createElement('div');
    row.style.cssText='display:grid;grid-template-columns:2fr 55px 50px 90px 90px 36px;padding:7px 14px;border-bottom:1px solid var(--g100);align-items:center;gap:4px;transition:background var(--ease)';
    row.onmouseenter=()=>row.style.background='var(--g50)';
    row.onmouseleave=()=>row.style.background='';

    // 共用 input 樣式
    const IS='padding:6px 8px;border:1.5px solid transparent;border-radius:var(--rxs);font-size:.84rem;font-family:inherit;background:transparent;outline:none;width:100%;transition:all var(--ease)';
    const mkInp=(type,align)=>{
      const el=document.createElement('input');el.type=type||'text';
      el.style.cssText=IS+(align?';text-align:'+align:'');
      el.addEventListener('focus',()=>{el.style.borderColor='var(--gold)';el.style.background='var(--w)';});
      el.addEventListener('blur',()=>{el.style.borderColor='transparent';el.style.background='transparent';});
      return el;
    };

    // 工項名稱
    const n=mkInp('text');n.placeholder='工項名稱';n.value=it.name||'';
    n.addEventListener('input',()=>it.name=n.value);

    // 數量（純數字）
    const qNum=mkInp('number','center');qNum.placeholder='1';qNum.min=0;qNum.step='any';
    // 解析現有 qty 裡的數字部分
    const existQNum=parseFloat((it.qty||'1').toString().replace(/[^\d.]/g,''))||1;
    qNum.value=existQNum;

    // 單位
    const qUnit=mkInp('text','center');qUnit.placeholder='式';
    // 解析現有 qty 裡的文字部分
    const existUnit=(it.qty||'1式').toString().replace(/[\d.]/g,'').trim()||'式';
    qUnit.value=it.unit||existUnit;

    // 單價
    const uPrice=mkInp('number','right');uPrice.placeholder='單價';uPrice.min=0;
    uPrice.style.color='#1E7A58';uPrice.style.fontFamily='monospace';uPrice.style.fontWeight='700';
    uPrice.value=it.unitPrice||( it.amount&&existQNum?Math.round(it.amount/existQNum):0);

    // 小計（自動計算，唯讀）
    const subEl=document.createElement('div');
    subEl.style.cssText='font-family:monospace;font-size:.88rem;font-weight:900;color:var(--gold-d);text-align:right;padding:4px 2px';

    function recalc(){
      const qty=parseFloat(qNum.value)||0;
      const unit_=qUnit.value.trim()||'式';
      const up=parseFloat(uPrice.value)||0;
      it.qty=qty?qty+unit_:'1'+unit_; // 合併存回
      it.unit=unit_;
      it.unitPrice=up;
      it.amount=Math.round(up*qty)||0;
      subEl.textContent='NT$'+it.amount.toLocaleString();
      updVTotal();
    }
    qNum.addEventListener('input',recalc);
    qUnit.addEventListener('input',recalc);
    uPrice.addEventListener('input',recalc);
    // 初始顯示
    const initQty=parseFloat(qNum.value)||1;
    const initUp=parseFloat(uPrice.value)||0;
    subEl.textContent='NT$'+Math.round(initUp*initQty).toLocaleString();

    // 刪除
    const del=document.createElement('button');
    del.style.cssText='width:28px;height:28px;background:var(--bad-bg);border:1.5px solid var(--bad-bd);color:var(--bad);cursor:pointer;display:flex;align-items:center;justify-content:center;border-radius:var(--rxs);font-size:.78rem;font-weight:900;flex-shrink:0';
    del.textContent='🗑';del.title='刪除';
    del.onclick=()=>{vItems.splice(i,1);renderVItems();updVTotal();};

    row.appendChild(n);row.appendChild(qNum);row.appendChild(qUnit);
    const noteInp=mkInp('text','left');noteInp.placeholder='備注';noteInp.style.fontSize='.8rem';
    noteInp.value=it.note||'';
    noteInp.addEventListener('input',()=>{it.note=noteInp.value;});
    row.appendChild(uPrice);row.appendChild(subEl);row.appendChild(noteInp);row.appendChild(del);
    c.appendChild(row);
  });

  // 合計列
  const totalRow=document.createElement('div');
  totalRow.style.cssText='display:flex;justify-content:space-between;align-items:center;padding:10px 14px;background:var(--gold-pale);border-top:2px solid var(--gold-l)';
  const totalLabel=document.createElement('span');totalLabel.style.cssText='font-size:.85rem;font-weight:900;color:var(--gold-d)';totalLabel.textContent='廠商報價合計';
  const totalVal=document.createElement('span');totalVal.id='vTotalInline';totalVal.style.cssText='font-family:monospace;font-size:1rem;font-weight:900;color:var(--gold-d)';
  const t=vItems.reduce((s,it)=>s+(it.amount||0),0);totalVal.textContent='NT$'+t.toLocaleString();
  totalRow.appendChild(totalLabel);totalRow.appendChild(totalVal);
  c.appendChild(totalRow);
}

function updVSub(el,it){
  const qNum=parseFloat((it.qty||'').toString().replace(/[^\d.]/g,''))||1;
  const sub=it.unitPrice?(it.unitPrice*qNum):it.amount||0;
  el.textContent='NT$'+Math.round(sub).toLocaleString();
}

function updVTotal(){
  const t=vItems.reduce((s,x)=>s+(x.amount||0),0);
  const el=document.getElementById('vTotal');if(el)el.textContent=fmt(t);
}

document.getElementById('vAddItem')?.addEventListener('click',()=>{vItems.push({name:'',qty:'1',unit:'式',unitPrice:0,amount:0});renderVItems();updVTotal();});

document.getElementById('addVBtn')?.addEventListener('click',()=>{
  const vd=document.getElementById('vVd').value.trim(),cat=document.getElementById('vCat').value;
  const pid=document.getElementById('vCs').value,nt=document.getElementById('vNt').value.trim();
  if(!vd&&!vItems.length){showToast('請填入廠商名稱');return;}
  if(!pid){showToast('⚠️ 請先選擇案場，沒有案場的話請先到「案場總覽」新增');return;}
  const proj=DB.get('projects').find(p=>String(p._id)===String(pid));
  const cs=proj?.name||'';
  curProjectId=parseInt(pid);
  const total=vItems.reduce((s,it)=>s+(it.amount||0),0);
  const ups=uSt['vUp']||{imgs:[]};const imgUrl=ups.imgs?.[0]?.url||null;
  DB.push('vendors',{summary:'廠商報價 '+vd+' '+cat+' '+fmt(total),vendor:vd,cat,caseN:cs,amount:total,note:nt,projectId:curProjectId,items:vItems.map(it=>({name:it.name,qty:it.qty,unit:it.unit||'式',unitPrice:it.unitPrice||0,amount:it.amount||0,note:it.note||''})),imgDataUrl:imgUrl});
  closeModal('vModal');renderVendors(vCurrentFilter);updStats();renderAdVendorPicker();renderHistory();showToast('✅ 廠商報價已儲存！');
});

const VICO={系統櫃:'🪵',廚具:'🍳',玻璃:'🪟',鋁窗:'🪟',水電:'⚡',泥作:'🧱',油漆:'🎨',鐵件:'🔩',其他:'📦'};

// 修正重點：這兩排按鈕（比價工具、篩選頁籤）原本是寫死在 index.html 裡的固定清單，
// 不管你在別的地方新增過幾個分類，這裡永遠只有那 6～8 個，也沒有地方可以直接在這裡新增分類。
// 改成跟其他分類選單一樣，讀同一份 getSettingTags('vendorCat') 清單動態產生，
// 新增分類之後，這裡的篩選頁籤會馬上多一個，「全部」右邊也補了一個「＋」可以直接在這裡新增分類。
function renderVendorCatFilters(){
  const tags=(typeof getSettingTags==='function')?getSettingTags('vendorCat'):['系統櫃','廚具','玻璃','鋁窗','水電','泥作','油漆','鐵件','其他'];

  const compareRow=document.getElementById('vCompareRow');
  if(compareRow){
    compareRow.innerHTML='<span style="font-size:.78rem;font-weight:700;color:var(--g400)">⚖️ 廠商比價：</span>'+
      tags.map(t=>'<button class="btn bo bsm" data-cmpcat="'+esc(t)+'">'+(VICO[t]||'📦')+' '+esc(t)+'</button>').join('');
    compareRow.querySelectorAll('[data-cmpcat]').forEach(b=>{
      b.addEventListener('click',()=>compareVendorsByCat(b.dataset.cmpcat));
    });
  }

  const filt=document.getElementById('vFilt');
  if(filt){
    const curFilter=(typeof vCurrentFilter!=='undefined')?vCurrentFilter:'all';
    filt.innerHTML='<button class="btn '+(curFilter==='all'?'bg':'bo')+' bsm" data-cat="all">全部</button>'+
      tags.map(t=>'<button class="btn '+(curFilter===t?'bg':'bo')+' bsm" data-cat="'+esc(t)+'">'+(VICO[t]||'📦')+' '+esc(t)+'</button>').join('')+
      '<button class="btn bo bsm" id="vFiltAddCat" style="border-style:dashed">＋ 新增類別</button>';
    filt.querySelectorAll('[data-cat]').forEach(btn=>{
      btn.addEventListener('click',()=>{
        filt.querySelectorAll('[data-cat]').forEach(b=>{b.className='btn bo bsm';});
        btn.className='btn bg bsm';
        vCurrentFilter=btn.dataset.cat;renderVendors(vCurrentFilter);
        if(typeof updVCaseFilter==='function')updVCaseFilter();
      });
    });
    document.getElementById('vFiltAddCat')?.addEventListener('click',()=>{
      quickAddCategory('vendorCat',()=>{renderVendorCatFilters();});
    });
  }
}

// ── 合併廠商報價分組（案場總覽沒有重複，是廠商報價自己存的案場文字打法不一致）─────
let _mergeVGroupSelected=new Set();

function openMergeVendorGroupsModal(){
  _mergeVGroupSelected=new Set();
  const list=document.getElementById('mergeVGroupList');
  const vendors=DB.get('vendors');
  const byCase={};
  vendors.forEach(v=>{
    const k=v.caseN||'（未指定案場）';
    if(!byCase[k])byCase[k]={count:0,total:0};
    byCase[k].count++;
    byCase[k].total+=(v.amount||0);
  });
  const groups=Object.entries(byCase).sort((a,b)=>a[0].localeCompare(b[0],'zh-Hant'));
  if(!list)return;
  if(groups.length<2){
    list.innerHTML='<div class="empty-state"><div class="es-ic">🔀</div><div class="es-t">分組數量不足</div><div class="es-s">至少要有 2 個案場分組才能合併</div></div>';
  }else{
    list.innerHTML=groups.map(([caseName,info])=>
      '<label style="display:flex;align-items:flex-start;gap:10px;padding:10px 12px;border:1.5px solid var(--g200);border-radius:var(--rs);margin-bottom:8px;cursor:pointer" data-vgrow>'+
        '<input type="checkbox" value="'+esc(caseName)+'" style="width:17px;height:17px;margin-top:2px;cursor:pointer;accent-color:var(--gold)">'+
        '<div style="flex:1"><div style="font-weight:800;font-size:.9rem">'+esc(caseName)+'</div>'+
        '<div style="font-size:.75rem;color:var(--g400);margin-top:2px">共 '+info.count+' 筆・NT$'+info.total.toLocaleString()+'</div></div>'+
      '</label>'
    ).join('');
    list.querySelectorAll('input[type="checkbox"]').forEach(cb=>{
      cb.addEventListener('change',()=>{
        if(cb.checked)_mergeVGroupSelected.add(cb.value);else _mergeVGroupSelected.delete(cb.value);
        cb.closest('[data-vgrow]').style.background=cb.checked?'var(--gold-pale)':'';
        cb.closest('[data-vgrow]').style.borderColor=cb.checked?'var(--gold-l)':'var(--g200)';
        updateMergeVGroupUI();
      });
    });
  }
  updateMergeVGroupUI();
  openModal('mergeVendorGroupModal');
}

function updateMergeVGroupUI(){
  const targetWrap=document.getElementById('mergeVGroupTargetWrap');
  const targetSel=document.getElementById('mergeVGroupTarget');
  const btn=document.getElementById('mergeVGroupBtn');
  const names=[..._mergeVGroupSelected];
  if(names.length<2){
    if(targetWrap)targetWrap.style.display='none';
    if(btn){btn.disabled=true;btn.textContent='選至少 2 個分組才能合併';}
    return;
  }
  if(targetWrap)targetWrap.style.display='block';
  // 目標一定要是既有案場（延續「一定要先建案場」的規則），不能自己打一個新名字
  if(targetSel&&typeof buildProjectSelect==='function')buildProjectSelect(targetSel,null);
  if(btn){btn.disabled=false;btn.textContent='🔀 合併這 '+names.length+' 個分組';}
}

document.getElementById('mergeVGroupBtn')?.addEventListener('click',()=>{
  const names=[..._mergeVGroupSelected];
  const targetId=parseInt(document.getElementById('mergeVGroupTarget')?.value);
  if(names.length<2||!targetId)return;
  const targetProj=DB.get('projects').find(p=>p._id===targetId);
  if(!targetProj)return;

  confirmAction(
    '確定把這 '+names.length+' 個分組合併到「'+esc(targetProj.name)+'」嗎？裡面的廠商報價會全部改成歸在這個案場底下。',
    ()=>{
      let movedCount=0;
      DB.getAll('vendors').forEach(v=>{
        const k=v.caseN||'（未指定案場）';
        if(names.includes(k)){
          DB.upd('vendors',v._id,{projectId:targetId,caseN:targetProj.name||''});
          movedCount++;
        }
      });
      closeModal('mergeVendorGroupModal');
      renderVendorCatFilters();renderVendors(vCurrentFilter);updStats();
      if(typeof updVCaseFilter==='function')updVCaseFilter();
      showToast('✅ 已合併！'+movedCount+' 筆廠商報價現在都歸在「'+targetProj.name+'」底下');
    }
  );
});

function renderVendors(filter){
  const list=document.getElementById('vList');if(!list)return;
  let data=DB.get('vendors');
  if(filter!=='all')data=data.filter(v=>v.cat===filter);
  const kw=(document.getElementById('vSearch')?.value||'').trim().toLowerCase();
  const caseF=(document.getElementById('vCaseFilter')?.value||'');
  if(kw)data=data.filter(v=>(v.vendor||'').toLowerCase().includes(kw)||(v.caseN||'').toLowerCase().includes(kw)||(v.cat||'').toLowerCase().includes(kw)||(v.note||'').toLowerCase().includes(kw)||(v.items||[]).some(it=>(it.name||'').toLowerCase().includes(kw)));
  if(caseF)data=data.filter(v=>v.caseN===caseF);

  if(!data.length){
    list.innerHTML='<div class="empty-state"><div class="es-ic">🏗️</div><div class="es-t">尚無廠商報價</div><div class="es-s">點右上方「新增廠商報價」，上傳報價單 AI 自動辨識</div></div>';
    return;
  }
  list.innerHTML='';

  // ── 以案場分組 ──────────────────────────────────────────
  const byCase={};
  data.forEach(v=>{
    const k=v.caseN||'（未指定案場）';
    if(!byCase[k])byCase[k]=[];
    byCase[k].push(v);
  });

  Object.entries(byCase).forEach(([caseName,vendors])=>{
    // 案場分組標題
    const caseTotal=vendors.reduce((s,v)=>s+(v.amount||0),0);
    // 這組廠商報價目前實際已經付了多少錢（把每一筆的付款紀錄加總），
    // 讓人一眼看出「這個案場欠廠商的錢付了多少、還剩多少沒付」，不用一筆一筆點開算
    const casePaid=vendors.reduce((s,v)=>s+getVendorPaid(v),0);
    const grpHd=document.createElement('div');
    grpHd.style.cssText='display:flex;align-items:center;justify-content:space-between;padding:10px 16px;background:linear-gradient(135deg,var(--gold-pale),#FFF0C0);border:1.5px solid var(--gold-l);border-radius:var(--r-sm);margin-bottom:6px;cursor:pointer;user-select:none';
    grpHd.innerHTML=
      '<div style="display:flex;align-items:center;gap:10px">'+
        '<span style="font-size:1.1rem">📍</span>'+
        '<div>'+
          '<div style="font-size:.95rem;font-weight:900;color:var(--gold-d)">'+esc(caseName)+'</div>'+
          '<div style="font-size:.75rem;color:var(--g400);margin-top:1px">共 '+vendors.length+' 筆廠商報價'+(casePaid>0?' · 已付 NT$'+casePaid.toLocaleString():'')+'</div>'+
        '</div>'+
      '</div>'+
      '<div style="text-align:right">'+
        '<div style="font-family:monospace;font-size:1rem;font-weight:900;color:var(--gold-d)">NT$'+caseTotal.toLocaleString()+'</div>'+
        '<div style="font-size:.68rem;color:var(--g400)">案場合計'+(casePaid>0&&casePaid<caseTotal?'（尚欠 NT$'+(caseTotal-casePaid).toLocaleString()+'）':'')+'</div>'+
      '</div>';

    const grpBody=document.createElement('div');
    grpBody.style.cssText='margin-bottom:16px;display:block';
    let bodyOpen=true;

    grpHd.addEventListener('click',()=>{
      bodyOpen=!bodyOpen;
      grpBody.style.display=bodyOpen?'block':'none';
      grpHd.querySelector('span:first-child').textContent=bodyOpen?'📍':'📁';
    });

    // 案場內的廠商卡片
    vendors.forEach(v=>{
      const editItems=v.items?v.items.map(it=>({...it})):[];
      const card=document.createElement('div');card.className='vcard';card.style.marginBottom='6px';

      // Header
      const hd=document.createElement('div');hd.className='vchd';
      const catIco=VICO[v.cat]||'📦';
      hd.innerHTML=
        '<span style="font-size:1.3rem;flex-shrink:0">'+catIco+'</span>'+
        '<div style="flex:1;min-width:0">'+
          '<div style="font-size:.9rem;font-weight:900">'+esc(v.vendor)+
            ' <span style="font-size:.68rem;background:var(--gold-pale);color:var(--gold-d);padding:2px 8px;border-radius:20px;font-weight:800">'+esc(v.cat)+'</span>'+
          '</div>'+
          '<div style="font-size:.72rem;color:var(--g400);margin-top:2px">'+v._ts.split(' ')[0]+'</div>'+
        '</div>'+
        '<div style="text-align:right;flex-shrink:0">'+
          '<div style="font-size:.95rem;font-weight:900;color:var(--gold-d);font-family:monospace">NT$'+(v.amount||0).toLocaleString()+'</div>'+
          (()=>{const ps=getVendorPayStatus(v);const paid=getVendorPaid(v);return '<div style="font-size:.62rem;font-weight:800;padding:1px 7px;border-radius:20px;background:'+ps.bg+';color:'+ps.color+';margin-top:2px;display:inline-block">'+ps.label+(paid>0&&paid<(v.amount||0)?' '+Math.round(paid/(v.amount||0)*100)+'%':'')+'</div>';})()+
        '</div>'+
        '<div style="display:flex;gap:4px;margin-left:8px;flex-shrink:0">'+
          '<button class="btn bg bxs" data-vpay style="background:var(--gold)">💳 付款</button>'+
          '<button class="btn bo bxs" data-vtgl>▾ 明細</button>'+
          '<button class="btn brd bxs" data-vdel>🗑</button>'+
        '</div>';

      // 展開明細 body
      const body=document.createElement('div');body.className='vcbody';
      // 基本資料編輯
      const basicEdit=document.createElement('div');
      basicEdit.style.cssText='padding:12px 16px;border-bottom:1px solid var(--g100);background:var(--w)';
      // 修正重點：這裡原本是自己寫死一份類別清單（沒有「＋新增分類」選項，也看不到別的地方新增過的自訂分類），
      // 跟「新增廠商報價」表單用的不是同一套機制，導致在這裡改一筆既有廠商報價的類別時，沒辦法新增類別。
      // 改成呼叫共用的 buildCatSelectWithAdd，跟其他地方共用同一份分類清單、也都能直接新增。
      basicEdit.innerHTML=
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px">'+
          '<div><div style="font-size:.62rem;font-weight:900;color:var(--g400);text-transform:uppercase;letter-spacing:.08em;margin-bottom:4px">廠商名稱</div>'+
          '<input id="ve-vendor-'+v._id+'" style="width:100%;padding:7px 10px;border:1.5px solid var(--g200);border-radius:var(--rxs);font-size:.85rem;font-family:inherit;outline:none" value="'+esc(v.vendor||'')+'"></div>'+
          '<div><div style="font-size:.62rem;font-weight:900;color:var(--g400);text-transform:uppercase;letter-spacing:.08em;margin-bottom:4px">工程類別</div>'+
          '<select id="ve-cat-'+v._id+'" style="width:100%;padding:7px 10px;border:1.5px solid var(--g200);border-radius:var(--rxs);font-size:.85rem;font-family:inherit;outline:none"></select></div>'+
        '</div>'+
        '<div><div style="font-size:.62rem;font-weight:900;color:var(--g400);text-transform:uppercase;letter-spacing:.08em;margin-bottom:4px">備注</div>'+
        '<input id="ve-note-'+v._id+'" style="width:100%;padding:7px 10px;border:1.5px solid var(--g200);border-radius:var(--rxs);font-size:.85rem;font-family:inherit;outline:none" value="'+esc(v.note||'')+'" placeholder="例：含安裝、不含稅…"></div>';
      if(typeof buildCatSelectWithAdd==='function')buildCatSelectWithAdd(basicEdit.querySelector('select'),'vendorCat',v.cat);

      // 細項表格
      const itemWrap=document.createElement('div');
      const itmHd=document.createElement('div');
      itmHd.style.cssText='display:grid;grid-template-columns:2fr 50px 45px 80px 85px 32px;gap:4px;padding:7px 14px;background:var(--g100);border-bottom:1px solid var(--g200);border-top:1px solid var(--g100)';
      itmHd.innerHTML='<span style="font-size:.62rem;font-weight:900;color:var(--g400)">工項名稱</span><span style="font-size:.62rem;font-weight:900;color:var(--g400);text-align:center">數量</span><span style="font-size:.62rem;font-weight:900;color:var(--g400);text-align:center">單位</span><span style="font-size:.62rem;font-weight:900;color:var(--g400);text-align:right">單價</span><span style="font-size:.62rem;font-weight:900;color:var(--g400);text-align:right">小計</span><span></span>';
      const itmBody=document.createElement('div');itmBody.id='vi-body-'+v._id;

      function renderVCardItems(){
        itmBody.innerHTML='';
        if(!editItems.length){const em=document.createElement('div');em.style.cssText='padding:10px 16px;font-size:.82rem;color:var(--g400)';em.textContent='無細項';itmBody.appendChild(em);return;}
        editItems.forEach((it,i)=>{
          const row=document.createElement('div');
          row.style.cssText='display:grid;grid-template-columns:2fr 50px 45px 80px 85px 32px;gap:4px;padding:6px 14px;border-bottom:1px solid var(--g100);align-items:center;';
          const IS='padding:5px 6px;border:1.5px solid transparent;border-radius:var(--rxs);font-size:.84rem;font-family:inherit;background:transparent;outline:none;width:100%';
          const mkF=el=>{el.addEventListener('focus',()=>el.style.borderColor='var(--gold)');el.addEventListener('blur',()=>el.style.borderColor='transparent');};

          const n=document.createElement('input');n.style.cssText=IS;n.value=it.name||'';n.placeholder='工項名稱';n.addEventListener('input',()=>it.name=n.value);mkF(n);

          const qtyNum=parseFloat((it.qty||'1').toString().replace(/[^\d.]/g,''))||1;
          const q=document.createElement('input');q.type='number';q.style.cssText=IS+'text-align:center';q.value=qtyNum;q.placeholder='數量';
          const u=document.createElement('input');u.style.cssText=IS+'text-align:center';u.value=it.unit||(it.qty||'').toString().replace(/[\d.]/g,'')||'式';u.placeholder='單位';mkF(u);

          const up=document.createElement('input');up.type='number';up.style.cssText=IS+'text-align:right;font-family:monospace';
          up.value=it.unitPrice!=null?it.unitPrice:(qtyNum?Math.round((it.amount||0)/qtyNum):(it.amount||0));
          mkF(up);

          const a=document.createElement('input');a.type='number';a.style.cssText=IS+'text-align:right;font-family:monospace;font-weight:700';a.value=it.amount||0;mkF(a);

          function recalc(){
            const qv=parseFloat(q.value)||1, upv=parseFloat(up.value)||0;
            it.unitPrice=upv;it.qty=qv+(u.value||'式');it.unit=u.value||'式';
            it.amount=Math.round(qv*upv);
            a.value=it.amount;
            updVCardTotal();
          }
          q.addEventListener('input',recalc);
          up.addEventListener('input',recalc);
          u.addEventListener('input',()=>{it.unit=u.value;it.qty=(parseFloat(q.value)||1)+(u.value||'式');});
          a.addEventListener('input',()=>{
            // 手動覆寫小計：反推單價
            it.amount=parseFloat(a.value)||0;
            const qv=parseFloat(q.value)||1;
            it.unitPrice=qv?Math.round(it.amount/qv):it.amount;
            up.value=it.unitPrice;
            updVCardTotal();
          });
          mkF(q);

          const del=document.createElement('button');del.style.cssText='width:26px;height:26px;background:var(--bad-bg);border:1.5px solid var(--bad-bd);color:var(--bad);border-radius:var(--rxs);cursor:pointer;font-size:.75rem;display:flex;align-items:center;justify-content:center';del.textContent='🗑';del.addEventListener('click',()=>{editItems.splice(i,1);renderVCardItems();updVCardTotal();});
          row.appendChild(n);row.appendChild(q);row.appendChild(u);row.appendChild(up);row.appendChild(a);row.appendChild(del);itmBody.appendChild(row);
        });
      }
      function updVCardTotal(){
        const t=editItems.reduce((s,x)=>s+(x.amount||0),0);
        subTotEl.textContent='小計 NT$'+t.toLocaleString();
        hd.querySelector('[style*="gold"]')?.textContent&&(hd.querySelectorAll('div')[2].textContent='NT$'+t.toLocaleString());
      }
      const addItmBtn=document.createElement('button');addItmBtn.style.cssText='display:block;width:100%;text-align:left;padding:8px 16px;font-size:.8rem;font-weight:700;color:var(--g400);background:none;border:none;cursor:pointer;font-family:inherit;border-top:1px dashed var(--g200)';addItmBtn.textContent='＋ 新增細項';addItmBtn.addEventListener('click',()=>{editItems.push({name:'',qty:1,unit:'式',unitPrice:0,amount:0});renderVCardItems();});
      const subTotEl=document.createElement('div');subTotEl.className='vc-sub-total';subTotEl.textContent='小計 NT$'+(v.amount||0).toLocaleString();

      // 儲存列
      const saveBar=document.createElement('div');saveBar.style.cssText='padding:10px 16px;border-top:1px solid var(--g100);display:flex;gap:7px;background:var(--g50)';
      const saveBtn=document.createElement('button');saveBtn.className='btn bg bsm';saveBtn.textContent='💾 儲存修改';
      saveBtn.addEventListener('click',()=>{
        const nv=document.getElementById('ve-vendor-'+v._id)?.value.trim()||v.vendor;
        const nc=document.getElementById('ve-cat-'+v._id)?.value||v.cat;
        const nn=document.getElementById('ve-note-'+v._id)?.value.trim()||'';
        const nt=editItems.reduce((s,x)=>s+(x.amount||0),0);
        DB.upd('vendors',v._id,{vendor:nv,cat:nc,note:nn,amount:nt,items:editItems.map(x=>({...x})),caseN:v.caseN,summary:'廠商報價 '+nv+' '+nc+' NT$'+nt.toLocaleString()});
        renderVendors(vCurrentFilter);updStats();renderAdVendorPicker();showToast('✅ 已更新！');
      });
      const cancelBtn=document.createElement('button');cancelBtn.className='btn bo bsm';cancelBtn.textContent='取消';cancelBtn.addEventListener('click',()=>body.classList.remove('open'));
      saveBar.appendChild(saveBtn);saveBar.appendChild(cancelBtn);

      if(v.imgDataUrl){const iw=document.createElement('div');iw.style.cssText='padding:8px 16px;border-top:1px solid var(--g100);display:flex;gap:8px';const img=document.createElement('img');img.className='ith';img.src=v.imgDataUrl;img.style.cssText='width:80px;height:80px';img.addEventListener('click',()=>openLB(v.imgDataUrl));iw.appendChild(img);body.appendChild(iw);}

      itemWrap.appendChild(itmHd);itemWrap.appendChild(itmBody);itemWrap.appendChild(addItmBtn);
      body.appendChild(basicEdit);body.appendChild(itemWrap);body.appendChild(subTotEl);body.appendChild(saveBar);
      renderVCardItems();

      hd.querySelector('[data-vpay]').addEventListener('click',e=>{e.stopPropagation();openVendorPay(v._id);});
      hd.querySelector('[data-vtgl]').addEventListener('click',e=>{e.stopPropagation();const open=body.classList.toggle('open');hd.querySelector('[data-vtgl]').textContent=open?'▴ 收起':'▾ 明細';});
      hd.querySelector('[data-vdel]').addEventListener('click',e=>{e.stopPropagation();confirmAction('刪除「'+v.vendor+'」？（可在系統設定→垃圾桶復原）',()=>{DB.softDel('vendors',v._id);renderVendors(vCurrentFilter);updStats();renderAdVendorPicker();showToast('✅ 已移至垃圾桶');});});
      // 修正重點：卡片的 CSS 早就設了 cursor:pointer（滑鼠移上去會變成手指），
      // 看起來整個卡片都能點，但點擊事件之前只綁在小小的「▾明細」按鈕上，點卡片其他地方完全沒反應，
      // 跟看起來的樣子不一致。改成點整個卡片（除了付款/明細/刪除這三個按鈕本身）都能展開明細，
      // 跟游標樣式給的視覺提示一致。
      hd.addEventListener('click',()=>{
        const open=body.classList.toggle('open');
        hd.querySelector('[data-vtgl]').textContent=open?'▴ 收起':'▾ 明細';
      });
      card.appendChild(hd);card.appendChild(body);grpBody.appendChild(card);
    });

    list.appendChild(grpHd);
    list.appendChild(grpBody);
  });
}


// ══ 打卡系統 ══════════════════════════════════════════════
let punchInterval=null;
// 兩個座標之間的距離（公尺），拿來算「員工現在距離工地多遠」
function haversineDist(lat1,lng1,lat2,lng2){
  const R=6371000;
  const toRad=d=>d*Math.PI/180;
  const dLat=toRad(lat2-lat1),dLng=toRad(lng2-lng1);
  const a=Math.sin(dLat/2)**2+Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLng/2)**2;
  return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
}

let punchPhotoData=null; // 打卡拍照佐證（base64），選填
let punchCurPos=null; // 目前定位座標，算距離用

function initPunchClock(){
  const el=document.getElementById('punchTime');const de=document.getElementById('punchDate');
  if(!el)return;
  function tick(){
    const n=new Date();
    if(el)el.textContent=n.toLocaleTimeString('zh-TW',{hour12:false});
    if(de)de.textContent=n.toLocaleDateString('zh-TW',{weekday:'long',year:'numeric',month:'long',day:'numeric'});
  }
  tick();if(punchInterval)clearInterval(punchInterval);punchInterval=setInterval(tick,1000);
  renderPunchRec();updatePunchBtn();
  if(typeof renderMyLeaveStatus==='function')renderMyLeaveStatus();

  // 案場選單：帶入之前用過的那個案場，不用每次重選
  const sel=document.getElementById('punchProjectSel');
  if(sel&&typeof buildProjectSelect==='function'){
    const lastId=localStorage.getItem('zeju_last_punch_proj');
    buildProjectSelect(sel,lastId,true);
    if(!sel._geoBound){
      sel._geoBound=true;
      sel.addEventListener('change',updatePunchGeoCard);
    }
  }

  // 先取得一次定位，用來算距離；拿不到定位就跳過，不影響打卡本身
  if(navigator.geolocation&&!punchCurPos){
    navigator.geolocation.getCurrentPosition(
      pos=>{punchCurPos={lat:pos.coords.latitude,lng:pos.coords.longitude,acc:pos.coords.accuracy};updatePunchGeoCard();},
      ()=>{},
      {timeout:6000}
    );
  } else {
    updatePunchGeoCard();
  }

  initPunchPhotoCapture();
  initPunchMapBtn();
}

// 算目前位置距離選定案場多遠，跟案場設定的圍籬半徑比較，顯示狀態（跟截圖那款系統同樣的邏輯）
function updatePunchGeoCard(){
  const card=document.getElementById('punchGeoCard');
  const sel=document.getElementById('punchProjectSel');
  if(!card||!sel)return;
  const pid=sel.value;
  if(!pid||!punchCurPos){card.style.display='none';return;}
  const proj=DB.get('projects').find(p=>String(p._id)===String(pid));
  if(!proj||proj.lat==null||proj.lng==null){
    card.style.display='block';
    document.getElementById('punchDistVal').textContent='尚無座標';
    document.getElementById('punchFenceVal').innerHTML='<span style="color:var(--g400)">這個案場還沒有地址座標，請請老闆到案場總覽補上地址</span>';
    document.getElementById('punchAccuracyVal').textContent='';
    return;
  }
  const dist=haversineDist(punchCurPos.lat,punchCurPos.lng,proj.lat,proj.lng);
  const radius=proj.geofenceRadius||80;
  const inFence=dist<=radius;
  card.style.display='block';
  document.getElementById('punchDistVal').textContent=(dist<1000?Math.round(dist)+'m':((dist/1000).toFixed(2)+'km'));
  document.getElementById('punchFenceVal').innerHTML=inFence
    ?'<span style="color:var(--ok)">✓ 在圍籬範圍內</span>'
    :'<span style="color:var(--warn,#B86820)">⚠ 超出圍籬（半徑'+radius+'m）</span>';
  document.getElementById('punchAccuracyVal').textContent=punchCurPos.acc?('定位精度 ±'+Math.round(punchCurPos.acc)+'m'):'';
}

// 拍照佐證
function initPunchPhotoCapture(){
  const btn=document.getElementById('punchPhotoBtn');
  const file=document.getElementById('punchPhotoFile');
  const del=document.getElementById('punchPhotoDel');
  if(btn&&!btn._bound){
    btn._bound=true;
    btn.addEventListener('click',()=>file?.click());
  }
  if(file&&!file._bound){
    file._bound=true;
    file.addEventListener('change',async e=>{
      const f=e.target.files[0];if(!f)return;e.target.value='';
      const compressed=await compressImage(f,1200,0.7);
      punchPhotoData=compressed||null;
      if(punchPhotoData){
        document.getElementById('punchPhotoImg').src=punchPhotoData;
        document.getElementById('punchPhotoPreview').style.display='block';
      }
    });
  }
  if(del&&!del._bound){
    del._bound=true;
    del.addEventListener('click',()=>{
      punchPhotoData=null;
      document.getElementById('punchPhotoPreview').style.display='none';
      const f=document.getElementById('punchPhotoFile');if(f)f.value='';
    });
  }
}

// 地圖總覽：顯示所有有座標的案場位置
function initPunchMapBtn(){
  const btn=document.getElementById('punchMapBtn');
  if(btn&&!btn._bound){
    btn._bound=true;
    btn.addEventListener('click',openPunchMap);
  }
}

let _leafletLoading=null;
function loadLeaflet(){
  if(window.L)return Promise.resolve();
  if(_leafletLoading)return _leafletLoading;
  _leafletLoading=new Promise((res,rej)=>{
    const css=document.createElement('link');
    css.rel='stylesheet';css.href='https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css';
    document.head.appendChild(css);
    const sc=document.createElement('script');
    sc.src='https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js';
    sc.onload=res;sc.onerror=rej;
    document.head.appendChild(sc);
  });
  return _leafletLoading;
}

async function openPunchMap(){
  openModal('punchMapModal');
  const canvas=document.getElementById('punchMapCanvas');
  const listEl=document.getElementById('punchMapList');
  canvas.innerHTML='<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--g400);font-size:.85rem">地圖載入中…</div>';
  try{ await loadLeaflet(); }catch(e){ canvas.innerHTML='<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--g400);font-size:.85rem">地圖載入失敗，請檢查網路連線</div>'; return; }

  const projects=DB.get('projects').filter(p=>p.lat!=null&&p.lng!=null&&!p.archived);
  canvas.innerHTML='';
  if(!projects.length){
    canvas.innerHTML='<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--g400);font-size:.85rem;text-align:center;padding:20px">尚無案場有座標<br>案場總覽新增／編輯地址後會自動定位</div>';
    listEl.innerHTML='';
    return;
  }
  const center=punchCurPos?[punchCurPos.lat,punchCurPos.lng]:[projects[0].lat,projects[0].lng];
  const map=L.map(canvas).setView(center,12);
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',{attribution:'© OpenStreetMap · CARTO',maxZoom:19}).addTo(map);

  if(punchCurPos){
    L.circleMarker([punchCurPos.lat,punchCurPos.lng],{radius:7,color:'#3B82F6',fillColor:'#3B82F6',fillOpacity:.8}).addTo(map).bindPopup('我的位置');
  }
  const rows=[];
  projects.forEach(p=>{
    const marker=L.circleMarker([p.lat,p.lng],{radius:8,color:'#C8A44A',fillColor:'#C8A44A',fillOpacity:.85}).addTo(map);
    marker.bindPopup('<b>'+esc(p.name||'未命名案場')+'</b><br>'+esc(p.address||''));
    const dist=punchCurPos?haversineDist(punchCurPos.lat,punchCurPos.lng,p.lat,p.lng):null;
    rows.push({p,dist});
  });
  rows.sort((a,b)=>(a.dist??1e15)-(b.dist??1e15));
  listEl.innerHTML=rows.map(({p,dist})=>`
    <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 8px;border-bottom:1px solid var(--g100);cursor:pointer" onclick="document.getElementById('punchProjectSel').value='${p._id}';updatePunchGeoCard();closeModal('punchMapModal');">
      <div>
        <div style="font-size:.85rem;font-weight:800">${esc(p.name||'未命名案場')}</div>
        <div style="font-size:.72rem;color:var(--g400)">${esc(p.address||'')}</div>
      </div>
      <div style="font-size:.78rem;font-weight:800;color:var(--gold-d)">${dist!=null?(dist<1000?Math.round(dist)+'m':(dist/1000).toFixed(1)+'km'):''}</div>
    </div>`).join('');
}

function doPunch(){
  const now=new Date();
  const today=now.toLocaleDateString('zh-TW');
  const todayRecs=DB.get('punch_recs').filter(r=>r.date===today&&r.user===curPunchUser);
  const alreadyIn=todayRecs.some(r=>r.type==='in');
  const alreadyOut=todayRecs.some(r=>r.type==='out');
  // 上班只能打一次，下班只能打一次
  const isIn=!alreadyIn; // 沒打過上班 → 打上班
  if(!isIn&&alreadyOut){showToast('⚠️ 今日已完成上下班打卡！');return;}
  if(isIn&&alreadyIn){showToast('⚠️ 今日已打過上班卡！');return;}
  // 取得定位
  const empName=document.getElementById('uName')?.textContent||curRole;
  const save=(lat,lng,addr)=>{
    DB.push('punch_recs',{
      summary:(isIn?'上班':'下班')+'打卡 '+now.toLocaleTimeString('zh-TW',{hour12:false}),
      user:curPunchUser,userName:empName,date:today,
      time:now.toLocaleTimeString('zh-TW',{hour12:false}),
      type:isIn?'in':'out',
      lat:lat||null,lng:lng||null,addr:addr||null,
      photo:punchPhotoData||null,
      projectId:(()=>{const sel=document.getElementById('punchProjectSel');if(sel?.value){localStorage.setItem('zeju_last_punch_proj',sel.value);return sel.value;}return null;})()
    });
    // 打卡完清空這次的拍照佐證，下一次打卡不會誤帶到上一次的照片
    punchPhotoData=null;
    const preview=document.getElementById('punchPhotoPreview');if(preview)preview.style.display='none';
    const photoFile=document.getElementById('punchPhotoFile');if(photoFile)photoFile.value='';
    renderPunchRec();updatePunchBtn();
    showToast('✅ '+(isIn?'上班':'下班')+'打卡成功！'+now.toLocaleTimeString('zh-TW',{hour12:false}));
  };
  if(navigator.geolocation){
    navigator.geolocation.getCurrentPosition(
      async pos=>{
        const lat=pos.coords.latitude.toFixed(6);
        const lng=pos.coords.longitude.toFixed(6);
        punchCurPos={lat:pos.coords.latitude,lng:pos.coords.longitude,acc:pos.coords.accuracy};
        // 先用座標存檔，背景查地址
        save(lat, lng, lat+','+lng);
        // 修正重點：原本這裡是拿 GPS 座標去問 AI「這是哪個地址」——AI 語言模型本來就不是地圖服務，
        // 沒有精確的地址資料庫，用猜的常常猜不準或乾脆猜不出來，這也是「一直只有座標、沒有中文地址」的原因，
        // 而且每次打卡都要為了這個查詢扣一次 AI 點數，划不來。
        // 改用 OpenStreetMap 的免費地址反查服務（Nominatim），這是真正的地圖資料庫查詢，不是用猜的，也不用扣點。
        try{
          const r=await fetch('https://nominatim.openstreetmap.org/reverse?format=json&lat='+lat+'&lon='+lng+'&accept-language=zh-TW&zoom=18');
          const d=await r.json();
          const a=d.address||{};
          const addr=[a.state||a.county,a.city||a.town||a.district||a.suburb,a.road,a.house_number].filter(Boolean).join('').trim()
            || d.display_name || '';
          if(addr){
            const recs=DB.get('punch_recs');
            if(recs.length&&recs[0].lat===lat){
              DB.upd('punch_recs',recs[0]._id,{addr});
              renderPunchRec&&renderPunchRec();
            }
          }
        }catch(e){console.log('地址查詢失敗:',e.message);}
      },
      ()=>save(null,null,null),
      {timeout:8000, enableHighAccuracy:true}
    );
  }else save(null,null,null);
}



function updatePunchBtn(){
  const btn=document.getElementById('punchBtn');
  const txt=document.getElementById('punchBtnTxt');
  const ico=document.getElementById('punchBtnIco');
  if(!btn)return;
  const today=new Date().toLocaleDateString('zh-TW');
  const todayRecs=DB.get('punch_recs').filter(r=>r.date===today&&r.user===curPunchUser);
  const hasIn=todayRecs.some(r=>r.type==='in');
  const hasOut=todayRecs.some(r=>r.type==='out');
  if(hasIn&&hasOut){
    btn.style.background='linear-gradient(135deg,#718096,#4A5568)';
    btn.style.cursor='not-allowed';btn.style.opacity='.8';
    if(ico)ico.textContent='✅';
    if(txt)txt.textContent='今日已完成';
  }else if(hasIn){
    btn.style.background='linear-gradient(135deg,#3182CE,#2B6CB0)';
    btn.style.cursor='pointer';btn.style.opacity='1';
    if(ico)ico.textContent='👋';
    if(txt)txt.textContent='下班打卡';
  }else{
    btn.style.background='linear-gradient(135deg,#22C55E,#16A34A)';
    btn.style.cursor='pointer';btn.style.opacity='1';
    if(ico)ico.textContent='👆';
    if(txt)txt.textContent='上班打卡';
  }
}


function renderHRPanel(){
  const list=document.getElementById('hrPunchList');if(!list)return;
  const allRecs=DB.get('punch_recs').sort((a,b)=>b._id-a._id);
  if(!allRecs.length){
    list.innerHTML='<div class="empty-state"><div class="es-ic">🕐</div><div class="es-t">尚無打卡記錄</div><div class="es-s">公務帳號打卡後會顯示在這裡</div></div>';
  } else {
    list.innerHTML='';
    // 按日期分組
    const byDate={};
    allRecs.slice(0,100).forEach(r=>{
      if(!byDate[r.date])byDate[r.date]=[];
      byDate[r.date].push(r);
    });
    Object.entries(byDate).forEach(([date,recs])=>{
      const dateHd=document.createElement('div');
      dateHd.style.cssText='font-size:.75rem;font-weight:900;color:var(--g400);padding:10px 0 6px;text-transform:uppercase;letter-spacing:.08em;border-bottom:1.5px solid var(--g200);margin-bottom:4px';
      dateHd.textContent=date;
      list.appendChild(dateHd);
      recs.forEach(r=>{
        const row=document.createElement('div');
        row.style.cssText='display:flex;align-items:center;gap:10px;padding:9px 10px;border-radius:var(--rxs);margin-bottom:3px;background:var(--g50)';
        const nameLabel=r.userName||r.user||'員工';
        const roleLabel=r.user&&r.user.startsWith('emp_')?'個人帳號':({owner:'老闆',staff:'員工',punch:'公務'}[r.user]||r.user);
        row.innerHTML=
          '<span style="font-size:1rem">'+(r.type==='in'?'🟢':'🔴')+'</span>'+
          '<div style="flex:1">'+
            '<div style="font-size:.88rem;font-weight:800">'+nameLabel+
              ' <span style="font-size:.7rem;background:var(--info-bg);color:var(--info);padding:1px 7px;border-radius:10px;font-weight:700">'+roleLabel+'</span>'+
            '</div>'+
            '<div style="font-size:.75rem;color:var(--g500);margin-top:1px">'+(r.type==='in'?'上班打卡':'下班打卡')+'</div>'+
          '</div>'+
          '<div style="text-align:right">'+
            '<div style="font-family:monospace;font-weight:900;font-size:.92rem">'+r.time+'</div>'+
            (r.lat?'<div style="font-size:.68rem;color:var(--g400);margin-top:2px">📍 '+r.lat+', '+r.lng+'</div>':
             '<div style="font-size:.68rem;color:var(--g300);margin-top:2px">無定位</div>')+
          '</div>';
        list.appendChild(row);
      });
    });
  }

  // 審核請求
  const reqList=document.getElementById('hrRequestList');if(!reqList)return;
  const reqs=DB.get('punch_requests').filter(r=>r.status==='pending');
  if(!reqs.length){
    reqList.innerHTML='<div class="empty-state"><div class="es-ic">📋</div><div class="es-t">尚無待審核申請</div></div>';return;
  }
  reqList.innerHTML='';
  reqs.forEach(r=>{
    const card=document.createElement('div');card.style.cssText='background:var(--warn-bg);border:1.5px solid var(--warn-bd);border-radius:var(--rs);padding:12px 16px;margin-bottom:8px';
    card.innerHTML=
      '<div style="font-size:.88rem;font-weight:800">'+r.date+' · '+(r.userName||r.user||'員工')+'</div>'+
      '<div style="font-size:.82rem;color:var(--g600);margin:6px 0 10px">申請原因：'+r.reason+'</div>'+
      '<div style="display:flex;gap:7px">'+
        '<button class="btn bgn bsm" onclick="approveReq('+r._id+')">✅ 核准</button>'+
        '<button class="btn brd bsm" onclick="rejectReq('+r._id+')">❌ 拒絕</button>'+
      '</div>';
    reqList.appendChild(card);
  });
}
function approveReq(id){DB.upd('punch_requests',id,{status:'approved'});renderHRPanel();updateHRBadge();showToast('✅ 已核准。');}
function rejectReq(id){DB.upd('punch_requests',id,{status:'rejected'});renderHRPanel();updateHRBadge();showToast('✅ 已拒絕。');}

// ══ 廠商報價搜尋：篩選邏輯已整合進 renderVendorCatFilters ══════════════

// ══ 升級 setupApp ══════════════════════════════════════════
// setupApp 覆寫 v1 - 移到下方統一版本

// ══ 帳款 Modal 上傳 AI 辨識 ══════════════════════════════


document.getElementById('ldZone')?.addEventListener('click',()=>document.getElementById('ldFile').click());
document.getElementById('ldFile').addEventListener('change',async e=>{
  const f=e.target.files[0];if(!f)return;e.target.value='';
  const rd=new FileReader();
  rd.onload=async ev=>{
    ldImgUrl=ev.target.result;
    const fc=document.getElementById('ldFileCard');fc.style.display='block';
    const thumb=document.getElementById('ldThumb');
    if(f.type.startsWith('image/')){thumb.src=ldImgUrl;thumb.style.display='block';}
    else{thumb.style.display='none';}
    document.getElementById('ldFileName').textContent=f.name;
    document.getElementById('ldFileStatus').textContent='已上傳';
    const ocr=document.getElementById('ldOcr');ocr.classList.add('show');
    try{
      const b64=ldImgUrl.split(',')[1],mime=f.type.startsWith('image/')?f.type:'application/pdf';
      const contentType=f.type.startsWith('image/')?'image':'document';
      const parts=[
        {type:contentType,source:{type:'base64',media_type:mime,data:b64}},
        {type:'text',text:'請從這張單據/發票辨識以下資訊，只回覆純JSON（不加```）：{"date":"YYYY-MM-DD","amount":金額數字,"desc":"說明文字","items":[{"name":"項目名稱","amount":金額}]}。無法辨識的填空字串或0。'}
      ];
      const rep=await callAI('ac',parts,3000,30,'帳款憑證辨識');
      const dat=JSON.parse(rep.replace(/```json|```/g,'').trim());
      if(dat.date)document.getElementById('ldDate').value=dat.date;
      if(dat.amount)document.getElementById('ldAmt').value=dat.amount;
      if(dat.desc)document.getElementById('ldDesc').value=dat.desc;
      if(dat.items&&dat.items.length){ldItems=dat.items;renderLdItems();}
      document.getElementById('ldFileStatus').textContent='✅ AI 辨識完成';
    }catch(err){document.getElementById('ldFileStatus').textContent='AI辨識失敗，請手動填寫（'+friendlyAIError(err).replace('⚠️ ','')+'）';}
    ocr.classList.remove('show');
  };rd.readAsDataURL(f);
});

document.getElementById('ldDelFile')?.addEventListener('click',()=>{
  ldImgUrl=null;document.getElementById('ldFileCard').style.display='none';document.getElementById('ldFile').value='';
});

document.getElementById('ldAddItem')?.addEventListener('click',()=>{
  ldItems.push({name:'',amount:0});renderLdItems();
});

function renderLdItems(){
  const c=document.getElementById('ldItemsTable');if(!c)return;c.innerHTML='';
  ldItems.forEach((it,i)=>{
    const row=document.createElement('div');
    row.style.cssText='display:grid;grid-template-columns:1fr 110px 34px;gap:6px;padding:5px 0;align-items:center;border-bottom:1px solid var(--g100)';
    const n=document.createElement('input');n.style.cssText='padding:7px 10px;border:1.5px solid var(--g200);border-radius:var(--rxs);font-size:.85rem;font-family:inherit;outline:none;width:100%';
    n.placeholder='項目名稱';n.value=it.name||'';n.addEventListener('input',()=>it.name=n.value);
    n.addEventListener('focus',()=>n.style.borderColor='var(--gold)');n.addEventListener('blur',()=>n.style.borderColor='var(--g200)');
    const a=document.createElement('input');a.type='number';
    a.style.cssText='padding:7px 10px;border:1.5px solid var(--g200);border-radius:var(--rxs);font-size:.85rem;font-family:inherit;outline:none;width:100%;text-align:right;font-family:\'DM Mono\',monospace';
    a.placeholder='金額';a.value=it.amount||0;a.addEventListener('input',()=>it.amount=parseFloat(a.value)||0);
    a.addEventListener('focus',()=>a.style.borderColor='var(--gold)');a.addEventListener('blur',()=>a.style.borderColor='var(--g200)');
    const del=document.createElement('button');
    del.style.cssText='width:30px;height:30px;background:var(--bad-bg);border:1.5px solid var(--bad-bd);color:var(--bad);border-radius:var(--rxs);cursor:pointer;font-size:.8rem;display:flex;align-items:center;justify-content:center';
    del.textContent='🗑';del.addEventListener('click',()=>{ldItems.splice(i,1);renderLdItems();});
    row.appendChild(n);row.appendChild(a);row.appendChild(del);c.appendChild(row);
  });
}

// 覆寫 openLedgerModal 加入重置
;

// 覆寫 addLedgerBtn 加上細項和圖片
document.getElementById('addLedgerBtn')?.addEventListener('click',()=>{
  const amt=parseInt(document.getElementById('ldAmt').value)||ldItems.reduce((s,x)=>s+(x.amount||0),0);
  const desc=document.getElementById('ldDesc').value.trim();
  const cat=document.getElementById('ldCat').value;
  const date=document.getElementById('ldDate').value;
  const pid=document.getElementById('ldCase').value;
  const proj=pid?DB.get('projects').find(p=>String(p._id)===String(pid)):null;
  const caseN=proj?.name||'';
  if(!amt&&!ldItems.length){showToast('⚠️ 請填入金額');return;}
  const bookLabel=curLedgerBook==='out'?'內帳':'外帳';
  DB.push('ledger',{
    summary:bookLabel+(curLedgerType==='in'?'收入':'支出')+' '+desc+' '+fmt(amt||ldItems.reduce((s,x)=>s+(x.amount||0),0)),
    book:curLedgerBook,type:curLedgerType,amount:amt,desc,cat,date,caseN,projectId:pid?parseInt(pid):null,items:ldItems.map(x=>({...x})),imgUrl:ldImgUrl
  });
  closeModal('ledgerModal');renderLedger();updLedgerStats();renderHistory();showToast('✅ 已儲存！');
});

// ══ 合約編輯 ══════════════════════════════════════════════




// openContract 重置 ctEditId


// ══ 工程進度 ══════════════════════════════════════════════
let progEditId=null, progItems=[];

document.getElementById('addProgressBtn')?.addEventListener('click',()=>{
  progEditId=null;progItems=[
    {text:'合約簽訂',done:false,date:''},
    {text:'開工確認',done:false,date:''},
    {text:'施工進行中',done:false,date:''},
    {text:'驗收',done:false,date:''},
    {text:'結案',done:false,date:''},
  ];
  if(typeof buildProjectSelect==='function')buildProjectSelect(document.getElementById('progCase'),curProjectId);
  const progClientEl=document.getElementById('progClient');if(progClientEl)progClientEl.value='';
  document.getElementById('progStatus').value='pending';
  document.getElementById('progModalTitle').innerHTML='新增案場進度 <button class="mcl" data-close="progressModal">✕</button>';
  renderProgItems();openModal('progressModal');
});

document.getElementById('addProgItemBtn')?.addEventListener('click',()=>{
  progItems.push({text:'',done:false,date:''});renderProgItems();
});

// 補充上傳：一份報價單很多頁的話，可以分好幾次上傳，每次辨識到的工項會累加進去，
// 不會蓋掉前面已經辨識好的內容——每次最多處理5張，超過的話會自動分批依序處理，並顯示目前處理到第幾批
document.getElementById('vSupplementBtn')?.addEventListener('click',()=>{
  document.getElementById('vSupplementFile')?.click();
});
document.getElementById('vSupplementFile')?.addEventListener('change',async e=>{
  const files=Array.from(e.target.files).filter(f=>f.type.startsWith('image/'));
  e.target.value='';
  if(!files.length){showToast('⚠️ 請選擇圖片檔案');return;}

  const ocr=document.getElementById('vOcr');
  const readImg=f=>new Promise(res=>{const rd=new FileReader();rd.onload=ev=>res({b64:ev.target.result.split(',')[1],mime:f.type});rd.readAsDataURL(f);});
  const imgs=await Promise.all(files.map(readImg));

  // 每批最多5張，超過的話自動分成好幾批依序送出，避免單次請求塞太多圖片
  const BATCH_SIZE=5;
  const batches=[];
  for(let i=0;i<imgs.length;i+=BATCH_SIZE)batches.push(imgs.slice(i,i+BATCH_SIZE));

  ocr.classList.add('show');
  let totalAppended=0;
  for(let b=0;b<batches.length;b++){
    // #vOcr 的文字是直接掛在 div 底下的文字節點（前面三個 .sdot 是轉圈圈動畫），
    // 找最後一個文字節點來更新目前處理進度，其他 .sdot 元素不動
    const textNode=Array.from(ocr.childNodes).find(n=>n.nodeType===3)||ocr;
    textNode.textContent=' AI 辨識中（補充上傳 第'+(b+1)+'／'+batches.length+'批）…';
    try{
      const content=[];
      batches[b].forEach((img,i)=>{
        content.push({type:'image',source:{type:'base64',media_type:img.mime,data:img.b64}});
        content.push({type:'text',text:'（補充頁面 '+(i+1)+'）'});
      });
      content.push({type:'text',text:getVendorPrompt()+'\n\n注意：這是補充上傳的額外頁面，請辨識這幾張裡的所有細項。'});
      const rep=await callAI('ad',content,3000,100,'廠商報價辨識（補充）');
      const dat=JSON.parse(rep.replace(/```json|```/g,'').trim());
      appendVendorItems(dat);
      totalAppended++;
    }catch(err){
      console.log('補充上傳 OCR err',err);
      showToast('⚠️ 第'+(b+1)+'批辨識失敗：'+friendlyAIError(err));
    }
  }
  ocr.classList.remove('show');
  if(totalAppended<batches.length){
    showToast('⚠️ 部分批次辨識失敗，已補上成功的部分，失敗的頁面可以再試一次或手動輸入');
  }
});
