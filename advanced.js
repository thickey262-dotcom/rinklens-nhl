'use strict';
// Player-level advanced statistics. NHL IDs join the separate NHL and MoneyPuck data feeds.
const RinkAdvanced=(()=>{
 const fields=[
 ['xgfPct','xGF%','Expected-goal share','xgf',1,'%'],
 ['cfPct','CF%','Shot-attempt share','corsi',1,'%'],
 ['ffPct','FF%','Unblocked attempt share','fenwick',1,'%'],
 ['ixG60','ixG/60','Individual expected goals per 60','xg',2,''],
 ['hdCfPct','HDCF%','High-danger chance share','hdcf',1,'%']
 ];
 let updated=null,token=0;
 const valid=(v,max=100)=>typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=max;
 function read(p,key){
  if(p.advanced&&Object.prototype.hasOwnProperty.call(p.advanced,key))return p.advanced[key];
  if(S.source==='moneypuck'){
   const legacy={xgfPct:p.xgp,cfPct:p.cfp,ixG60:p.xg60};
   return Object.prototype.hasOwnProperty.call(legacy,key)?legacy[key]:null;
  }
  return null;
 }
 const has=p=>fields.some(([key])=>valid(read(p,key),key==='ixG60'?1000:100));
 function fmt(p,key){
  const f=fields.find(x=>x[0]===key);if(!f)return '—';
  const v=read(p,key);return valid(v,key==='ixG60'?1000:100)?v.toFixed(f[4])+f[5]:'—';
 }
 function profile(p){
  const ready=has(p),label=S.source==='demo'?'DEMO':ready?'REAL 5V5 DATA':'UNAVAILABLE';
  const cards=fields.map(f=>'<button class="adv-player-metric" type="button" data-stat-help="'+f[3]+'" title="Learn '+f[2]+'"><span>'+f[1]+' ⓘ</span><strong>'+fmt(p,f[0])+'</strong><small>'+f[2]+'</small></button>').join('');
  const notice=S.source==='demo'?'Fictional player and illustrative numbers.':ready?'Source: <a href="https://moneypuck.com/data.htm" target="_blank" rel="noopener noreferrer">MoneyPuck.com</a> · 5v5 season skater data'+(updated?' · Updated '+new Date(updated).toLocaleDateString():'')+(p.gp<15?' · Small early-season sample.':''):'No verified 5v5 data for this player and season yet. Missing statistics are not invented.';
  return '<section class="adv-player-section"><div class="adv-heading"><div><span class="eyebrow muted">NUMBERS MEET THE EYE TEST · FIVE-ON-FIVE</span><h3>Advanced stats</h3><p>Tap any number for a plain-English explanation.</p></div><span class="adv-tag">'+label+'</span></div><div class="adv-player-grid">'+cards+'</div><p class="adv-player-foot">'+notice+' On-ice numbers measure what happened with all five skaters, not the player’s isolated impact. MoneyPuck data is for non-commercial use with attribution.</p></section>';
 }
 async function load(season){
  const t=++token;updated=null;
  if(S.source!=='nhl')return;
  try{
   const res=await fetch('data/advanced-'+season+'.json?v='+Math.floor(Date.now()/3600000),{cache:'no-store'});
   if(!res.ok)throw Error('No snapshot');
   const data=await res.json();
   if(data.source!=='moneypuck'||data.season!==season||!Array.isArray(data.players))throw Error('Invalid advanced snapshot');
   if(t!==token||S.season!==season||S.source!=='nhl')return;
   const byId=new Map(data.players.map(row=>[String(row.id),row]));
   for(const p of S.players){
    const row=byId.get(String(p.id));
    p.advanced=row?Object.fromEntries(fields.map(f=>[f[0],valid(row[f[0]],f[0]==='ixG60'?1000:100)?row[f[0]]:null])):null;
   }
   updated=data.updatedAt||null;
   renderTable();renderCompare();
   if(S.active&&!document.getElementById('playerModal').hidden){
    const current=playerFor(S.active),panel=document.querySelector('.report-card');
    if(current&&panel)panel.outerHTML=RinkReports.profile(current);
   }
  }catch(e){console.info('5v5 advanced data not yet available:',e.message);}
 }
 document.addEventListener('click',e=>{
  const target=e.target.closest('[data-stat-help]');if(!target)return;
  e.preventDefault();
  if(!document.getElementById('playerModal').hidden)closePlayer();
  navigate('learn');
  document.querySelector('#view-learn [data-learn-stat="'+target.dataset.statHelp+'"]')?.click();
 });
 return {fmt,read,has,profile,load};
})();
