'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const money=fs.readFileSync(path.join(root,'money.js'),'utf8');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const scores={
 '8000001':85,'8000002':74,'8000003':50,'8000004':47,
 '8000005':22,'8000006':63,'8000007':null,'8000008':45
};
const players=[
 {id:'8000001',name:'Alpha',team:'BUF',pos:'C',advanced:80},
 {id:'8000002',name:'Bravo',team:'NYR',pos:'D',advanced:77},
 {id:'8000003',name:'Charlie',team:'BUF',pos:'C',advanced:50},
 {id:'8000004',name:'Delta',team:'NYR',pos:'D',advanced:50},
 {id:'8000005',name:'Echo',team:'BUF',pos:'C',advanced:20,provisional:true},
 {id:'8000006',name:'Foxtrot',team:'BUF',pos:'C',advanced:60},
 {id:'8000007',name:'Golf',team:'BUF',pos:'D',advanced:66},
 {id:'8000008',name:'Hotel',team:'NYR',pos:'D',advanced:null}
].map(p=>({...p,gp:10,p:5,g:1,a:4,p60:2,xgfPct:48,cfPct:49,ixG60:.2}));
const elements=new Map(),handlers={};
function el(id){
 if(!elements.has(id))elements.set(id,{
  value:id==='season'?'20262027':id==='sort'?'eye':'',
  textContent:'',innerHTML:'',hidden:false,disabled:false,
  selectedOptions:[{text:'2026–27'}],dataset:{},
  classList:{toggle(){}},
  addEventListener(type,fn){handlers[id+':'+type]=fn;},
  focus(){}
 });
 return elements.get(id);
}
const community={
 display(id){
  const score=scores[id];
  return score===null?null:{value:score,community:null,isPrivate:false,provisional:false,reviewers:0};
 },
 hasOwn(){return false},
 panel(){return ''}
};
const ctx={
 document:{getElementById:el,addEventListener(){},
  querySelector(){return {scrollIntoView(){}}}},
 window:{RinkEye:community},RinkEye:{...community,reload:async()=>{}},
 RinkStats:{
  anchor:p=>Number.isFinite(p?.advanced)?{score:p.advanced,provisional:!!p.provisional}:null,
  score:p=>p?.provisional?null:(p?.advanced??null),
  calculate(){},label(){return null},reason(){return null},panel(){return ''}
 },
 RinkSources:{COMPARABLE:[],blend:p=>({players:p,imported:false,reason:'No NST import'})},
 RinkBase:{calculate(){}},
 RinkLenses:{calculate(){},total(){return 0}},
 fetch:async url=>url==='data/nst-index.json'
  ? {ok:true,json:async()=>({source:'naturalstattrick',seasons:[]})}
  :{ok:true,json:async()=>({source:'moneypuck',season:'20262027',updatedAt:'2026-11-01T12:00:00Z',players})},
 console
};
const ui=vm.runInNewContext(money+'\n({state,load,filtered,render,renderCompare,scoreDifference,differenceCell})',ctx);
const ids=()=>Array.from(ui.filtered(),p=>p.id).join(',');
(async()=>{
 await ui.load();
 const byId=Object.fromEntries(players.map(p=>[p.id,p]));
 assert.equal(ui.scoreDifference(byId['8000001']),5);
 assert.equal(ui.scoreDifference(byId['8000002']),-3);
 assert.equal(ui.scoreDifference(byId['8000003']),0);
 assert.equal(ui.scoreDifference(byId['8000005']),2,'provisional uses displayed advanced reference');
 assert.equal(ui.scoreDifference(byId['8000007']),null,'missing Eye Test is not zero');
 assert.equal(ui.scoreDifference(byId['8000008']),null,'missing advanced reference is not zero');
 assert.match(ui.differenceCell(byId['8000001']),/is-higher[^>]*>\+5/);
 assert.match(ui.differenceCell(byId['8000002']),/is-lower[^>]*>-3/);
 assert.match(ui.differenceCell(byId['8000003']),/is-equal[^>]*>0/);
 assert.match(ui.differenceCell(byId['8000005']),/Provisional reference/);
 assert.match(ui.differenceCell(byId['8000007']),/is-unavailable[^>]*>—/);
 assert.match(html,/value="diffPositive"/);
 assert.match(html,/value="diffNegative"/);
 assert.match(html,/value="diffClosest"/);
 assert.match(html,/Difference \(\+\/−\)/);
 assert.match(html,/Eye Test − Advanced Stats/);
 assert.match(el('rows').innerHTML,/score-difference-cell/);
 assert.match(el('rows').innerHTML,/\+5/);
 assert.match(el('rows').innerHTML,/>-3</);
 assert.match(el('rows').innerHTML,/Provisional reference/);
 assert.equal((el('rows').innerHTML.match(/<tr>/g)||[]).length,8);
 el('sort').value='diffPositive'; handlers['sort:change']();
 assert.equal(ui.state.page,1);
 assert.equal(ids(),'8000001,8000006,8000005,8000003,8000002,8000004,8000007,8000008',
  'positive difference sorts largest to smallest; unavailable last');
 el('sort').value='diffNegative'; handlers['sort:change']();
 assert.equal(ids(),'8000002,8000004,8000003,8000005,8000006,8000001,8000007,8000008',
  'negative difference sorts lowest to highest; unavailable last');
 el('sort').value='diffClosest'; handlers['sort:change']();
 assert.equal(ids(),'8000003,8000005,8000002,8000004,8000006,8000001,8000007,8000008',
  'smallest absolute gap first; ties deterministic; unavailable last');
 el('team').value='BUF';handlers['team:change']();
 assert.equal(ids(),'8000003,8000005,8000006,8000001,8000007',
  'sorting coexists with team filter');
 el('team').value='';handlers['team:change']();
 ui.state.selected=['8000001','8000005'];ui.renderCompare();
 assert.match(el('comparison').innerHTML,/Score difference \(Eye Test − Advanced\)/);
 assert.match(el('comparison').innerHTML,/\+5/);
 assert.match(el('comparison').innerHTML,/Provisional reference/);
 scores['8000001']=80;
 assert.equal(ui.scoreDifference(byId['8000001']),0,'difference responds to a changed Eye Test score');
 el('sort').value='diffClosest';handlers['sort:change']();
 assert.equal(ids().split(',')[0],'8000001','sort recalculates from current Eye Test score');
 delete scores['8000001'];
 assert.equal(ui.scoreDifference(byId['8000001']),null);
 console.log('PASS: signed Eye Test − Advanced difference, all three sort modes, provisional labels, missing values, team filtering, comparisons, and dynamic score updates.');
})().catch(e=>{console.error(e);process.exitCode=1;});
