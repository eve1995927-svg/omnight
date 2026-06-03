const https = require('https');

exports.handler = async (event) => {
  // CORS preflight
  if(event.httpMethod === 'OPTIONS'){
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST,OPTIONS'
      },
      body: ''
    };
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const { name, today, sections } = body;

    // 用 ExcelJS 生成
    const ExcelJS = require('exceljs');
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('澤居報價單');

    const BLUEH = '4472C4';
    const WHITE = 'FFFFFF';
    const YELLOW = 'FFFF00';
    const RED = 'C00000';
    const NUMS = ['一','二','三','四','五','六','七','八','九','十','十一','十二','十三','十四'];

    // 欄寬
    ws.columns = [
      {key:'a', width:8},
      {key:'b', width:32},
      {key:'c', width:8},
      {key:'d', width:8},
      {key:'e', width:12},
      {key:'f', width:12},
      {key:'g', width:18},
    ];

    const allBorder = {
      top:{style:'thin'}, bottom:{style:'thin'},
      left:{style:'thin'}, right:{style:'thin'}
    };
    const medBorder = {
      top:{style:'medium'}, bottom:{style:'medium'},
      left:{style:'medium'}, right:{style:'medium'}
    };

    // R1 公司名
    ws.getRow(1).height = 38;
    ws.mergeCells('A1:G1');
    const r1 = ws.getCell('A1');
    r1.value = '澤　居　室　內　裝　修';
    r1.font = {bold:true, size:16, name:'新細明體'};
    r1.alignment = {horizontal:'center', vertical:'middle'};
    r1.border = allBorder;

    // R2
    ws.getRow(2).height = 20;
    ws.mergeCells('A2:D2');
    ws.getCell('A2').value = '業主：' + (name||'');
    ws.getCell('A2').font = {size:11, name:'新細明體'};
    ws.getCell('A2').alignment = {horizontal:'left', vertical:'middle'};
    ws.getCell('A2').border = allBorder;
    ws.mergeCells('E2:F2');
    ws.getCell('E2').value = '製表：';
    ws.getCell('E2').font = {size:11, name:'新細明體'};
    ws.getCell('E2').border = allBorder;
    ws.getCell('G2').value = '陳鴻彬';
    ws.getCell('G2').font = {size:11, name:'新細明體'};
    ws.getCell('G2').alignment = {horizontal:'center', vertical:'middle'};
    ws.getCell('G2').border = allBorder;

    // R3
    ws.getRow(3).height = 20;
    ws.mergeCells('A3:D3');
    ws.getCell('A3').value = '地址：';
    ws.getCell('A3').font = {size:11, name:'新細明體'};
    ws.getCell('A3').alignment = {horizontal:'left', vertical:'middle'};
    ws.getCell('A3').border = allBorder;
    ws.mergeCells('E3:F3');
    ws.getCell('E3').value = '日期：' + (today||'');
    ws.getCell('E3').font = {size:11, name:'新細明體'};
    ws.getCell('E3').border = allBorder;
    ws.getCell('G3').value = '報價有效期限15日';
    ws.getCell('G3').font = {size:10, color:{argb:'FF'+RED}, name:'新細明體'};
    ws.getCell('G3').alignment = {horizontal:'center', vertical:'middle'};
    ws.getCell('G3').border = allBorder;

    // R4
    ws.getRow(4).height = 16;
    ws.mergeCells('A4:G4');
    ws.getCell('A4').value = '報價總單';
    ws.getCell('A4').font = {size:11, name:'新細明體'};
    ws.getCell('A4').alignment = {horizontal:'center', vertical:'middle'};
    ws.getCell('A4').border = allBorder;

    // R5 表頭
    ws.getRow(5).height = 24;
    ['項次','工程種類別','單位','數量','單價','複價','備註'].forEach((h,i)=>{
      const col = String.fromCharCode(65+i);
      const c = ws.getCell(col+'5');
      c.value = h;
      c.font = {bold:true, size:12, color:{argb:'FF'+WHITE}, name:'新細明體'};
      c.fill = {type:'pattern', pattern:'solid', fgColor:{argb:'FF'+BLUEH}};
      c.alignment = {horizontal:'center', vertical:'middle'};
      c.border = medBorder;
    });

    // 計算
    let grand = 0;
    const secTotals = [];
    (sections||[]).forEach(sec=>{
      const t = (sec.items||[]).reduce((a,it)=>a+(it.price||0)*(it.qty||1), 0);
      secTotals.push(Math.round(t));
      grand += Math.round(t);
    });
    const tax = Math.round(grand*0.05);

    // R6-19
    for(let i=0;i<14;i++){
      const r = 6+i;
      ws.getRow(r).height = 22;
      const sec = (sections||[])[i];
      const st = secTotals[i]||0;
      
      ['A','B','C','D','E','F','G'].forEach(col=>{
        ws.getCell(col+r).border = allBorder;
      });
      ws.getCell('A'+r).value = NUMS[i];
      ws.getCell('A'+r).font = {size:12, name:'新細明體'};
      ws.getCell('A'+r).alignment = {horizontal:'center', vertical:'middle'};
      ws.getCell('B'+r).value = sec ? sec.name : '';
      ws.getCell('B'+r).font = {size:11, name:'新細明體'};
      ws.getCell('B'+r).alignment = {horizontal:'center', vertical:'middle'};
      ws.getCell('C'+r).value = '式';
      ws.getCell('C'+r).alignment = {horizontal:'center', vertical:'middle'};
      ws.getCell('D'+r).value = 1;
      ws.getCell('D'+r).alignment = {horizontal:'center', vertical:'middle'};
      ws.getCell('F'+r).value = st;
      ws.getCell('F'+r).font = {bold:true, size:12, color:{argb:'FF'+RED}, name:'新細明體'};
      ws.getCell('F'+r).numFmt = '#,##0';
      ws.getCell('F'+r).alignment = {horizontal:'right', vertical:'middle'};
    }

    // R20-22
    ws.getRow(20).height = 20;
    ws.mergeCells('A20:E20');
    ['A','B','C','D','E','F','G'].forEach(col=>ws.getCell(col+'20').border=allBorder);
    ws.getCell('F20').value = grand;
    ws.getCell('F20').font = {bold:true, size:12, color:{argb:'FF'+RED}};
    ws.getCell('F20').numFmt = '#,##0';
    ws.getCell('F20').alignment = {horizontal:'right', vertical:'middle'};

    ws.getRow(21).height = 20;
    ws.mergeCells('A21:E21');
    ['A','B','C','D','E','F','G'].forEach(col=>ws.getCell(col+'21').border=allBorder);
    ws.getCell('A21').value = '稅金5%';
    ws.getCell('A21').font = {size:11, name:'新細明體'};
    ws.getCell('A21').alignment = {horizontal:'center', vertical:'middle'};
    ws.getCell('F21').value = tax;
    ws.getCell('F21').font = {bold:true, size:12, color:{argb:'FF'+RED}};
    ws.getCell('F21').numFmt = '#,##0';
    ws.getCell('F21').alignment = {horizontal:'right', vertical:'middle'};

    ws.getRow(22).height = 24;
    ws.mergeCells('A22:E22');
    ['A','B','C','D','E','F','G'].forEach(col=>ws.getCell(col+'22').border=medBorder);
    ws.getCell('A22').value = '合計';
    ws.getCell('A22').font = {bold:true, size:13, name:'新細明體'};
    ws.getCell('A22').alignment = {horizontal:'center', vertical:'middle'};
    ws.getCell('F22').value = grand + tax;
    ws.getCell('F22').font = {bold:true, size:13, color:{argb:'FF'+RED}};
    ws.getCell('F22').numFmt = '#,##0';
    ws.getCell('F22').alignment = {horizontal:'right', vertical:'middle'};

    // R23 備注
    ws.getRow(23).height = 68;
    ws.mergeCells('A23:G23');
    ws.getCell('A23').value = '備註：一. 付款方式：第一期訂金30%，第二期施工進場3天內30%，第三期完成7成30%，第四期尾款驗收後10%\n二. 每期請款請於提出後3日內付清，否則保留停工之權利\n三. 此報價單確認無誤後請簽名回傳，即轉為正式合約';
    ws.getCell('A23').font = {size:10, name:'新細明體'};
    ws.getCell('A23').alignment = {horizontal:'left', vertical:'top', wrapText:true};
    ws.getCell('A23').border = allBorder;

    ws.getRow(24).height = 10;
    ws.mergeCells('A24:G24');
    ws.getCell('A24').border = allBorder;

    ws.getRow(25).height = 18;
    ws.mergeCells('A25:G25');
    ws.getCell('A25').value = '匯款資訊：銀行代碼：050　台灣企銀-八德分行　戶名：澤居室內裝修　帳號：7505400208531';
    ws.getCell('A25').font = {bold:true, size:10, name:'新細明體'};
    ws.getCell('A25').alignment = {horizontal:'left', vertical:'middle'};
    ws.getCell('A25').border = allBorder;

    ws.getRow(26).height = 52;
    ws.mergeCells('A26:C26');
    ws.getCell('A26').value = '公司蓋章處';
    ws.getCell('A26').font = {bold:true, size:12, name:'新細明體'};
    ws.getCell('A26').alignment = {horizontal:'center', vertical:'middle'};
    ws.getCell('A26').border = allBorder;
    ws.mergeCells('D26:G26');
    ws.getCell('D26').value = '客戶回簽處';
    ws.getCell('D26').font = {bold:true, size:12, name:'新細明體'};
    ws.getCell('D26').alignment = {horizontal:'center', vertical:'middle'};
    ws.getCell('D26').border = allBorder;

    ws.pageSetup = {
      orientation:'portrait', paperSize:9,
      fitToPage:true, fitToWidth:1, fitToHeight:1,
      margins:{left:0.4, right:0.4, top:0.5, bottom:0.5}
    };

    // 細項 Sheets
    const usedNames = ['澤居報價單'];
    (sections||[]).forEach((sec,si)=>{
      let sname = (sec.name||'工程').substring(0,8);
      if(usedNames.includes(sname)) sname = sname.substring(0,6)+si;
      usedNames.push(sname);
      const ws2 = wb.addWorksheet(sname);
      ws2.columns = [{width:8},{width:36},{width:8},{width:8},{width:12},{width:12},{width:18}];
      
      const items = sec.items||[];
      const st = secTotals[si]||0;

      ws2.getRow(1).height=20;
      ws2.mergeCells('A1:D1');
      ws2.getCell('A1').value='業主：'+(name||'');ws2.getCell('A1').font={size:11,name:'新細明體'};ws2.getCell('A1').alignment={horizontal:'left',vertical:'middle'};ws2.getCell('A1').border=allBorder;
      ws2.mergeCells('E1:F1');ws2.getCell('E1').value='製表：';ws2.getCell('E1').font={size:11,name:'新細明體'};ws2.getCell('E1').border=allBorder;
      ws2.getCell('G1').value='日期：'+(today||'');ws2.getCell('G1').font={size:11,name:'新細明體'};ws2.getCell('G1').border=allBorder;
      
      ws2.getRow(2).height=20;ws2.mergeCells('A2:G2');
      ws2.getCell('A2').value='地址：';ws2.getCell('A2').font={size:11,name:'新細明體'};ws2.getCell('A2').alignment={horizontal:'left',vertical:'middle'};ws2.getCell('A2').border=allBorder;
      
      ws2.getRow(3).height=16;ws2.mergeCells('A3:G3');
      ws2.getCell('A3').value='報價細項表';ws2.getCell('A3').font={size:11,name:'新細明體'};ws2.getCell('A3').alignment={horizontal:'center',vertical:'middle'};ws2.getCell('A3').border=allBorder;
      
      ws2.getRow(4).height=24;
      ['項次','工程種類別','單位','數量','單價','複價','備註'].forEach((h,i)=>{
        const col=String.fromCharCode(65+i);const c=ws2.getCell(col+'4');
        c.value=h;c.font={bold:true,size:12,color:{argb:'FF'+WHITE},name:'新細明體'};
        c.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF'+BLUEH}};
        c.alignment={horizontal:'center',vertical:'middle'};c.border=medBorder;
      });

      ws2.getRow(5).height=22;ws2.mergeCells('A5:E5');
      ws2.getCell('A5').value=sec.name||'';ws2.getCell('A5').font={bold:true,size:12,name:'新細明體'};
      ws2.getCell('A5').fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF'+YELLOW}};
      ws2.getCell('A5').alignment={horizontal:'center',vertical:'middle'};ws2.getCell('A5').border=allBorder;
      ws2.getCell('F5').value='合計';ws2.getCell('F5').font={bold:true,size:11,color:{argb:'FF'+RED},name:'新細明體'};
      ws2.getCell('F5').fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF'+YELLOW}};ws2.getCell('F5').alignment={horizontal:'right',vertical:'middle'};ws2.getCell('F5').border=allBorder;
      ws2.getCell('G5').value=st;ws2.getCell('G5').font={bold:true,size:12,color:{argb:'FF'+RED},name:'新細明體'};
      ws2.getCell('G5').fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF'+YELLOW}};ws2.getCell('G5').alignment={horizontal:'right',vertical:'middle'};ws2.getCell('G5').numFmt='#,##0';ws2.getCell('G5').border=allBorder;

      let row=6;
      items.forEach((it,ii)=>{
        ws2.getRow(row).height=22;
        const qty=parseFloat(String(it.qty||1).replace(/[^\d.]/g,''))||1;
        const price=parseFloat(it.price)||0;
        ['A','B','C','D','E','F','G'].forEach(col=>ws2.getCell(col+row).border=allBorder);
        ws2.getCell('A'+row).value=ii+1;ws2.getCell('A'+row).alignment={horizontal:'center',vertical:'middle'};
        ws2.getCell('B'+row).value=it.name||'';ws2.getCell('B'+row).font={size:10,name:'新細明體'};ws2.getCell('B'+row).alignment={horizontal:'left',vertical:'middle',wrapText:true};
        ws2.getCell('C'+row).value=it.unit||'';ws2.getCell('C'+row).alignment={horizontal:'center',vertical:'middle'};
        ws2.getCell('D'+row).value=qty;ws2.getCell('D'+row).alignment={horizontal:'center',vertical:'middle'};
        ws2.getCell('E'+row).value=price||null;ws2.getCell('E'+row).numFmt='#,##0';ws2.getCell('E'+row).alignment={horizontal:'right',vertical:'middle'};
        ws2.getCell('F'+row).value=Math.round(qty*price);ws2.getCell('F'+row).numFmt='#,##0';ws2.getCell('F'+row).alignment={horizontal:'right',vertical:'middle'};
        ws2.getCell('G'+row).value=it.note||'';ws2.getCell('G'+row).font={size:10,name:'新細明體'};ws2.getCell('G'+row).alignment={horizontal:'left',vertical:'middle',wrapText:true};
        row++;
      });
      for(let i=items.length;i<15;i++){
        ws2.getRow(row).height=22;
        ['A','B','C','D','E','F','G'].forEach(col=>ws2.getCell(col+row).border=allBorder);
        row++;
      }
      ws2.pageSetup={orientation:'portrait',paperSize:9,fitToPage:true,fitToWidth:1,fitToHeight:1};
    });

    const buffer = await wb.xlsx.writeBuffer();
    const b64 = Buffer.from(buffer).toString('base64');

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({b64})
    };
  } catch(e) {
    console.error('Error:', e);
    return {
      statusCode: 500,
      headers: {'Access-Control-Allow-Origin': '*'},
      body: JSON.stringify({error: e.message})
    };
  }
};
