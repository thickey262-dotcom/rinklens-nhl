'use strict';
/* RinkLens Advanced Stats Score:
 * MoneyPuck-only 5-on-5 percentiles, separate F/D weights and 10% total 5v5 minutes.
 * Eligible players need documented 5v5 games and ice time, never proxy minutes.
 * Scores are descriptive—not player-value forecasts, MoneyPuck ratings or Eye Tests.
 */
const RinkStats = (() => {
  const METRICS = Object.freeze([
    {key:'xgfPct',label:'Expected goals share (xGF%)',digits:1},
    {key:'ixG60',label:'Individual expected goals / 60 (ixG/60)',digits:2},
    {key:'cfPct',label:'Shot-attempt share (CF%)',digits:1},
    {key:'ffPct',label:'Unblocked shot-attempt share (FF%)',digits:1},
    {key:'hdCfPct',label:'High-danger shot share (HDCF%)',digits:1},
    {key:'fiveToiMinutes',label:'Total five-on-five ice time (minutes)',digits:1}
  ]);
  // Total 5v5 minutes carry an explicit 10% usage/availability component.
  // Percentiles are compared among qualified peers of the same position and season.
  const WEIGHTS = Object.freeze({
    F: Object.freeze({xgfPct:35,ixG60:25,cfPct:10,ffPct:5,hdCfPct:15,fiveToiMinutes:10}),
    D: Object.freeze({xgfPct:40,ixG60:10,cfPct:15,ffPct:10,hdCfPct:15,fiveToiMinutes:10})
  });
  const MIN_PEERS=30;
  let byId=new Map(),missingReasons=new Map(),minimumGames=10,minimumMinutes=100;
  const isNumber=v=>typeof v==='number'&&Number.isFinite(v);
  const group=p=>p?.pos==='D'?'D':['C','L','R','LW','RW'].includes(p?.pos)?'F':null;
  const valid=(p,key)=>key==='fiveToiMinutes'
    ? isNumber(p.fiveToiMinutes)&&p.fiveToiMinutes>0&&p.fiveToiMinutes<=100000
    : isNumber(p[key])&&p[key]>=0&&p[key]<=100;
  const fiveMinutes=p=>isNumber(p?.fiveToiMinutes)&&p.fiveToiMinutes>0?p.fiveToiMinutes:null;
  const fiveGames=p=>isNumber(p?.fiveGp)&&p.fiveGp>0?p.fiveGp:null;
  function qualifies(p){
    return !!group(p)&&fiveGames(p)!==null&&fiveGames(p)>=minimumGames
      &&fiveMinutes(p)!==null&&fiveMinutes(p)>=minimumMinutes;
  }
  function boundary(sorted,value,upper){
    let lo=0,hi=sorted.length;
    while(lo<hi){const mid=(lo+hi)>>1;if(sorted[mid]<value||(upper&&sorted[mid]===value))lo=mid+1;else hi=mid;}
    return lo;
  }
  function percentile(values,value){
    if(!values.length)return null;
    const less=boundary(values,value,false),upTo=boundary(values,value,true);
    return 100*(less+(upTo-less)/2)/values.length;
  }
  function reliabilityLabel(gp,minutes){
    if(gp<20||minutes<300)return 'Small sample';
    if(gp<45||minutes<750)return 'Moderate sample';
    return 'Larger sample';
  }
  function unavailable(p){
    if(!group(p))return 'Position unavailable';
    if(fiveMinutes(p)===null||fiveGames(p)===null)
      return 'Five-on-five ice time or games missing from MoneyPuck';
    if(fiveGames(p)<minimumGames||fiveMinutes(p)<minimumMinutes)
      return 'Needs '+minimumGames+' five-on-five games and '+minimumMinutes+' five-on-five minutes';
    return 'Not enough valid MoneyPuck metrics or qualified position peers';
  }
  function calculate(players){
    byId=new Map();missingReasons=new Map();
    const source=Array.isArray(players)?players:[];
    const maxGP=Math.max(0,...source.map(p=>isNumber(p?.gp)?p.gp:0));
    const early=maxGP<15;
    minimumGames=early?3:10;
    minimumMinutes=early?30:100;
    const peers=source.filter(qualifies);
    const pools={F:{},D:{}};
    for(const kind of ['F','D']){
      for(const m of METRICS){
        pools[kind][m.key]=peers.filter(p=>group(p)===kind&&valid(p,m.key))
          .map(p=>p[m.key]).sort((a,b)=>a-b);
      }
    }
    for(const p of source){
      const id=String(p.id);
      if(!qualifies(p)){missingReasons.set(id,unavailable(p));continue;}
      const kind=group(p), weights=WEIGHTS[kind];
      const available=METRICS.filter(m=>valid(p,m.key)&&pools[kind][m.key].length>=MIN_PEERS);
      // Total 5v5 minutes must be present but cannot substitute for four advanced metrics.
      const advanced=available.filter(m=>m.key!=='fiveToiMinutes');
      if(!available.some(m=>m.key==='fiveToiMinutes')||advanced.length<4||
         !advanced.some(m=>m.key==='xgfPct')||!advanced.some(m=>m.key==='ixG60')){
        missingReasons.set(id,unavailable(p));continue;
      }
      const denominator=available.reduce((sum,m)=>sum+weights[m.key],0);
      const breakdown=available.map(m=>({
        key:m.key,label:m.label,value:p[m.key],digits:m.digits,
        weight:weights[m.key],percentile:percentile(pools[kind][m.key],p[m.key]),
        peers:pools[kind][m.key].length
      }));
      const raw=breakdown.reduce((sum,m)=>sum+m.weight*m.percentile,0)/denominator;
      // Games and minutes determine sample reliability separately from the
      // explicit 10% total-minutes component in the weighted average.
      // A roughly 12-minute 5v5 game is one effective game; fewer minutes lowers certainty.
      // Never use an all-situations time-on-ice value to fill in 5v5 minutes.
      const effectiveGames=Math.min(fiveGames(p),fiveMinutes(p)/12);
      const reliability=effectiveGames/(effectiveGames+10);
      const score=Math.max(0,Math.min(100,Math.round(50+(raw-50)*reliability)));
      byId.set(id,{
        score,raw,group:kind,breakdown,metricWeight:denominator,reliability,
        effectiveGames,fiveGp:fiveGames(p),fiveToiMinutes:fiveMinutes(p),
        minimumGames,minimumMinutes,
        reliabilityLabel:reliabilityLabel(fiveGames(p),fiveMinutes(p))
      });
    }
    return byId;
  }
  const forPlayer=p=>p?byId.get(String(p.id))??null:null;
  const score=p=>forPlayer(p)?.score??null;
  const label=p=>forPlayer(p)?.reliabilityLabel??null;
  const reason=p=>p?missingReasons.get(String(p.id))??null:null;
  function panel(p){
    const data=forPlayer(p);
    const caveat='<p class="source-note">This is a RinkLens statistical calculation from MoneyPuck 5-on-5 data, <strong>not</strong> an official MoneyPuck rating, an Eye Test or an all-around talent projection. Shot-attempt metrics overlap, and on-ice results depend on teammates, opponents and usage.</p>';
    if(!data)return '<section class="stat-score-panel"><div class="eyebrow">FIVE-ON-FIVE · MONEYPUCK</div><h3>Advanced Stats Score: —</h3><p>'+String(reason(p)||'Not enough data for a reliable score')+'. A dash is not a zero.</p>'+caveat+'</section>';
    const rows=data.breakdown.map(m=>'<tr><th>'+m.label+'</th><td>'+m.value.toFixed(m.digits)+'</td><td>'+Math.round(m.percentile)+'th</td><td>'+m.weight+'%</td></tr>').join('');
    return '<section class="stat-score-panel"><div class="eyebrow">RINKLENS SCORE · MONEYPUCK DATA</div>'
      +'<h3>Advanced Stats Score <strong class="composite-score">'+data.score+'/100</strong></h3>'
      +'<p><span class="sample-label">'+data.reliabilityLabel+'</span> · '+data.fiveGp+' games, '+data.fiveToiMinutes.toFixed(1)+' minutes at five-on-five.</p>'
      +'<p>Compared with qualified '+(data.group==='D'?'defensemen':'forwards')+' from this season only. Total five-on-five ice time makes up <strong>10%</strong> of this score, rewarding minutes played alongside five advanced metrics. Games played still contributes to the separate eligibility and sample-reliability checks, but is no longer a weighted scoring component.</p>'
      +'<details><summary>View the score breakdown and position weights</summary>'
      +'<div class="table-wrap"><table><thead><tr><th>Metric</th><th>Player value</th><th>Position percentile</th><th>Weight</th></tr></thead><tbody>'+rows+'</tbody></table></div>'
      +'<p class="source-note">Total five-on-five minutes earn a 10% weight based on the percentile among qualified players at the same position and season. The other five measures supply the remaining 90%, with available weights renormalized only when one optional advanced metric is missing. Actual games and five-on-five minutes still influence the separate sample-size adjustment toward 50: effective 5v5 games / (effective 5v5 games + 10), where effective 5v5 games = min(actual 5v5 games, 5v5 minutes / 12). Qualified players need '+data.minimumGames+' five-on-five games and '+data.minimumMinutes+' five-on-five minutes; every included metric needs at least 30 qualified peers. Equal values share a midrank. More five-on-five minutes can increase a player’s score even with identical underlying shot and chance rates; additional games affect it only through sample eligibility and reliability.</p>'
      +'</details>'+caveat+'</section>';
  }
  return {
    METRICS,WEIGHTS,MIN_PEERS,calculate,forPlayer,score,label,reason,panel,group,
    get minimumGames(){return minimumGames},
    get minimumMinutes(){return minimumMinutes}
  };
})();
