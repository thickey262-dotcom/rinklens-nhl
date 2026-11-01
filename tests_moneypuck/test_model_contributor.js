'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const source=fs.readFileSync(path.join(root,'eye.js'),'utf8');
const money=fs.readFileSync(path.join(root,'money.js'),'utf8');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const player={id:'8478402',name:'Example Center',team:'BUF',pos:'C',gp:14,toi:20,p:12,fivePlusMinus:3};
const state={season:'20262027',players:[player],page:1,ready:true,selected:[]};
const handlers={},els=new Map();
const getEl=id=>{
 if(!els.has(id))els.set(id,{id,dataset:{},textContent:'',innerHTML:'',outerHTML:'',
   addEventListener(type,callback){handlers[id+':'+type]=callback;},
   classList:{toggle(){}},focus(){},scrollIntoView(){}});
 return els.get(id);
};
const grade=(n)=>({skating:n,puck:n,iq:n,defense:n,compete:n,transition:n,shooting:n,positioning:n});
const ballot={player_id:player.id,...grade(10)};
let communityRows=[],submitted=[],reference={score:65,provisional:false};
const RinkCloud={user:null,initialize:async()=>true,client:{
 from(table){
   if(table==='community_eye_scores')return {select(){return {eq:async()=>({data:communityRows,error:null})}}};
   if(table==='community_eye_votes')return {
     select(){return {eq:async()=>({data:submitted,error:null})}},
     upsert:async()=>{throw Error('Model entry must not create a human ballot');}
   };
   throw Error('Unexpected table '+table);
 }
}};
const ctx={state,get:id=>id===player.id?player:null,
 RinkCloud,RinkBase:{score:()=>75,panel:()=>''},
 RinkStats:{anchor:()=>reference},
 document:{getElementById:getEl,addEventListener(type,callback){handlers[type]=callback;}},
 window:{confirm:()=>true},safe:String,render(){},renderCompare(){},close(){},console};
const eye=vm.runInNewContext(source+'\nRinkEye;',ctx);
(async()=>{
 await eye.reload(state.season);
 let d=eye.display(player.id);
 assert.equal(d.value,70,'model starts at advanced 65 plus 5');
 assert.equal(d.base,70);
 assert.equal(d.modelEntries,1);
 assert.equal(d.publicFanEntries,0);
 assert.equal(d.visibleEntries,1);
 assert.equal(d.ownPrivateEntry,0);
 assert.equal(d.reviewers,0,'RinkLens is never counted as a human reviewer');
 assert.equal(eye.score(player.id),null,'model must not create a community score');
 assert.match(eye.panel(player),/ONE EYE TEST RANKING/);
 assert.equal((eye.panel(player).match(/\/100/g)||[]).length,1,'exactly one displayed Eye Test ranking in profile');
 assert.match(eye.panel(player),/1 RinkLens statistical evaluation/);
 assert.match(eye.panel(player),/public fan average pending/);
 assert.match(getEl('eyeCoverage').textContent,/1 skaters with one Eye Test ranking/);
 const view=new Function('window','safe',money.slice(
  money.indexOf('function eyeDisplay('),money.indexOf('function status('))+
 '\nreturn {eyeCell,eyeDisplay};')(ctx.window,String);
 assert.match(view.eyeCell(player.id),/RinkLens model/);
 assert.match(view.eyeCell(player.id),/awaiting public fan reviews/);
 assert.match(html,/does not count toward the three real reviewers/);
 RinkCloud.user={id:'fan-1',email:'fan@example.com'};
 submitted=[ballot];
 await eye.reload(state.season);
 d=eye.display(player.id);
 assert.equal(d.personal,100,'actual private grade remains untouched');
 assert.equal(d.value,70,'combined private preview stays within five of advanced 65');
 assert.equal(d.unboundedValue,79,'private preview still uses 70/30 weights before bound');
 assert.equal(d.ownPrivateEntry,1);
 assert.equal(d.publicFanEntries,0);
 assert.equal(d.visibleEntries,1,'private fan grade must not appear in public count');
 assert.match(eye.panel(player),/Your fan grade is saved/);
 assert.equal((eye.panel(player).match(/\/100/g)||[]).length,1,'private human score is not a second ranking');
 assert.match(eye.panel(player),/visible only to you/);
 RinkCloud.user=null;
 await eye.reload(state.season);
 assert.equal(eye.display(player.id).personal,null);
 assert.equal(eye.display(player.id).visibleEntries,1);
 assert.doesNotMatch(eye.panel(player),/Your fan grade is saved/);
 const pub=n=>({season_id:state.season,player_id:player.id,reviewer_count:n,score:90,...grade(9)});
 for(const n of [3,4,5]){
   communityRows=[pub(n)];
   await eye.reload(state.season);
   d=eye.display(player.id);
   assert.equal(d.modelEntries,1);
   assert.equal(d.publicFanEntries,n);
   assert.equal(d.visibleEntries,n+1,'one RinkLens model plus the real human count');
   assert.equal(d.community,90,'public human score remains full and unchanged');
   assert.ok(Math.abs(d.value-65)<=5,'combined score remains within +/-5 of reference');
   assert.match(eye.panel(player),new RegExp(n+' published fan reviews'));
   assert.equal((eye.panel(player).match(/\/100/g)||[]).length,1,'public profile must have only one numeric Eye Test ranking');
   assert.match(view.eyeCell(player.id),new RegExp('RinkLens model evaluation \\+ '+n+' fans'));
 }
 communityRows=[];
 reference={score:48,provisional:true};
 await eye.reload(state.season);
 d=eye.display(player.id);
 assert.equal(d.base,53);
 assert.equal(d.value,53);
 assert.equal(d.modelEntries,1,'provisional small-sample rating counts as one labeled model contribution');
 assert.match(d.label,/Provisional/);
 assert.equal(d.visibleEntries,1);
 console.log('PASS: 1 model contribution per player, independent real fan counts, protected private votes, and +/-5 model-linked bounds.');
})().catch(error=>{console.error(error);process.exitCode=1;});
