'use strict';
/* A reproducible stats-based scouting PROXY; never video, human observation, or AI film grading.
   Strictly position-relative, transparent weights, and deliberately excluded from combined grades. */
const RinkAuto=(()=>{
 const METRICS=[
  {key:'xgfPct',label:'On-ice expected-goal share',weight:0.25},
  {key:'ixG60',label:'Individual expected goals / 60',weight:0.30},
  {key:'cfPct',label:'On-ice shot-attempt share',weight:0.12},
  {key:'ffPct',label:'On-ice unblocked share',weight:0.08},
  {key:'hdCfPct',label:'On-ice high-danger share',weight:0.10},
  {key:'p60',label:'Points / 60, all situations',weight:0.15}
 ];
 let cache=new WeakMap();
 const invalidate=()=>{cache=new WeakMap()};
 function estimate(p){
  if(!p||S.source==='demo')return null;
  if(cache.has(p))return cache.get(p);
  const ranks=METRICS.map(m=>({...m,rank:RinkReports.rank(p,m.key)}));
  const available=ranks.filter(m=>m.rank!==null);
  // We need individual shot quality + on-ice xG share, at least two other reliable metrics.
  if(available.length<4||!available.some(m=>m.key==='xgfPct')||!available.some(m=>m.key==='ixG60')){
   cache.set(p,null);return null;
  }
  const total=available.reduce((s,m)=>s+m.weight,0);
  const score=Math.round(available.reduce((s,m)=>s+m.weight*m.rank.pct,0)/total);
  const gp=Number(p.advanced?.gp??p.gp)||0;
  const confidence=gp<10?'Very limited sample':gp<25?'Limited sample':gp<50?'Developing sample':'Larger sample';
  const result={score,gp,confidence,covered:available.length,total:METRICS.length,ranks:available};
  cache.set(p,result);return result;
 }
 function explanation(result){
  if(!result)return 'Not enough verified statistics or same-position peers to calculate an estimate.';
  const xg=result.ranks.find(x=>x.key==='xgfPct');
  const ix=result.ranks.find(x=>x.key==='ixG60');
  const phrases=[];
  if(xg.rank.pct>=70)phrases.push('strong team expected-goal share while on the ice');
  else if(xg.rank.pct<=30)phrases.push('below-average team expected-goal share while on the ice');
  if(ix.rank.pct>=70)phrases.push('high individual shot-quality generation');
  else if(ix.rank.pct<=30)phrases.push('low individual shot-quality generation');
  return phrases.length?`What the numbers suggest: ${phrases.join('; ')}. Neither is proof of skating ability, effort, or hockey IQ.`:
   'The available chance and production metrics sit near the middle of the same-position peer group; they do not reveal skating, decisions, or effort.';
 }
 function panel(p){
  const r=estimate(p),score=r?`${r.score}<small>/100</small>`:'—';
  const bars=r?r.ranks.map(m=>`<li><span>${esc(m.label)}</span><span>${m.rank.pct}th percentile · ${Math.round(m.weight*100)}% weight</span></li>`).join(''):'';
  return `<section class="auto-scout-panel" aria-label="Automatic stats-based scouting estimate"><div class="auto-scout-head"><div><div class="eyebrow muted">AUTOMATED · STATS ONLY · NOT AN EYE TEST</div><h4>Auto Scout Estimate</h4></div><strong>${score}</strong></div><p class="auto-scout-note">${esc(explanation(r))}</p>${r?`<p class="auto-scout-confidence">${esc(r.confidence)} (${r.gp} games) · ${r.covered}/${r.total} metrics available · Compared only with ${esc(RinkReports.groupName(p))}.</p><details><summary>How was this calculated?</summary><p>Weighted average of same-position statistical percentiles, with missing metrics excluded and remaining weights normalized. Higher means stronger performance on the selected metrics—not a human scouting opinion or a calibrated talent grade.</p><ul>${bars}</ul></details>`:`<p class="auto-scout-confidence">No estimate is assigned for demo data, very small samples, or insufficient data coverage.</p>`}<p class="auto-scout-disclaimer">The model has not watched this player. It cannot assess skating mechanics, hockey IQ, compete level, defensive habits, or decisions. It partly reuses the analytics inputs, so it is deliberately <b>not</b> averaged into RinkLens's combined analytics + human eye-test score. <a href="https://moneypuck.com/data.htm" target="_blank" rel="noopener noreferrer">5-on-5 source: MoneyPuck</a> (non-commercial use with attribution).</p></section>`;
 }
 return {estimate,explanation,panel,invalidate,metrics:METRICS};
})();
