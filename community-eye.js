'use strict';
/* Signed-in, opt-in eyewitness ratings. Raw votes are RLS protected; public averages need 3 users. */
const RinkCommunity=(()=>{
 const TRAITS=[['skating','Skating'],['puck','Puck skills'],['iq','Hockey IQ'],['defense','Defensive play'],['compete','Compete level'],['transition','Transition']];
 let published=new Map(),own=new Map(),season=null,token=0,error=null,busy=false;
 const esc=x=>String(x??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
 const validPlayer=p=>Boolean(p&&/^\d{6,10}$/.test(String(p.id))&&S.source==='nhl');
 function ingest(rows,id){
   if(!/^20\d{6}$/.test(id)||!Array.isArray(rows))return false;
   const next=new Map();
   rows.forEach(r=>{if(r.season_id===id&&/^\d{6,10}$/.test(String(r.player_id))&&Number(r.reviewer_count)>=3&&Number.isInteger(r.score)&&r.score>=20&&r.score<=100&&TRAITS.every(([k])=>Number(r[k])>=1&&Number(r[k])<=5))next.set(String(r.player_id),r);});
   published=next;season=id;error=null;return true;
 }
 const get=p=>validPlayer(p)&&S.season===season?published.get(String(p.id))??null:null;
 const score=p=>get(p)?.score??null;
 function eyeTest(p){
   const pro=RinkConsensus.score(p),community=score(p);
   if(pro!==null&&community!==null)return {score:Math.round(.7*pro+.3*community),kind:'Professional + community (70% / 30%)',professional:pro,community};
   if(pro!==null)return {score:pro,kind:'Professional scouting reports',professional:pro,community:null};
   if(community!==null)return {score:community,kind:'Community eyewitness ratings',professional:null,community};
   return null;
 }
 const status=()=>({season,publicPlayers:published.size,ownVotes:own.size,error});
 function refresh(){
   if(typeof renderTable==='function')renderTable();
   if(typeof renderCompare==='function')renderCompare();
   if(S.active&&typeof playerFor==='function'){const p=playerFor(S.active),slot=document.getElementById('communityMount');if(p&&slot)slot.innerHTML=panel(p);}
 }
 async function reload(id=S.season){
   const req=++token;published=new Map();own=new Map();season=null;error=null;
   if(!RinkCloud.client||!/^20\d{6}$/.test(id)){error='Sign-in connection unavailable';return false;}
   const client=RinkCloud.client;
   try{
     const [a,m]=await Promise.all([
       client.from('community_eye_scores').select('season_id,player_id,reviewer_count,skating,puck,iq,defense,compete,transition,score,latest_at').eq('season_id',id),
       RinkCloud.user?client.from('community_eye_votes').select('player_id,skating,puck,iq,defense,compete,transition').eq('season_id',id):Promise.resolve({data:[],error:null})
     ]);
     if(req!==token||S.season!==id)return false;
     if(a.error)throw a.error;
     if(m.error)throw m.error;
     ingest(a.data||[],id);own=new Map((m.data||[]).map(r=>[String(r.player_id),r]));
     refresh();return true;
   }catch(e){if(req===token){error=String(e.message||e);refresh();}return false;}
 }
 function panel(p){
   if(!validPlayer(p))return '<section class="community-panel"><h4>Community eye test</h4><p>Voting is available only for real NHL players, not demonstration or imported data.</p></section>';
   const r=get(p),mine=own.get(String(p.id)),blend=eyeTest(p);
   const label=r?(r.reviewer_count+' accounts · '+(r.reviewer_count<10?'Early sample':r.reviewer_count<30?'Growing sample':'Broader sample')):'Not enough votes yet (3 required)';
   const grades=r?'<div class="community-traits">'+TRAITS.map(([k,name])=>'<div><span>'+name+'</span><b>'+Number(r[k]).toFixed(1)+'/5</b></div>').join('')+'</div>':'';
   const form=RinkCloud.user?'<form id="communityVoteForm" class="community-form" data-community-player="'+esc(p.id)+'"><h5>Rate this player from games you watched</h5><p>Your private scouting report is not shared. This separate contribution is optional.</p><div class="community-vote-grid">'+
     TRAITS.map(([k,name])=>'<label>'+name+'<select name="'+k+'" required aria-label="Community '+name+' grade"><option value="">Choose rating</option>'+
       [1,2,3,4,5].map(v=>'<option value="'+v+'"'+(Number(mine?.[k])===v?' selected':'')+'>'+v+' — '+['','Needs work','Developing','Average','Strong','Excellent'][v]+'</option>').join('')+'</select></label>').join('')+'</div>'+
     '<label class="community-consent"><input type="checkbox" required name="confirmWatched"> I have watched this player. I agree to share my six ratings anonymously in the public averages.</label><div class="community-actions"><button class="primary-button" type="submit">'+(mine?'Update my public vote':'Submit my public vote')+'</button>'+
     (mine?'<button class="secondary-button" type="button" data-community-delete="'+esc(p.id)+'">Withdraw vote</button>':'')+'</div><p class="community-small">One vote per signed-in account, player and season. You can edit or withdraw it. Individual ballots are not public.</p><p id="communityVoteStatus" role="status" aria-live="polite"></p></form>':
     '<p>To rate this player, sign in with your email. Nothing from your private reports is posted automatically.</p><button type="button" class="secondary-button" data-go="account">Sign in to vote →</button>';
   return '<section class="community-panel" aria-label="Community eye test for '+esc(p.name)+'"><div class="community-heading"><div><span class="community-label">ACTUAL VIEWERS · NOT STATISTICS</span><h4>Community eye test</h4></div><strong>'+(r?r.score+'/100':'Pending')+'</strong></div>'+
     '<p>'+label+'. Public averages appear only after three different signed-in accounts rate all six skills.</p>'+grades+
     '<div class="community-blend"><b>Eye Test Score: '+(blend?blend.score+'/100':'Not yet rated')+'</b><p>'+(blend?esc(blend.kind):'Requires qualifying professional scouting evidence or three community ratings.')+'</p></div>'+form+'</section>';
 }
 const message=s=>{const n=document.getElementById('communityVoteStatus');if(n)n.textContent=s;};
 async function sendVote(playerId,grades){
   if(busy)throw Error('Another rating is being saved');
   if(!RinkCloud.user||!RinkCloud.client)throw Error('Sign in before voting');
   if(S.source!=='nhl'||!S.players.some(p=>p.id===playerId))throw Error('Select a real NHL player');
   if(grades.confirmWatched!==true)throw Error('Confirm you watched the player');
   const values={};
   for(const [key] of TRAITS){const x=Number(grades[key]);if(!Number.isInteger(x)||x<1||x>5)throw Error('Rate all six skills from 1–5');values[key]=x;}
   busy=true;
   try{
     const client=RinkCloud.client,id=RinkCloud.user.id,current=S.season;
     const existing=await client.from('community_eye_votes').select('player_id').eq('user_id',id).eq('season_id',current).eq('player_id',playerId).maybeSingle();
     if(existing.error)throw existing.error;
     const result=existing.data?
       await client.from('community_eye_votes').update(values).eq('user_id',id).eq('season_id',current).eq('player_id',playerId):
       await client.from('community_eye_votes').insert({user_id:id,season_id:current,player_id:playerId,...values});
     if(result.error)throw result.error;
     await reload(current);
   }finally{busy=false;}
 }
 async function withdraw(playerId){
   if(busy)return;
   if(!RinkCloud.user||!RinkCloud.client)throw Error('Sign in to withdraw');
   if(!S.players.some(p=>p.id===playerId))throw Error('Invalid player');
   busy=true;
   try{
     const id=RinkCloud.user.id,current=S.season;
     const res=await RinkCloud.client.from('community_eye_votes').delete().eq('user_id',id).eq('season_id',current).eq('player_id',playerId);
     if(res.error)throw res.error;
     await reload(current);
   }finally{busy=false;}
 }
 document.addEventListener('submit',async e=>{
   if(e.target?.id!=='communityVoteForm')return;e.preventDefault();
   const form=e.target,values={confirmWatched:Boolean(form.elements.namedItem('confirmWatched')?.checked)};
   TRAITS.forEach(([key])=>values[key]=form.elements.namedItem(key)?.value);
   const button=form.querySelector('button[type="submit"]');if(button)button.disabled=true;
   message('Saving your vote…');
   try{await sendVote(form.dataset.communityPlayer,values);message('Your public vote was saved.');}
   catch(err){message('Could not save vote: '+String(err.message||err).slice(0,150));if(button)button.disabled=false;}
 });
 document.addEventListener('click',async e=>{
   const button=e.target?.closest?.('[data-community-delete]');if(!button)return;
   if(!window.confirm('Withdraw your community eye-test vote for this player?'))return;
   button.disabled=true;message('Withdrawing your vote…');
   try{await withdraw(button.dataset.communityDelete);message('Your vote was withdrawn.');}
   catch(err){message('Could not withdraw: '+String(err.message||err).slice(0,150));button.disabled=false;}
 });
 return {ingest,get,score,eyeTest,status,reload,panel,sendVote,withdraw,refresh};
})();
