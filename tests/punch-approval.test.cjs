const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const read=name=>fs.readFileSync(path.join(__dirname,'../js',name),'utf8');

function contextFor(requests=[],punches=[]){
  const cache={punch_requests:Object.fromEntries(requests.map(r=>[r._id,r])),punch_recs:Object.fromEntries(punches.map(r=>[r._id,r])),employees:{1:{_id:1,name:'員工甲'}},projects:{7:{_id:7,name:'測試案場'}}};
  const writes=[],removed=[];
  const context=vm.createContext({
    _cache:cache,curRole:'owner',setTimeout:()=>0,
    _cloudSetRecord:(key,id,record)=>writes.push({key,id,record}),_cloudRemoveRecord:(key,id)=>removed.push({key,id}),
    document:{getElementById:id=>id==='uName'?{textContent:'核准老闆'}:null,querySelectorAll:()=>[]},
    sameRecId:(a,b)=>a!=null&&b!=null&&String(a)===String(b),recId:value=>value==null||value===''?null:value,
    getPunchUser:()=>context.curRole,getPunchLocationLabel:()=> '測試案場',
  });
  const core=read('core.js'),a=core.indexOf('const DB={'),b=core.indexOf('// ══ AI 點數',a);
  vm.runInContext(core.slice(a,b)+'\nthis.DB=DB;',context);
  context.findRec=(key,id)=>context.DB.get(key).find(r=>String(r._id)===String(id));
  vm.runInContext(read('hr-marketing.js'),context);
  const vendor=read('vendor-punch.js'),start=vendor.indexOf('function punchRequestUser('),end=vendor.indexOf('// ══ 廠商報價搜尋',start);
  vm.runInContext(vendor.slice(start,end),context);
  context.refreshPunchApprovalViews=()=>{};
  return {context,cache,writes,removed};
}
const request=extra=>({_id:11,user:'emp_1',userName:'員工甲',date:'2026-09-01',type:'in',time:'09:00',projectId:7,reason:'忘記打卡',status:'pending',...extra});
const decision={user:'emp_1',projectId:'7',time:'09:00'};

test('超過500筆保留全部歷史，各集合都不自動刪除',()=>{
  const {context,cache,removed}=contextFor();
  for(let i=0;i<505;i++)context.DB.push('punch_recs',{user:'emp_1',time:'09:00:00'});
  assert.equal(Object.keys(cache.punch_recs).length,505);assert.equal(removed.length,0);
  for(let i=0;i<502;i++)context.DB.push('ledger',{amount:1});
  assert.equal(Object.keys(cache.ledger).length,502);assert.equal(removed.length,0);
});
test('補卡核准新增記錄與稽核，重送同一申請保持一筆',()=>{
  const {context,cache}=contextFor([request()]);
  context.applyPunchApproval('11',decision);context.applyPunchApproval(11,decision);
  const records=context.DB.get('punch_recs');assert.equal(records.length,1);
  assert.equal(records[0]._id,'punch_req_11');assert.equal(records[0].time,'09:00:00');assert.equal(records[0].lat,null);
  assert.equal(cache.punch_requests[11].approvedName,'核准老闆');assert.equal(cache.punch_requests[11].after.time,'09:00:00');
});
test('補卡寫入後中斷，再核准不會重複新增',()=>{
  const {context,cache}=contextFor([request()]);
  context.applyPunchApproval(11,decision);cache.punch_requests[11].status='pending';
  context.applyPunchApproval(11,decision);assert.equal(context.DB.get('punch_recs').length,1);
});
test('另一個申請不得新增同日同案場同類打卡',()=>{
  const {context}=contextFor([request(),request({_id:12})]);
  context.applyPunchApproval(11,decision);
  assert.throws(()=>context.applyPunchApproval(12,decision),/已有這類打卡/);
  assert.equal(context.DB.get('punch_recs').length,1);
});
test('修改時間保留原值、原因與核准人，重送不重複歷史',()=>{
  const {context,cache}=contextFor([request({type:'fix'})],[{_id:77,user:'emp_1',date:'2026-09-01',type:'in',time:'08:00:00',projectId:'7'}]);
  context.applyPunchApproval(11,{...decision,targetId:'77'});cache.punch_requests[11].status='pending';context.applyPunchApproval(11,{...decision,targetId:77});
  assert.equal(cache.punch_recs[77].time,'09:00:00');assert.equal(cache.punch_recs[77].correctionHistory.length,1);
  assert.equal(cache.punch_requests[11].before.time,'08:00:00');assert.equal(cache.punch_requests[11].after.time,'09:00:00');
});
test('不可修改別人、別案場、別日期或未選定的記錄',()=>{
  for(const target of [{user:'emp_2'},{projectId:8},{date:'2026-09-02'}]){
    const {context}=contextFor([request({type:'fix'})],[{_id:77,user:'emp_1',projectId:7,date:'2026-09-01',time:'08:00:00',type:'in',...target}]);
    assert.throws(()=>context.applyPunchApproval(11,{...decision,targetId:77}),/原始打卡/);
  }
});
test('員工無法核准，拒絕非法時間、未來日期及不一致員工案場',()=>{
  const {context}=contextFor([request()]);context.curRole='staff';assert.throws(()=>context.applyPunchApproval(11,decision),/只有老闆/);context.curRole='owner';
  assert.throws(()=>context.applyPunchApproval(11,{...decision,time:''}),/正確時間/);
  assert.throws(()=>context.applyPunchApproval(11,{...decision,user:'emp_2'}),/申請人不一致/);
  assert.throws(()=>context.applyPunchApproval(11,{...decision,projectId:8}),/案場不一致/);
  const future=contextFor([request({date:'2099-01-01'})]).context;assert.throws(()=>future.applyPunchApproval(11,decision),/尚未到來/);
});
test('舊申請姓名唯一才辨識，其他備註核准不偽造打卡',()=>{
  const {context,cache}=contextFor([request({user:'staff',type:'other'})]);
  assert.equal(context.punchRequestUser(cache.punch_requests[11]),'emp_1');
  context.applyPunchApproval(11,{user:'emp_1'});assert.equal(context.DB.get('punch_recs').length,0);assert.equal(cache.punch_requests[11].status,'approved');
  cache.employees[2]={_id:2,name:'員工甲'};assert.equal(context.punchRequestUser(request({user:'staff'})),'');
});

test('舊版已核准申請需明確補處理，補處理後仍維持冪等',()=>{
  const {context,cache}=contextFor([request({status:'approved'})]);
  context.applyPunchApproval(11,decision);assert.equal(context.DB.get('punch_recs').length,0);
  context.applyPunchApproval(11,{...decision,legacyReview:true});context.applyPunchApproval(11,{...decision,legacyReview:true});
  assert.equal(context.DB.get('punch_recs').length,1);assert.equal(cache.punch_requests[11].approvalAction,'新增補卡');
});

test('已移除的補卡不會被重送申請默默重新核准',()=>{
  const {context,cache}=contextFor([request()],[{_id:'punch_req_11',requestId:11,user:'emp_1',date:'2026-09-01',type:'in',time:'09:00:00',projectId:7,deleted:true}]);
  assert.throws(()=>context.applyPunchApproval(11,decision),/已移除/);assert.equal(cache.punch_requests[11].status,'pending');
});

test('修改申請指定的原始記錄不可換成同日的另一筆',()=>{
  const {context}=contextFor([request({type:'fix',targetRecordId:77})],[{_id:77,user:'emp_1',date:'2026-09-01',type:'in',time:'08:00:00',projectId:7},{_id:78,user:'emp_1',date:'2026-09-01',type:'out',time:'18:00:00',projectId:7}]);
  assert.throws(()=>context.applyPunchApproval(11,{...decision,targetId:78}),/指定的記錄不一致/);
});
