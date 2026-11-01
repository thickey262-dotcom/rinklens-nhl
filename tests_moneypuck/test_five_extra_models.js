'use strict';
/* Verify five real deterministic statistical models, not fictional fan reviews. */
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const stats=fs.readFileSync(path.join(root,'stats-score.js'),'utf8');
const baseline=fs.readFileSync(path.join(root,'eye-base.js'),'utf8');
const lenses=fs.readFileSync(path.join(root,'eye-models.js'),'utf8');
const eyes=fs.readFileSync(path.join(root,'eye.js'),'utf8');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const money=fs.readFileSync(path.join(root,'money.js'),'utf8');
const wf=fs.readFileSync(path.join(root,'.github/workflows/rinklens.yml'),'utf8');
const beforeInit=eyes.slice(0,eyes.indexOf('// The player table uses window.RinkEye'));
const state={season:'20262027',players:[],ready:true};
const cloud={user:null,client:null,initialize:async()=>true};
const doc={getElementById(){return {addEventListener(){},dataset:{},textContent:'',hidden:false}},addEventListener(){}};
const build=new Function('state','get','RinkCloud','safe','render','renderCompare','document','window','console',
 stats+'\n'+baseline+'\n'+lenses+'\n'+beforeInit+'\nreturn {stats:RinkStats,base:RinkBase,lenses:RinkLenses,eye:RinkEye};');
const system=build(state,id=>state.players.find(p=>String(p.id)===String(id)),cloud,String,()=>{},()=>{},doc,{},console);
const {stats:rinkStats,base,eye,lenses:rinkLenses}=system;
assert.equal(rinkLenses.CONFIG.length,5);
for(const m of rinkLenses.CONFIG){
 assert.equal(Object.values(m.weights).reduce((a,b)=>a+b,0),100,'each variant sums to 100');
}
assert.match(html,/src="eye-models\.js"/);
assert.match(wf,/cp index\.html[^\n]*eye-models\.js/);
assert.match(money,/RinkLenses\.calculate\(state\.players\)/);
assert.match(money,/RinkLenses\.calculate\(\[\]\)/);
let covered=0,shifted=0;
(async()=>{
 for(const season of ['20242025','20252026','20262027']){
   const snapshot=JSON.parse(fs.readFileSync(path.join(root,'data','moneypuck-'+season+'.json'),'utf8'));
   state.season=season;state.players=snapshot.players;
   rinkStats.calculate(state.players);
   base.calculate(state.players);
   rinkLenses.calculate(state.players);
   await eye.reload(season);
   const sorted=state.players.filter(p=>rinkStats.score(p)!==null)
     .sort((a,b)=>rinkStats.score(b)-rinkStats.score(a)||String(a.id).localeCompare(String(b.id)));
   assert.ok(sorted.length>=100);
   assert.equal(rinkLenses.total(),100,'exactly 100 top qualified players per season');
   const chosen=new Set(sorted.slice(0,100).map(p=>p.id));
   for(const player of state.players){
     const extra=rinkLenses.forPlayer(player);
     const combined=eye.display(player.id);
     const reference=rinkStats.anchor(player);
     assert.ok(reference);
     assert.ok(Math.abs(combined.value-reference.score)<=5,'single Eye Test must stay within five');
     assert.equal(combined.community,null,'automated variant never creates a fan review');
     assert.equal(combined.publicFanEntries,0);
     assert.equal(combined.reviewers,0);
     if(chosen.has(player.id)){
       assert.ok(extra,'top 100 should receive five more model variants');
       assert.equal(extra.components.length,5);
       assert.equal(extra.reference,rinkStats.score(player));
       assert.equal(combined.modelEntries,6);
       assert.equal(combined.modelExtra.length,5);
       assert.equal(combined.visibleEntries,6);
       assert.equal(extra.rank,sorted.findIndex(p=>p.id===player.id)+1);
       const original=Math.max(0,Math.min(100,Math.max(reference.score-5,Math.min(reference.score+5,base.score(player)??reference.score))));
       const values=[original,...extra.components.map(x=>x.score)];
       const expected=Math.round(values.reduce((a,b)=>a+b,0)/6);
       assert.equal(combined.base,expected,'equal mean of original + five new model evaluations');
       assert.equal(combined.value,expected,'with no fan vote, model average is the single displayed ranking');
       for(const m of extra.components)assert.ok(Math.abs(m.score-reference.score)<=5,'variant stays within five');
       if(combined.base!==original)shifted++;
       covered++;
     }else{
       assert.equal(extra,null,'no extra model variants outside top 100');
       assert.equal(combined.modelEntries,1,'all other players keep one model estimate');
       assert.equal(combined.modelExtra.length,0);
       assert.equal(combined.visibleEntries,1);
     }
   }
   const profile=eye.panel(sorted[0]);
   assert.equal((profile.match(/\/100/g)||[]).length,1,'one visible numeric ranking');
   assert.match(profile,/6 RinkLens statistical evaluations/);
   assert.match(profile,/Five extra statistical perspectives for top-100 players/);
   assert.doesNotMatch(eye.panel(sorted[100]),/Five extra statistical perspectives for top-100 players/);
   console.log('PASS '+season+': 100 top players have 5 extra models; '+state.players.length+' have one displayed Eye Test ranking');
 }
 assert.equal(covered,300);
 assert.ok(shifted>0,'some starting ratings should differ from the old single-model starting score');
 const previous=state.players[0],present=rinkLenses.forPlayer(previous);
 rinkLenses.calculate([]);
 assert.equal(rinkLenses.total(),0,'no previous-season model scores persist after reset');
 assert.equal(rinkLenses.forPlayer(previous),null);
 console.log('PASS: 300 top-player model ensembles, five extra evaluations each, score limits, source labels and zero synthetic human votes.');
})().catch(e=>{console.error(e);process.exitCode=1;});
