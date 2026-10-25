'use strict';
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname,'..');
const eyeSource = fs.readFileSync(path.join(root,'eye.js'),'utf8');
const moneySource = fs.readFileSync(path.join(root,'money.js'),'utf8');
const player={id:'8477346',name:'Example Player',pos:'C',team:'BUF',gp:20};
const state={season:'20262027',players:[player],selected:[],page:1,ready:true};
const el=new Map(),handlers={},ballots=new Map();
const user1='user-1',user2='user-2';
let writes=0;
const allGrades=value=>({
  skating:value,puck:value,iq:value,defense:value,compete:value,
  transition:value,shooting:value,positioning:value
});
function node(id){
  if(!el.has(id))el.set(id,{id,dataset:{},hidden:false,textContent:'',innerHTML:'',value:'',
    addEventListener(type,fn){handlers[id+':'+type]=fn},focus(){},scrollIntoView(){},classList:{toggle(){}}
  });
  return el.get(id);
}
const doc={getElementById:node,addEventListener(type,fn){handlers[type]=fn;}};
const cloud={user:{id:user1,email:'viewer1@example.com'},initialize:async()=>true,
  client:{from(table){
    if(table==='community_eye_scores')return {select(){return {eq:async()=>({
      // Defensive check: even an accidentally returned one-reviewer row stays private.
      data:[{season_id:state.season,player_id:player.id,reviewer_count:1,score:70,...allGrades(7)}],
      error:null
    })}}};
    if(table==='community_eye_votes')return {
      select(){return {eq:async()=>({data:[...ballots.entries()]
        .filter(([user])=>user===cloud.user?.id).map(([,vote])=>vote),error:null})}},
      upsert:async(row)=>{
        if(row.user_id!==cloud.user?.id)throw Error('RLS mock account mismatch');
        ballots.set(row.user_id,row);writes++;return {error:null};
      },
      delete(){return {eq(){return {eq(){return {eq:async()=>({error:null})}}}}}}
    };
    throw Error('Unexpected table '+table);
  }}
};
const context={document:doc,window:{confirm:()=>true},state,RinkCloud:cloud,
  get:id=>id===player.id?player:null,safe:String,render(){},renderCompare(){},close(){},console};
const eye=vm.runInNewContext(eyeSource+'\nRinkEye;',context);
(async()=>{
  await eye.reload(state.season);
  assert.equal(eye.score(player.id),null,'public score hidden at one reviewer');
  assert.equal(eye.personalScore(player.id),null,'no private vote yet');
  assert.equal(eye.display(player.id).value,null);

  const gradeFields=allGrades(7);
  const inputForm={id:'eyeVoteForm',dataset:{eyePlayer:player.id},
    querySelector(sel){return sel==='[type="submit"]'?{disabled:false}:null},
    elements:{namedItem(key){return key==='watched'?{checked:true}:{value:String(gradeFields[key])}}}
  };
  await handlers.submit({target:inputForm,preventDefault(){}});
  assert.equal(writes,1,'rating should be stored');
  assert.equal(eye.score(player.id),null,'private ballot does not create a public score');
  assert.equal(eye.personalScore(player.id),70);
  assert.equal(eye.display(player.id).value,70);
  assert.equal(eye.display(player.id).label,'Your Combined Preview (Private)');
  assert.match(eye.panel(player),/70\/100/);
  assert.match(eye.panel(player),/Your Combined Preview \(Private\)/);
  assert.match(eye.panel(player),/Community score pending/);

  // Exercise the table's private/public labeling helper using the same module.
  const moneyView=new Function('window','safe',moneySource.slice(
    moneySource.indexOf('function eyeDisplay('),moneySource.indexOf('function status('))+
    '\nreturn {eyeCell,eyeDisplay};')(context.window,String);
  assert.match(moneyView.eyeCell(player.id),/70\/100/);
  assert.match(moneyView.eyeCell(player.id),/Your Combined Preview \(Private\)/);

  // Browser refresh / repeated fetch restores viewer's ballot (no published tally).
  await eye.reload(state.season);
  assert.equal(eye.personalScore(player.id),70);
  assert.equal(eye.hasOwn(player.id),true);

  // Private ballots must not leak to signed-out visitors or other accounts.
  cloud.user=null;
  await eye.reload(state.season);
  assert.equal(eye.personalScore(player.id),null);
  assert.equal(eye.display(player.id).value,null);
  assert.doesNotMatch(eye.panel(player),/Your Combined Preview \(Private\)/);
  cloud.user={id:user2,email:'viewer2@example.com'};
  await eye.reload(state.season);
  assert.equal(eye.personalScore(player.id),null,'different signed-in user cannot see previous account');
  cloud.user={id:user1,email:'viewer1@example.com'};
  await eye.reload(state.season);
  assert.equal(eye.personalScore(player.id),70,'owner recovers personal score on signing back in');

  // A public 3-voter average takes priority but preserves own score separately.
  const qualified={...allGrades(8),season_id:state.season,player_id:player.id,
    reviewer_count:3,score:80};
  const oldFrom=cloud.client.from;
  cloud.client.from=table=>table==='community_eye_scores'
    ? {select(){return {eq:async()=>({data:[qualified],error:null})}}}
    : oldFrom(table);
  await eye.reload(state.season);
  assert.equal(eye.score(player.id),80);
  assert.equal(eye.personalScore(player.id),70);
  assert.equal(eye.display(player.id).label,'Community Eye Test');
  assert.match(moneyView.eyeCell(player.id),/Your Rating \(Private\): 70\/100/);
  console.log('PASS: saved Eye Test visible to owner, public threshold remains three, safe account switching and distinct community/personal scores.');
})().catch(err=>{console.error(err);process.exitCode=1});
