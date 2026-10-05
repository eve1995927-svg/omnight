const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

function reportContext(employees,punches){
  const data={employees,punch_recs:punches};
  const context=vm.createContext({
    setTimeout:()=>0,
    document:{getElementById:()=>null,querySelectorAll:()=>[]},
    DB:{getAll:key=>data[key]||[],get:key=>(data[key]||[]).filter(r=>!r.deleted)},
    sameRecId:(a,b)=>a!=null&&b!=null&&String(a)===String(b),
    recId:value=>value==null||value===''?null:value,
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../js/hr-marketing.js'),'utf8'),context);
  return context;
}

const punch=(user,date,type,time,projectId=null,extra={})=>({user,date,type,time,projectId,...extra});

test('不同日期格式與同日多案場只算一天，跨月記錄不混入',()=>{
  const context=reportContext([{_id:12,name:'小林'}],[
    punch('emp_12','2026/9/4','in','9:00:00',7),
    punch('emp_12','2026-09-04','out','12:00:00','7'),
    punch('emp_12','2026/09/04','in','13:00:00','__office__'),
    punch('emp_12','2026-09-04','out','18:00:00','__office__'),
    punch('emp_12','2026-10-01','in','09:00:00'),
  ]);
  const result=context.buildMonthlyPunchReport('2026-09');
  assert.equal(result.people,1);assert.equal(result.days,1);assert.equal(result.records,4);
  assert.equal(result.rows[0].complete,2);assert.equal(result.review,0);
});

test('缺上班與缺下班不會跨日期或案場抵銷，異常時間需要確認',()=>{
  const context=reportContext([{_id:1,name:'測試員工'}],[
    punch('emp_1','2026-09-01','in','09:00:00',10),
    punch('emp_1','2026-09-01','out','18:00:00',11),
    punch('emp_1','2026-09-02','out','18:00:00',10),
    punch('emp_1','2026-09-03','in','09:00:00',10),
    punch('emp_1','2026-09-03','out','08:00:00',10),
    punch('emp_1','2026-09-04','in','時間錯誤',10),
  ]);
  const result=context.buildMonthlyPunchReport('2026-09');
  assert.equal(result.review,5);assert.equal(result.rows[0].complete,0);
});

test('同名員工依 ID 區分，舊共用帳號只在姓名唯一時合併',()=>{
  const employees=[{_id:1,name:'同名'},{_id:'2',name:'同名'},{_id:3,name:'小王'}];
  const context=reportContext(employees,[
    punch('emp_1','2026-09-01','in','09:00:00',null,{userName:'同名'}),
    punch('emp_2','2026-09-02','in','09:00:00',null,{userName:'同名'}),
    punch('staff','2026-09-03','in','09:00:00',null,{userName:'同名'}),
    punch('staff','2026-09-04','in','09:00:00',null,{userName:'小王'}),
    punch('emp_999','2026-09-05','in','09:00:00',null,{userName:'小王'}),
  ]);
  const rows=context.buildMonthlyPunchReport('2026-09').rows;
  assert.equal(rows.length,5);
  assert.equal(rows.find(r=>r.key==='emp_1').records.length,1);
  assert.equal(rows.find(r=>r.key==='emp_2').records.length,1);
  assert.equal(rows.find(r=>r.key==='emp_3').records.length,1);
  assert.equal(rows.find(r=>r.key==='emp_999').records.length,1);
});

test('保留離職及歷史帳號打卡，在職未打卡員工仍列零筆',()=>{
  const context=reportContext([{_id:1,name:'在職'},{_id:2,name:'歷史員工',deleted:true}],[
    punch('emp_2','2026-09-01','in','09:00:00'),
    punch('owner','2026-09-01','in','09:00:00',null,{userName:'老闆'}),
  ]);
  const result=context.buildMonthlyPunchReport('2026-09');
  assert.equal(result.rows.length,3);assert.equal(result.people,2);
  assert.equal(result.rows.find(r=>r.key==='emp_1').records.length,0);
  assert.equal(result.rows.find(r=>r.key==='emp_2').title,'已移除員工');
  assert.equal(context.buildMonthlyPunchReport('2026-08').records,0);
});

test('統計所有已保存記錄，不受打卡記錄頁的前100筆限制，且保持只讀',()=>{
  const records=Array.from({length:120},(_,i)=>punch('emp_1','2026-09-01',i%2?'out':'in',i%2?'18:00:00':'09:00:00',i>>1));
  const before=JSON.stringify(records);
  const result=reportContext([{_id:1,name:'員工'}],records).buildMonthlyPunchReport('2026-09');
  assert.equal(result.records,120);assert.equal(result.rows[0].complete,60);
  assert.equal(JSON.stringify(records),before);
});

test('拒絕不存在的日期與不合法時間',()=>{
  const context=reportContext([],[]);
  assert.equal(context.punchReportDate('2026/2/30'),null);
  assert.equal(context.punchReportDate('2026/9/4'),'2026-09-04');
  assert.equal(context.punchReportTime('25:00:00'),null);
  assert.equal(context.punchReportTime('09:60:00'),null);
});
