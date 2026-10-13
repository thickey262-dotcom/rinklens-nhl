'use strict';
/* NHL and MoneyPuck statistical model. No text or human scouting evidence is invented. */
const RinkModel=(()=>{
 let byId=new Map(),loadedSeason=null,loadToken=0,loadError=null;
 const esc=x=>String(x??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
 function ingest(snapshot){
   if(snapshot?.version!==1||!/^20\d{6}$/.test(snapshot.season)||!Array.isArray(snapshot.players))return false;
   const seen=new Map();
   for(const row of snapshot.players){
     if(!/^\d{6,10}$/.test(String(row.id)))continue;
     if(!Number.isInteger(row.score)||row.score<0||row.score>100||row.kind!=='stats-only-model')continue;
     if(!Number.isInteger(row.gamesAcrossSeasons)||row.gamesAcrossSeasons<1)continue;
     seen.set(String(row.id),row);
   }
   if(seen.size<1)return false;
   byId=seen;loadedSeason=snapshot.season;loadError=null;return true;
 }
 async function load(season){
   const token=++loadToken;loadedSeason=null;byId=new Map();
   try{
     const response=await fetch('data/model-rating-'+season+'.json',{cache:'no-store'});
     if(!response.ok)throw new Error('No full-league model ratings snapshot');
     const json=await response.json();
     if(token!==loadToken)return false;
     if(json.season!==season||!ingest(json))throw Error('Invalid or mismatched model rating file');
     return true;
   }catch(e){if(token===loadToken){loadedSeason=null;byId.clear();loadError=String(e.message||e)}return false;}
 }
 function forPlayer(p){
   if(!p||S.source==='demo'||S.source==='moneypuck'||S.season!==loadedSeason)return null;
   const row=byId.get(String(p.id));
   if(!row||row.name!==p.name||row.position!==(p.pos==='D'?'D':'F'))return null;
   return row;
 }
 const score=p=>forPlayer(p)?.score??null;
 function status(){return {season:loadedSeason,count:byId.size,loadError}}
 function panel(p){
   const r=forPlayer(p);
   if(!r)return '<section class="model-panel"><h4>Full-league model rating</h4><p>No verified statistical model score is available for this player and season. This is not an eye-test score.</p></section>';
   const included=r.seasons.map(x=>'<li><b>'+esc(x.season.slice(0,4)+'–'+x.season.slice(-2))+'</b> · '+esc(x.games)+' games · '+esc(x.rawPositionPercentile)+' raw peer score · '+Math.round(x.weight*100)+'% season weighting before small-sample adjustment</li>').join('');
   return '<section class="model-panel" aria-label="Statistical model rating for '+esc(p.name)+'"><div class="model-heading"><div><span class="model-label">FULL-LEAGUE EVALUATION · STATS ONLY</span><h4>Model rating</h4></div><div class="model-number">'+r.score+'<small>/100</small></div></div>'+
     '<p>Estimated statistical performance relative to '+(r.position==='D'?'defensemen':'forwards')+'. This <strong>is not an eye test</strong>, published scouting opinion, or independent talent assessment.</p>'+
     '<p class="model-confidence">'+esc(r.confidence)+' · '+esc(r.gamesAcrossSeasons)+' games of recent and historical evidence'+(r.hasAdvancedData?' · includes MoneyPuck chance metrics':' · NHL summary statistics only')+'</p>'+
     '<details><summary>How this rating was calculated</summary><p>Points, goals and shots per 60 minutes, plus average ice time. When available, five-on-five expected-goal share and individual expected goals are included. Historical seasons help steady small samples; new players with little evidence stay near neutral (50). This is a descriptive calculation, not a professional scouting grade.</p><ul>'+included+'</ul><p>Sources: <a href="https://www.nhl.com/stats/" target="_blank" rel="noopener noreferrer">NHL statistics</a> and <a href="https://moneypuck.com/data.htm" target="_blank" rel="noopener noreferrer">MoneyPuck</a>. Missing metrics are omitted rather than guessed.</p></details></section>';
 }
 return {load,ingest,forPlayer,score,status,panel};
})();
