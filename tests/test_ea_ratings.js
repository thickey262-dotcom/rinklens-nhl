'use strict';
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const code=fs.readFileSync(path.join(root,'ea-ratings.js'),'utf8');
const source='https://www.ea.com/games/nhl/ratings';
const snapshot={
 game:'NHL 27',sourceUrl:source,updatedAt:'2026-10-12T20:00:00Z',
 players:[
  {name:'Connor McDavid',pos:'C',ovr:99,acl:98,spd:98},
  {name:'Tim Stützle',pos:'C',ovr:91,acl:93,spd:93},
  {name:'Cale Makar',pos:'D',ovr:95},
  {name:'Someone Fake',pos:'C',ovr:100},
  {name:'Sean Smith',pos:'G',ovr:91}
 ]
};
const ctx={fetch:async()=>({ok:true,json:async()=>snapshot}),console};vm.createContext(ctx);
vm.runInContext(code+'\nthis.EA=RinkEA;',ctx);
const a=ctx.EA;
(async()=>{
 assert.equal((await a.load()),true);
 assert.equal(a.score({id:'8478402',name:'Connor McDavid',pos:'C'},'20262027'),99);
 assert.equal(a.score({id:'1234567',name:'Tim Stutzle',pos:'C'},'20262027'),91,'accent folding allowed');
 assert.equal(a.score({id:'1234568',name:'Cale Makar',pos:'D'},'20262027'),95);
 assert.equal(a.score({id:'1234568',name:'Cale Makar',pos:'C'},'20262027'),null,'wrong position rejected');
 assert.equal(a.score({id:'1234567',name:'Connor McDavid',pos:'C'},'20252026'),null,'EA 2027 rating cannot be attributed to older season');
 assert.equal(a.score({id:'demo-1',name:'Connor McDavid',pos:'C'},'20262027'),null,'demo players not rated');
 assert.equal(a.score({id:'1',name:'Absent Player',pos:'C'},'20262027'),null,'missing ratings never fabricated');
 assert.equal(a.score({id:'1',name:'Someone Fake',pos:'C'},'20262027'),null,'invalid OVR rejected');
 assert.equal(a.score({id:'1',name:'Sean Smith',pos:'C'},'20262027'),null,'goalie omitted from skater dataset');
 assert.match(a.panel({id:'8478402',name:'Connor McDavid',pos:'C'},'20262027'),/not an independent film evaluation/);
 assert.match(a.panel({id:'1',name:'Absent Player',pos:'C'},'20262027'),/No verified EA/);
 assert.equal(a.ingest({...snapshot,players:[...snapshot.players,{name:'Connor McDavid',pos:'C',ovr:90}]}),true);
 assert.equal(a.score({id:'8478402',name:'Connor McDavid',pos:'C'},'20262027'),null,'ambiguous duplicate not accepted');
 console.log('EA NHL 27 importer matching, invalid, missing, duplicate, season and proxy tests passed.');
})().catch(e=>{console.error(e);process.exitCode=1});
