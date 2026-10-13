'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const base=path.resolve(__dirname,'..');
const eyeSource=fs.readFileSync(path.join(base,'eye.js'),'utf8');
const tableSource=fs.readFileSync(path.join(base,'money.js'),'utf8');
const html=fs.readFileSync(path.join(base,'index.html'),'utf8');

const player={id:'8478402',name:'Test Skater',team:'EDM',pos:'C',gp:20};
const state={season:'20262027',players:[player],selected:[],page:1,ready:true};
const listeners={}, nodes=new Map(), posted=[];
function node(id){
 if(!nodes.has(id))nodes.set(id,{
  id,hidden:false,textContent:'',value:'',checked:false,disabled:false,
  addEventListener(type,fn){listeners[id+':'+type]=fn;},
  focus(){},scrollIntoView(){},classList:{toggle(){}}
 });
 return nodes.get(id);
}
const doc={
 getElementById:node,
 addEventListener(type,fn){listeners[type]=fn;},
 querySelector(){return null;}
};
const cloud={
 user:{id:'f6be20bf-d8df-4895-8f46-f03c6f4cb707',email:'viewer@example.com'},
 client:{
  from(table){
   if(table==='community_eye_votes')return {
     select(){return {eq:async()=>({data:[],error:null})};},
     upsert:async(data,opts)=>{posted.push({data,opts});return {error:null};}
   };
   if(table==='community_eye_scores')return {
     select(){return {eq:async()=>({data:[],error:null})};}
   };
   throw Error('Unexpected table '+table);
  }
 },
 initialize:async()=>true
};
const context={
 window:{confirm:()=>true}, document:doc, state, RinkCloud:cloud,
 safe:x=>String(x), get:id=>id===player.id?player:null,
 render(){},renderCompare(){},close(){}, console
};
const eye=vm.runInNewContext(eyeSource+'\nRinkEye;',context);
assert.equal(context.window.RinkEye,eye,'Eye Test must be accessible to the player table');
assert.equal(typeof eye.hasOwn,'function','table may show Edit rating');
const body=eye.panel(player);
assert.match(body,/Save Eye Test rating/);
assert.match(body,/data-eye-fill="3"/);
assert.match(body,/same grade for every skill/i);
assert.equal((body.match(/type="radio"/g)||[]).length,30,'six separately chosen skills, five grades each');
for(const trait of ['skating','puck','iq','defense','compete','transition']){
 assert.ok(body.includes('name="'+trait+'"'),'individual skill available: '+trait);
}
assert.match(tableSource,/data-eye-rate/,'one-click rate button in table');
assert.match(tableSource,/if\(rate\)detail\(rate\.dataset\.eyeRate\)/);
assert.match(tableSource,/\+eye\s*\+/,'rating panel should appear before stats');
assert.ok(html.includes('Find a player to rate'));

const selected={};
const status={textContent:''};
const form={
 id:'eyeVoteForm',
 dataset:{eyePlayer:player.id},
 querySelector(selector){
  if(selector==='#eyeQuickStatus')return status;
  const m=selector.match(/^input\[name="([a-z]+)"\]\[value="(\d)"\]$/);
  if(m)return selected[m[1]]??(selected[m[1]]={checked:false});
  if(selector==='[type="submit"]')return {disabled:false};
  return null;
 },
 elements:{namedItem(key){
  if(key==='watched')return {checked:true};
  return {value:'4'};
 }}
};
const button={
 dataset:{eyeFill:'4'},
 closest(selector){return selector==='[data-eye-fill]'?this:selector==='#eyeVoteForm'?form:null;}
};
(async()=>{
 const clickPromise=listeners.click({target:button});
 if(clickPromise)await clickPromise;
 assert.equal(Object.keys(selected).length,6,'quick-fill should set all six distinct grade controls');
 assert.ok(Object.values(selected).every(x=>x.checked),'quick-fill should select all grades');
 assert.match(status.textContent,/All six skills set to 4\/5/);
 const submitPromise=listeners.submit({target:form,preventDefault(){}});
 if(submitPromise)await submitPromise;
 assert.equal(posted.length,1,'one ballot should be submitted');
 const sent=posted[0].data;
 assert.equal(sent.season_id,state.season);
 assert.equal(sent.player_id,player.id);
 for(const key of ['skating','puck','iq','defense','compete','transition']){
  assert.equal(sent[key],4);
 }
 assert.equal(posted[0].opts.onConflict,'user_id,season_id,player_id');
 assert.ok(!Object.hasOwn(sent,'score'),'client must not forge aggregate Eye Test ratings');
 cloud.user=null;
 assert.match(eye.panel(player),/Sign in to rate this player/);
 assert.ok(!eyeSource.includes('service_role'),'no secret service API keys in the client');
 console.log('PASS: Eye Test quick-fill, six editable grades, one stored private ballot, sign-in gate, table rate action and score integration');
})().catch(e=>{console.error(e);process.exitCode=1;});
