function getVendorPrompt(){
  return '請仔細辨識這份廠商報價單的所有內容。\n只回覆純JSON（不要加```），格式：\n{"vendor":"廠商完整名稱","case":"案場名稱沒有則空字串","cat":"工程類別只能填系統櫃廚具玻璃水電泥作油漆鐵件其他之一","note":"備注如含安裝不含稅等","items":[{"name":"工項名稱","qty":"數量與單位如3坪或1式","amount":金額數字}]}\n請盡量列出所有細項，金額盡量辨識為數字。無法辨識的填空字串或0。';
}

function applyVendorResult(dat){
  if(dat.vendor) document.getElementById('vVd').value=dat.vendor;
  if(dat.case)   document.getElementById('vCs').value=dat.case;
  if(dat.note)   document.getElementById('vNt').value=dat.note;
  if(dat.cat){
    const sel=document.getElementById('vCat');
    const opts=['系統櫃','廚具','玻璃','水電','泥作','油漆','鐵件','其他'];
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
      rep=await callAI('ad',content,3000);
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
      ],2000);
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
      rep=await callAI('ad',getVendorPrompt()+'\n\n以下是報價單文字內容（請根據此內容辨識）：\n'+text,3000);
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
document.getElementById('vManualBtn')?.addEventListener('click',()=>{document.getElementById('vResult').style.display='block';});

document.getElementById('addVBtn')?.addEventListener('click',()=>{
  const vd=document.getElementById('vVd').value.trim(),cat=document.getElementById('vCat').value;
  const cs=document.getElementById('vCs').value.trim(),nt=document.getElementById('vNt').value.trim();
  if(!vd&&!vItems.length){showToast('請填入廠商名稱');return;}
  const total=vItems.reduce((s,it)=>s+(it.amount||0),0);
  const ups=uSt['vUp']||{imgs:[]};const imgUrl=ups.imgs?.[0]?.url||null;
  DB.push('vendors',{summary:'廠商報價 '+vd+' '+cat+' '+fmt(total),vendor:vd,cat,caseN:cs,amount:total,note:nt,projectId:curProjectId||null,items:vItems.map(it=>({name:it.name,qty:it.qty,unit:it.unit||'式',unitPrice:it.unitPrice||0,amount:it.amount||0,note:it.note||''})),imgDataUrl:imgUrl});
  closeModal('vModal');renderVendors(vCurrentFilter);updStats();renderAdVendorPicker();renderHistory();showToast('✅ 廠商報價已儲存！');
});

document.getElementById('vFilt').addEventListener('click',e=>{
  const btn=e.target.closest('[data-cat]');if(!btn)return;
  document.querySelectorAll('#vFilt [data-cat]').forEach(b=>{b.className='btn bo bsm';});btn.className='btn bg bsm';
  vCurrentFilter=btn.dataset.cat;renderVendors(vCurrentFilter);
});

const VICO={系統櫃:'🪵',廚具:'🍳',玻璃:'🪟',水電:'⚡',泥作:'🧱',油漆:'🎨',鐵件:'🔩',其他:'📦'};

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
    const grpHd=document.createElement('div');
    grpHd.style.cssText='display:flex;align-items:center;justify-content:space-between;padding:10px 16px;background:linear-gradient(135deg,var(--gold-pale),#FFF0C0);border:1.5px solid var(--gold-l);border-radius:var(--r-sm);margin-bottom:6px;cursor:pointer;user-select:none';
    grpHd.innerHTML=
      '<div style="display:flex;align-items:center;gap:10px">'+
        '<span style="font-size:1.1rem">📍</span>'+
        '<div>'+
          '<div style="font-size:.95rem;font-weight:900;color:var(--gold-d)">'+caseName+'</div>'+
          '<div style="font-size:.75rem;color:var(--g400);margin-top:1px">共 '+vendors.length+' 筆廠商報價</div>'+
        '</div>'+
      '</div>'+
      '<div style="text-align:right">'+
        '<div style="font-family:monospace;font-size:1rem;font-weight:900;color:var(--gold-d)">NT$'+caseTotal.toLocaleString()+'</div>'+
        '<div style="font-size:.68rem;color:var(--g400)">案場合計</div>'+
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
          '<div style="font-size:.9rem;font-weight:900">'+v.vendor+
            ' <span style="font-size:.68rem;background:var(--gold-pale);color:var(--gold-d);padding:2px 8px;border-radius:20px;font-weight:800">'+v.cat+'</span>'+
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
      basicEdit.innerHTML=
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px">'+
          '<div><div style="font-size:.62rem;font-weight:900;color:var(--g400);text-transform:uppercase;letter-spacing:.08em;margin-bottom:4px">廠商名稱</div>'+
          '<input id="ve-vendor-'+v._id+'" style="width:100%;padding:7px 10px;border:1.5px solid var(--g200);border-radius:var(--rxs);font-size:.85rem;font-family:inherit;outline:none" value="'+esc(v.vendor||'')+'"></div>'+
          '<div><div style="font-size:.62rem;font-weight:900;color:var(--g400);text-transform:uppercase;letter-spacing:.08em;margin-bottom:4px">工程類別</div>'+
          '<select id="ve-cat-'+v._id+'" style="width:100%;padding:7px 10px;border:1.5px solid var(--g200);border-radius:var(--rxs);font-size:.85rem;font-family:inherit;outline:none">'+
          ['系統櫃','廚具','玻璃','水電','泥作','油漆','鐵件','其他'].map(o=>'<option'+(o===v.cat?' selected':'')+'>'+o+'</option>').join('')+'</select></div>'+
        '</div>'+
        '<div><div style="font-size:.62rem;font-weight:900;color:var(--g400);text-transform:uppercase;letter-spacing:.08em;margin-bottom:4px">備注</div>'+
        '<input id="ve-note-'+v._id+'" style="width:100%;padding:7px 10px;border:1.5px solid var(--g200);border-radius:var(--rxs);font-size:.85rem;font-family:inherit;outline:none" value="'+esc(v.note||'')+'" placeholder="例：含安裝、不含稅…"></div>';

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
      card.appendChild(hd);card.appendChild(body);grpBody.appendChild(card);
    });

    list.appendChild(grpHd);
    list.appendChild(grpBody);
  });
}


// ══ 打卡系統 ══════════════════════════════════════════════
let punchInterval=null;
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
      projectId:(()=>{const sel=document.getElementById('punchProjectSel');if(sel?.value){localStorage.setItem('zeju_last_punch_proj',sel.value);return sel.value;}return null;})()
    });
    renderPunchRec();updatePunchBtn();
    showToast('✅ '+(isIn?'上班':'下班')+'打卡成功！'+now.toLocaleTimeString('zh-TW',{hour12:false}));
    // 推送到 Firebase（即時跨裝置同步）
    // Firebase 已透過 _cloudSet 自動同步
    // 也推送到 window.storage
    if(typeof window.storage!=='undefined'){
      const recs=DB.get('punch_recs');
      window.storage.set('z7_punch_recs',JSON.stringify(recs)).catch(()=>{});
    }
  };
  if(navigator.geolocation){
    navigator.geolocation.getCurrentPosition(
      async pos=>{
        const lat=pos.coords.latitude.toFixed(6);
        const lng=pos.coords.longitude.toFixed(6);
        // 先用座標存檔，背景查地址
        save(lat, lng, lat+','+lng);
        // 用 Claude AI 反查台灣繁體中文地址
        {
          try{
            const r=await fetch('/.netlify/functions/ai-proxy', { method:'POST', headers:{'Content-Type':'application/json'},
              body:JSON.stringify({
                model:'claude-sonnet-4-6',
                max_tokens:3000,
                messages:[{
                  role:'user',
                  content:'GPS座標：緯度'+lat+'，經度'+lng+'。這是台灣哪個地址？只回覆繁體中文地址，格式：縣市＋區＋路名，例如「台北市大安區信義路四段」，不要其他文字。'
                }]
              })
            });
            const d=await r.json();
            const addr=(d.content?.[0]?.text||'').trim();
            if(addr&&addr.length>4&&!addr.includes('{')){
              // 更新打卡記錄的地址
              const recs=DB.get('punch_recs');
              if(recs.length&&recs[0].lat===lat){
                recs[0].addr=addr;
                DB.set('punch_recs',recs);
                renderPunchRec&&renderPunchRec();
              }
            }
            // 扣點
            const tu=(d.usage?.input_tokens||0)+(d.usage?.output_tokens||0);
            const pts=Math.min(30,Math.max(1,Math.round(tu/20)));
            POINTS=Math.max(0,POINTS-pts);
            localStorage.setItem('zeju_pts',POINTS);
            if(typeof window.storage!=='undefined')window.storage.set('zeju_pts',String(POINTS)).catch(()=>{});
            const pe=document.getElementById('ptsNum');if(pe)pe.textContent=POINTS.toLocaleString();
            const _now=new Date();
            DB.push('billing',{
              summary:'打卡地址查詢 -'+pts+'點',
              desc:'打卡地址查詢',role:'punch',
              points:pts,tokens:tu,user:curPunchUser||'punch',
              ts:_now.toLocaleString('zh-TW'),
              month:_now.getFullYear()+'-'+(_now.getMonth()+1).toString().padStart(2,'0'),
              day:_now.toLocaleDateString('zh-TW'),
            });
          }catch(e){console.log('地址查詢失敗:',e.message);}
        }
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

// ══ 廠商報價搜尋：覆寫篩選邏輯 ══════════════════════════
const _origFilt=document.getElementById('vFilt');
if(_origFilt){
  _origFilt.addEventListener('click',e=>{
    const btn=e.target.closest('[data-cat]');if(!btn)return;
    document.querySelectorAll('#vFilt [data-cat]').forEach(b=>b.className='btn bo bsm');
    btn.className='btn bg bsm';
    vCurrentFilter=btn.dataset.cat;renderVendors(vCurrentFilter);updVCaseFilter();
  });
}

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
      const rep=await callAI(curLedgerType==='in'?'ac':'ac',parts,3000);
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
  const caseN=document.getElementById('ldCase').value.trim();
  if(!amt&&!ldItems.length){showToast('⚠️ 請填入金額');return;}
  const bookLabel=curLedgerBook==='out'?'內帳':'外帳';
  DB.push('ledger',{
    summary:bookLabel+(curLedgerType==='in'?'收入':'支出')+' '+desc+' '+fmt(amt||ldItems.reduce((s,x)=>s+(x.amount||0),0)),
    book:curLedgerBook,type:curLedgerType,amount:amt,desc,cat,date,caseN,projectId:curProjectId||null,items:ldItems.map(x=>({...x})),imgUrl:ldImgUrl
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
  ['progCase','progClient'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
  document.getElementById('progStatus').value='pending';
  document.getElementById('progModalTitle').innerHTML='新增案場進度 <button class="mcl" data-close="progressModal">✕</button>';
  renderProgItems();openModal('progressModal');
});

document.getElementById('addProgItemBtn')?.addEventListener('click',()=>{
  progItems.push({text:'',done:false,date:''});renderProgItems();
});
