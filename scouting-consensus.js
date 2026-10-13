'use strict';
/* Published scouting consensus, not the user's scouting, Gemini film analysis, or a statistical projection. */
const RinkConsensus=(()=>{
 const TRAITS=[['skating','Skating'],['puck','Puck skills'],['iq','Hockey IQ'],
   ['defense','Defensive play'],['compete','Compete level'],['transition','Transition']];
 let byId=new Map(),ready=false,problem=null;
 const esc=x=>String(x??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
 function ingest(snapshot){
   if(snapshot?.version!==1||!Array.isArray(snapshot.players))return false;
   const valid=new Map();
   for(const p of snapshot.players){
     if(!/^\d{6,10}$/.test(String(p.id))||!Array.isArray(p.sources)||!p.traits)continue;
     const score=Number.isInteger(p.score)&&p.score>=20&&p.score<=100?p.score:null;
     const safeSources=p.sources.filter(s=>s?.publisher&&/^https:\/\/(?:www\.)?(nhl\.com|eliteprospects\.com|thehockeywriters\.com)\//.test(s.url||''));
     if(safeSources.length<2)continue;
     valid.set(String(p.id),{...p,score,sources:safeSources});
   }
   byId=valid;ready=true;problem=null;return true;
 }
 async function load(){
   try{
     const response=await fetch('data/scouting-consensus.json',{cache:'no-store'});
     if(!response.ok)throw Error('No verified scouting snapshot is available');
     if(!ingest(await response.json()))throw Error('Invalid scouting snapshot');
     return true;
   }catch(e){ready=false;problem=String(e.message||e);byId.clear();return false;}
 }
 function get(p){
   if(!ready||!p||S.source==='demo'||S.season!=='20262027')return null;
   const match=byId.get(String(p.id));
   return match && match.name===p.name?match:null;
 }
 const score=p=>get(p)?.score??null;
 const status=()=>({ready,entries:byId.size,scored:[...byId.values()].filter(x=>x.score!==null).length,problem});
 function panel(p){
   const r=get(p);
   if(!r)return '<section class="consensus-panel consensus-empty"><h4>Published scouting consensus</h4><p>No verified two-source scouting consensus for this player. This is normal—most NHL players do not have enough accessible, independent scouting coverage. We do not invent ratings.</p></section>';
   const count=r.sources.length;
   const heading=r.score===null?'Not enough agreement':r.score+'/100';
   const level=r.score===null?'No overall score':r.confidence==='moderate'?'Moderate evidence':'Limited evidence';
   const cards=TRAITS.map(([key,label])=>{
     const item=r.traits[key];
     const value=item?.score;
     const meaning=item?.agreement==='conflicting'?'Reports disagree':'Not enough reports';
     const evidences=(item?.evidence||[]).filter(e=>Number.isInteger(e.sourceIndex) && e.sourceIndex>=0 && e.sourceIndex<r.sources.length)
       .slice(0,3).map(e=>'<li>'+esc(e.text)+' <a href="'+esc(r.sources[e.sourceIndex].url)+'" target="_blank" rel="noopener noreferrer">Source ↗</a></li>').join('');
     return '<div class="consensus-trait"><span>'+label+'</span><b>'+(Number.isInteger(value)?value+'/5':meaning)+'</b>'+
       (evidences?'<ul>'+evidences+'</ul>':'')+'</div>';
   }).join('');
   const links=r.sources.map(s=>'<li><a href="'+esc(s.url)+'" target="_blank" rel="noopener noreferrer">'+esc(s.publisher)+' ↗</a> · '+esc(s.author||'Published scouting report')+(s.date?' ('+esc(s.date.slice(0,10))+')':'')+'</li>').join('');
   return '<section class="consensus-panel" aria-label="Published scouting consensus for '+esc(p.name)+'">'+
     '<div class="consensus-heading"><div><span class="consensus-kicker">PUBLISHED SCOUTING REPORTS · NOT VIDEO AI</span><h4>Scouting consensus</h4></div>'+
     '<div class="consensus-score"><strong>'+heading+'</strong><small>'+esc(level)+'</small></div></div>'+
     '<p>Automatically summarized from '+count+' attributed reports by '+r.publisherCount+' independent sources. Often written during the player’s draft years, so these are <b>historical scouting opinions</b>—not current NHL performance. Your personal grade remains separate.</p>'+
     '<details><summary>See all six skills and why we scored them</summary><div class="consensus-traits">'+cards+'</div>'+
     '<h5>Read the original scouting reports</h5><ul class="consensus-sources">'+links+'</ul>'+
     '<p>Conflicting or missing reports are not given a number. Ratings are a transparent five-level interpretation of the linked scouting assessments; not validated player projections.</p></details></section>';
 }
 return {load,ingest,get,score,status,panel};
})();
