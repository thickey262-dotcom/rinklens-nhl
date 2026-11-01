'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const base=path.resolve(__dirname,'..');
const source=fs.readFileSync(path.join(base,'source-average.js'),'utf8');
const RinkSources=vm.runInNewContext(source+'\nRinkSources;');
const mp=[
 {id:'8478402',name:'Mason Example',pos:'D',team:'BUF',xgfPct:40,cfPct:48,ffPct:51,hdCfPct:60,ixG60:.5,fiveToiMinutes:850,gp:50},
 {id:'8478403',name:'René O’Neil',pos:'C',team:'NYR',xgfPct:50,cfPct:42,ffPct:43,hdCfPct:45,ixG60:.8,fiveToiMinutes:920,gp:55},
 {id:'8478404',name:'Alex Dupont',pos:'D',team:'MTL',xgfPct:51,cfPct:52,ffPct:53,hdCfPct:54,ixG60:.6,fiveToiMinutes:810,gp:52}
];
const matching={
 source:'naturalstattrick',season:'20262027',seasonType:'regular',situation:'5v5',adjustment:'raw',players:[
 {id:'8478402',name:'Mason Example',pos:'D',team:'BUF',xgfPct:60,cfPct:50,ffPct:59,hdCfPct:40},
 {name:'Rene O Neil',pos:'C',team:'NYR',xgfPct:70,cfPct:58,ffPct:null,hdCfPct:47},
 {name:'Alex Dupont',pos:'D',team:'MTL',xgfPct:60,cfPct:60,ffPct:60,hdCfPct:60},
 {name:'Alex Dupont',pos:'D',team:'MTL',xgfPct:70,cfPct:70,ffPct:70,hdCfPct:70}
 ]};
let r=RinkSources.blend(mp,matching,'20262027');
assert.equal(r.imported,true);
assert.equal(r.matched,2,'duplicate player names never silently match');
assert.equal(r.averaged,7,'count only real paired metrics');
assert.equal(r.players[0].xgfPct,50);
assert.equal(r.players[0].cfPct,49);
assert.equal(r.players[0].ffPct,55);
assert.equal(r.players[0].hdCfPct,50);
assert.equal(r.players[0].ixG60,.5,'do not average unaligned individual xG rates');
assert.equal(r.players[0].fiveToiMinutes,850,'do not average unlike time-on-ice measurements');
assert.equal(r.players[0].gp,50,'do not modify counting statistics');
assert.equal(r.players[1].xgfPct,60,'unicode and punctuation normalized for unique name matching');
assert.equal(r.players[1].ffPct,43,'missing NST value preserves MoneyPuck');
assert.equal(r.players[2],mp[2],'ambiguous duplicates are skipped completely');
assert.equal(r.players[0].nstComparison.xgfPct.method,'Two-source arithmetic mean');
assert.equal(r.players[1].nstComparison.xgfPct.moneypuck,50);
assert.equal(RinkSources.blend(mp,null,'20262027').players[0],mp[0]);
assert.equal(RinkSources.blend(mp,null,'20262027').matched,0);
for(const diff of [
 {season:'20252026'},
 {seasonType:'playoffs'},
 {situation:'all'},
 {adjustment:'scoreAdjusted'},
 {source:'unverified'},
 {players:{}}
]){
 const mismatch={...matching,...diff};
 const test=RinkSources.blend(mp,mismatch,'20262027');
 assert.equal(test.imported,false,'never use wrong period/situation/adjustment');
 assert.equal(test.players[0],mp[0]);
}
for(const invalid of [-1,200,NaN,Infinity,'60','-',null]){
 const bad={...matching,players:[{...matching.players[0],xgfPct:invalid,cfPct:invalid,ffPct:invalid,hdCfPct:invalid}]};
 const result=RinkSources.blend(mp,bad,'20262027');
 assert.equal(result.matched,0,'invalid numbers must not be combined');
}
const wrongTeam={...matching,players:[{...matching.players[0],team:'TOR'}]};
assert.equal(RinkSources.blend(mp,wrongTeam,'20262027').matched,0);
const wrongId={...matching,players:[{...matching.players[0],id:'1234567'}]};
assert.equal(RinkSources.blend(mp,wrongId,'20262027').matched,0);
const wrongPos={...matching,players:[{...matching.players[0],pos:'C'}]};
assert.equal(RinkSources.blend(mp,wrongPos,'20262027').matched,0);
// Mixed source values are only used after validated import and preserve 5v5 source context.
assert.match(fs.readFileSync(path.join(base,'index.html'),'utf8'),/src="source-average\.js"/);
assert.match(fs.readFileSync(path.join(base,'money.js'),'utf8'),/RinkSources\.blend\(moneypuckPlayers,nst,season\)/);
const manifest=JSON.parse(fs.readFileSync(path.join(base,'data','nst-index.json'),'utf8'));
assert.equal(manifest.source,'naturalstattrick');
assert.deepEqual(manifest.seasons,[]);
console.log('PASS: exact 5v5 matching, percent averaging, unmatched fallback, ambiguity, source provenance and no invented NST data.');
