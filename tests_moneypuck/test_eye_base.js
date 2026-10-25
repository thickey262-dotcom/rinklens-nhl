'use strict';
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const baseCode=fs.readFileSync(path.join(root,'eye-base.js'),'utf8');
const eyeCode=fs.readFileSync(path.join(root,'eye.js'),'utf8');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const workflow=fs.readFileSync(path.join(root,'.github/workflows/rinklens.yml'),'utf8');
assert.match(html,/<script src="eye-base\.js"><\/script>[\s\S]*<script src="money\.js"><\/script>/);
assert.match(workflow,/cp index\.html[^\n]*eye-base\.js/);
assert.ok(!baseCode.includes('community_eye_votes'),'baseline must never read votes');
assert.ok(!baseCode.includes('RinkStats'),'baseline must not reuse Advanced Stats Score');
const base=vm.runInNewContext(baseCode+'\nRinkBase;');
assert.equal(Object.values(base.WEIGHTS.F).reduce((a,b)=>a+b,0),100);
assert.equal(Object.values(base.WEIGHTS.D).reduce((a,b)=>a+b,0),100);
assert.deepEqual(JSON.stringify(base.WEIGHTS.F),JSON.stringify({gp:35,toi:20,ppg:45}));
assert.deepEqual(JSON.stringify(base.WEIGHTS.D),JSON.stringify({gp:35,toi:25,ppg:40}));
const make=(count,pos)=>Array.from({length:count},(_,i)=>({
  id:String(8000000+(pos==='D'?2000:1000)+i),name:'Skater '+i,
  pos,team:'BUF',gp:12+(i%35),toi:12+i*.26,p:2+i
}));
const forwards=make(50,'C'),defense=make(40,'D');
const skaters=[...forwards,...defense];
base.calculate(skaters);
assert.equal(typeof base.score(forwards[0]),'number');
assert.ok(base.score(forwards[49])>base.score(forwards[0]));
assert.ok(base.score(defense[39])>base.score(defense[0]));
assert.equal(base.forPlayer(forwards[2]).breakdown.find(x=>x.key==='ppg').weight,45);
assert.equal(base.forPlayer(defense[2]).breakdown.find(x=>x.key==='ppg').weight,40);
const dScore=base.score(defense[8]);
base.calculate([...forwards.map(p=>({...p,gp:90,toi:35,p:170})),...defense]);
assert.equal(base.score(defense[8]),dScore,'forward-only changes must not affect D scores');
base.calculate(skaters);
const player=forwards[20];
const baseline=base.score(player);
assert.ok(baseline>=0&&baseline<=100);
assert.equal(base.score({...player,id:'9999999',toi:null}),null,'unknown player is not invented');
const tooLittle=[...make(8,'C'),...make(8,'D')];
base.calculate(tooLittle);
assert.equal(base.score(tooLittle[0]),null,'need sufficient same-position peers');
base.calculate(skaters);
const callbacks={},elements=new Map();
function element(id){
 if(!elements.has(id))elements.set(id,{id,dataset:{},textContent:'',innerHTML:'',hidden:false,
  addEventListener(type,fn){callbacks[id+':'+type]=fn;},focus(){},scrollIntoView(){},
  classList:{toggle(){}}
 });
 return elements.get(id);
}
let vote=null, publicRows=[];
const cloud={user:{id:'user-1',email:'fan@example.com'},
  initialize:async()=>true,
  client:{from(table){
    if(table==='community_eye_votes')return {
      select(){return {eq:async()=>({data:cloud.user&&vote?[vote]:[],error:null})};},
      upsert:async row=>{vote=row;return {error:null};}
    };
    if(table==='community_eye_scores')return {
      select(){return {eq:async()=>({data:publicRows,error:null})};}
    };
    throw Error('unexpected table');
  }}
};
const state={season:'20262027',players:skaters,page:1,selected:[],ready:true};
const ctx={state,RinkCloud:cloud,get:id=>skaters.find(p=>p.id===id),
  safe:String,render(){},renderCompare(){},close(){},document:{
    getElementById:element,addEventListener(type,fn){callbacks[type]=fn;}
  },window:{confirm:()=>true},console};
const instance=vm.runInNewContext(baseCode+'\n'+eyeCode+'\nRinkEye;',ctx);
(async()=>{
 await instance.reload(state.season);
 let d=instance.display(player.id);
 assert.equal(d.base,baseline);
 assert.equal(d.value,baseline,'an unreviewed skater starts at the statistical baseline');
 assert.match(d.label,/Formula Baseline/);
 assert.equal(d.humanWeight,0);
 assert.match(instance.panel(player),/Formula Baseline:/);
 const form={id:'eyeVoteForm',dataset:{eyePlayer:player.id},
  querySelector(){return {disabled:false};},
  elements:{namedItem(k){return k==='watched'?{checked:true}:{value:'9'};}}
 };
 await callbacks.submit({target:form,preventDefault(){}});
 d=instance.display(player.id);
 assert.equal(d.personal,90);
 assert.equal(d.community,null);
 assert.equal(d.isPrivate,true);
 assert.equal(d.humanWeight,0.3);
 assert.equal(d.value,Math.round(baseline*.7+90*.3));
 assert.match(instance.panel(player),/Your Combined Preview \(Private\)/);
 assert.equal(base.score(player),baseline,'human votes cannot mutate MoneyPuck-only baseline');
 const aggregate=(n,score)=>({season_id:state.season,player_id:player.id,reviewer_count:n,
  score,skating:8,puck:8,iq:8,defense:8,compete:8,transition:8,shooting:8,positioning:8});
 for(const [reviewers,weight] of [[3,.5],[4,.6],[5,.7],[9,.7]]){
   publicRows=[aggregate(reviewers,80)];
   await instance.reload(state.season);
   d=instance.display(player.id);
   assert.equal(d.community,80);
   assert.equal(d.personal,90);
   assert.equal(d.isPrivate,false);
   assert.equal(d.reviewers,reviewers);
   assert.equal(d.humanWeight,weight);
   assert.equal(d.value,Math.round(baseline*(1-weight)+80*weight));
   assert.match(instance.panel(player),/Community human-rating average/);
 }
 cloud.user=null;
 await instance.reload(state.season);
 d=instance.display(player.id);
 assert.equal(d.personal,null);
 assert.equal(d.value,Math.round(baseline*.3+80*.7));
 publicRows=[];
 await instance.reload(state.season);
 assert.equal(instance.display(player.id).value,baseline,'public sees only baseline below publication threshold');
 // The deployed MoneyPuck snapshots have the inputs needed for a useful starting score.
 for(const season of ['20242025','20252026','20262027']){
   const snap=JSON.parse(fs.readFileSync(path.join(root,'data','moneypuck-'+season+'.json'),'utf8'));
   base.calculate(snap.players);
   const scored=snap.players.filter(p=>base.score(p)!==null);
   assert.ok(scored.length>100,season+' should have widespread baseline coverage');
   assert.ok(scored.some(p=>p.pos==='D')&&scored.some(p=>p.pos!=='D'));
   assert.ok(scored.every(p=>p.p!==null&&p.toi!==null&&p.gp>=1));
 }
 console.log('PASS: career formula weights adapted to seasons, baseline coverage, position peers, private preview, 3/4/5+ community blends, and voter separation.');
})().catch(e=>{console.error(e);process.exitCode=1;});
