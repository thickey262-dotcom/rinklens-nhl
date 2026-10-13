'use strict';
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const ROOT=path.resolve(__dirname,'..');
const players=[];
for(let i=0;i<21;i++)players.push({id:'C'+i,name:'Center '+i,pos:'C',gp:5,p:5+i,toi:12,advanced:{gp:5,xgfPct:40+i,cfPct:40+i,ffPct:40+i,ixG60:i/10,hdCfPct:40+i}});
for(let i=0;i<20;i++)players.push({id:'D'+i,name:'D '+i,pos:'D',gp:5,p:i+2,toi:22,advanced:{gp:5,xgfPct:20+i,cfPct:20+i,ffPct:20+i,ixG60:i/12,hdCfPct:20+i}});
const ctx={S:{players,source:'nhl',season:'20262027'},RinkAdvanced:{read:(p,key)=>p.advanced?.[key]??null},
 RinkAuto:{panel:()=>'<div class="auto-scout-panel">Auto Scout Estimate</div>'},
 RinkConsensus:{panel:()=>'<div class="consensus-panel">No verified report</div>'},
 RinkModel:{panel:()=>'<div class="model-panel">Stats only</div>'},
 RinkCommunity:{eyeTest:()=>null,panel:()=>'<div class="community-panel">Community votes</div>'}, reportFor:()=>null,eye:()=>null,n:Number,traits:[],seasonLabel:()=> '2026–27',esc: x=>String(x).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;')};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(ROOT,'reportcards.js'),'utf8')+'\nthis.R = RinkReports;',ctx);
const R=ctx.R;
assert.equal(R.group({pos:'C'}),'C');assert.equal(R.group({pos:'D'}),'D');assert.equal(R.group({pos:'LW'}),'L');
assert.equal(R.peerThreshold(),3,'early season minimum is 3 GP');
let high=R.rank(players[20],'xgfPct'),low=R.rank(players[0],'xgfPct');
assert(high.pct>low.pct,'higher rate has higher percentile');
assert.equal(high.count,21,'centers compared only with centers');
assert.equal(R.rank(players[20],'p60').count,21,'all-situations rate uses position peer set');
assert.equal(R.rank({...players[20],gp:1,advanced:{...players[20].advanced,gp:1}},'xgfPct'),null,'small sample withheld');
assert.equal(R.rank({...players[20],advanced:{...players[20].advanced,xgfPct:null}},'xgfPct'),null,'missing stat withheld');
ctx.S.source='demo';assert.equal(R.rank(players[20],'xgfPct'),null,'no fictional percentiles');ctx.S.source='nhl';
const malicious={...players[20],name:'<script>alert(1)</script>'};
const html=R.profile(malicious);
assert(html.includes('&lt;script&gt;')&&!html.includes('<script>'),'HTML escapes player names');
assert(html.includes('What your eyes say')&&html.includes('position percentile')&&html.includes('MoneyPuck'),'card includes grade and attribution');
ctx.S.players=players.map(p=>({...p,gp:72,advanced:{...p.advanced,gp:72}}));
assert.equal(R.peerThreshold(),10,'full-season min GP 10');
console.log('Report-card percentile, sample-size, position, escape and display tests passed.');
