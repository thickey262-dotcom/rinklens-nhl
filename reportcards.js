'use strict';
/* RinkLens Report Cards: descriptive ranks, not an isolated-impact model.
   No percentile is shown for imaginary data, missing metrics or small samples. */
const RinkReports=(()=>{
  const DEFINITIONS=[
    {key:'xgfPct',name:'xGF%',text:'Share of expected goals for your team when this player is on the ice at 5-on-5. It measures chance quality, not individual credit.',lesson:'xgf',digits:1,suffix:'%'},
    {key:'cfPct',name:'CF%',text:'Share of all shot attempts (Corsi) at 5-on-5. A shot-attempt proxy, not time spent possessing the puck.',lesson:'corsi',digits:1,suffix:'%'},
    {key:'ffPct',name:'FF%',text:'Share of unblocked shot attempts (Fenwick) at 5-on-5. Blocked shots are excluded.',lesson:'fenwick',digits:1,suffix:'%'},
    {key:'ixG60',name:'ixG/60',text:'Expected goals from the player’s own shots per 60 minutes of 5-on-5 ice time. Higher means more or better chances.',lesson:'xg',digits:2,suffix:''},
    {key:'hdCfPct',name:'HDCF%',text:'Share of high-danger chances at 5-on-5 with this player on the ice. Team and linemate effects matter.',lesson:'hdcf',digits:1,suffix:'%'},
    {key:'p60',name:'Points/60',text:'Goals plus assists per 60 minutes of total ice time (all situations), not just 5-on-5. Not adjusted for teammates or power-play time.',lesson:null,digits:2,suffix:''}
  ];
  const number=v=>typeof v==='number'&&Number.isFinite(v);
  const group=p=>p.pos==='D'?'D':(['LW','L'].includes(p.pos)?'L':['RW','R'].includes(p.pos)?'R':p.pos==='C'?'C':null);
  const groupName=p=>({C:'centers',L:'left wings',R:'right wings',D:'defensemen'})[group(p)]||'players';
  const peerThreshold=()=>{
    const maxGames=Math.max(0,...S.players.map(x=>Number(x.gp)||0));
    // Three games early in the season, ten when a full season has been played.
    return maxGames<15?3:10;
  };
  function value(p,key){
    if(key==='p60')return p.gp>0&&p.toi>0&&number(p.p)?p.p*60/(p.gp*p.toi):null;
    const v=RinkAdvanced.read(p,key);
    return number(v)&&v>=0&&v<=(key==='ixG60'?1000:100)?v:null;
  }
  function rank(p,key){
    if(S.source==='demo'||!group(p))return null;
    const threshold=peerThreshold(),v=value(p,key);
    const gp=key==='p60'?p.gp:(p.advanced?.gp??p.gp);
    if(!number(v)||!(gp>=threshold))return null;
    const peers=S.players.filter(q=>group(q)===group(p)&&(key==='p60'?q.gp:(q.advanced?.gp??q.gp))>=threshold).map(q=>value(q,key)).filter(number);
    if(peers.length<15)return null;
    const below=peers.filter(x=>x<v).length,tied=peers.filter(x=>x===v).length;
    return {pct:Math.round(100*(below+tied/2)/peers.length),count:peers.length,threshold};
  }
  const percentileText=r=>r?`${r.pct}th percentile among ${r.count} qualified peers`:'Percentile unavailable';
  function statCard(p,m){
    const v=value(p,m.key),r=rank(p,m.key);
    const displayed=number(v)?v.toFixed(m.digits)+m.suffix:'—';
    const label=r?`${r.pct}th`:'—';
    const expl=r?`Ranks above roughly ${r.pct}% of qualified ${groupName(p)} in this metric (tied values split).`:'Not enough qualified peer data for a reliable same-position comparison.';
    const help=m.lesson?`<button type="button" data-stat-help="${m.lesson}" class="report-learn" aria-label="Explain ${m.name}">What is this? ↗</button>`:'';
    return `<article class="report-metric"><div class="report-metric-head"><b>${m.name}</b>${help}</div><div class="report-figures"><strong>${displayed}</strong><span>${label} <small>position percentile</small></span></div><div class="report-meter" aria-hidden="true"><span style="width:${r?r.pct:0}%"></span></div><p>${m.text}</p><small class="report-qualified">${esc(expl)}</small></article>`;
  }
  function scouting(p){
    const grades=reportFor(p),overall=eye(p);
    if(!grades)return `<div class="report-eye-empty"><strong>Not scouted yet.</strong> Your six eye-test grades will appear here when you save a report below. No scouting grades are fabricated.</div>`;
    return `<div class="report-eye-summary"><span><strong>${overall}/100</strong><small>Your personal eye-test grade — not a league percentile</small></span></div><div class="report-traits">${traits.map(([key,name])=>`<div><span>${esc(name)}</span><b>${n(grades[key])}/5</b></div>`).join('')}</div>${grades.notes?`<div class="report-note"><b>Scouting notes</b><p>${esc(grades.notes)}</p></div>`:''}`;
  }
  function profile(p){
    const threshold=peerThreshold();
    return `<section class="report-card" aria-label="Player report card for ${esc(p.name)}"><div class="report-heading"><div><span class="eyebrow muted">RINKLENS PLAYER REPORT CARD · ${esc(seasonLabel())}</span><h3>Numbers meet your eye test</h3></div><span class="report-label">${S.source==='demo'?'DEMONSTRATION':groupName(p).toUpperCase()}</span></div><p class="report-explainer">These percentiles compare ${esc(p.name)} with other NHL ${groupName(p)} in the same season, not the whole league. Higher means a higher value for that stat—not necessarily a better all-around player.</p><div class="report-stat-grid">${DEFINITIONS.map(m=>statCard(p,m)).join('')}</div><p class="report-caveat">${S.source==='demo'?'Demo mode: all figures are fictional; no real league percentiles are calculated.':`Qualified peers must have played at least ${threshold} games and have data for that statistic. Position groups: C, LW, RW, D. Percentiles use midranks for ties.`} Five-on-five advanced data: <a href="https://moneypuck.com/data.htm" target="_blank" rel="noopener noreferrer">MoneyPuck</a>, used with attribution for non-commercial educational purposes. Points/60 uses NHL all-situations data. On-ice shares do not isolate the player’s impact; early-season values can swing sharply.</p><div class="report-eye"><div class="report-eye-title"><h4>What your eyes say</h4><span>Subjective · private scout notes</span></div>${scouting(p)}</div></section>`;
  }
  return {profile,rank,value,group,peerThreshold,definitions:DEFINITIONS,percentileText};
})();
