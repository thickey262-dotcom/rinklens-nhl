'use strict';
/* Descriptive 0-100 composite calculated exclusively from MoneyPuck 5-on-5 metrics.
   No Eye Test, NHL API data, manual reports or professional scouting is used.
   Percentiles compare same-season F with F, D with D; midranks handle tied values.
   GP qualification and neutral-50 shrinkage reduce early-season distortions. */
const RinkStats = (() => {
  const METRICS = Object.freeze([
    {key:'xgfPct',label:'Expected goals share (xGF%)',weight:35,digits:1},
    {key:'cfPct',label:'Shot-attempt share (CF%)',weight:15,digits:1},
    {key:'ffPct',label:'Unblocked shot-attempt share (FF%)',weight:10,digits:1},
    {key:'ixG60',label:'Individual expected goals / 60 (ixG/60)',weight:25,digits:2},
    {key:'hdCfPct',label:'High-danger shot share (HDCF%)',weight:15,digits:1}
  ]);
  let byId = new Map(), minimumGames = 10;
  const isNumber = v => typeof v === 'number' && Number.isFinite(v);
  const group = p => p.pos === 'D' ? 'D' : ['C','L','R','LW','RW'].includes(p.pos) ? 'F' : null;
  const valid = (p,key) => isNumber(p[key]) && p[key] >= 0
    && p[key] <= (key === 'ixG60' ? 100 : 100);
  function boundary(sorted, value, upper) {
    let lo=0,hi=sorted.length;
    while(lo<hi){const mid=(lo+hi)>>1;if(sorted[mid]<value || (upper && sorted[mid]===value))lo=mid+1;else hi=mid;}
    return lo;
  }
  function percentile(values,value) {
    if(values.length===0)return null;
    const below=boundary(values,value,false), atOrBelow=boundary(values,value,true);
    return 100*(below+(atOrBelow-below)/2)/values.length;
  }
  function calculate(players) {
    byId=new Map();
    const source=Array.isArray(players)?players:[];
    const maxGP=Math.max(0,...source.map(p=>isNumber(p.gp)?p.gp:0));
    minimumGames=maxGP<15?3:10;
    const peers=source.filter(p=>group(p)&&isNumber(p.gp)&&p.gp>=minimumGames);
    const pools={F:{},D:{}};
    for(const kind of ['F','D']) {
      for(const metric of METRICS) {
        pools[kind][metric.key]=peers.filter(p=>group(p)===kind&&valid(p,metric.key))
          .map(p=>p[metric.key]).sort((a,b)=>a-b);
      }
    }
    for(const p of peers) {
      const kind=group(p);
      const data=METRICS.filter(m=>valid(p,m.key)&&pools[kind][m.key].length>=30);
      // Require the two complementary expected-goal measures and at least four metrics.
      // Never turn absent advanced data into an invented zero or an estimated metric.
      if(data.length<4 || !data.some(m=>m.key==='xgfPct') || !data.some(m=>m.key==='ixG60'))continue;
      const denominator=data.reduce((sum,m)=>sum+m.weight,0);
      const breakdown=data.map(m=>({
        key:m.key,label:m.label,weight:m.weight,value:p[m.key],
        percentile:percentile(pools[kind][m.key],p[m.key]),
        peers:pools[kind][m.key].length,digits:m.digits
      }));
      const raw=breakdown.reduce((sum,m)=>sum+m.percentile*m.weight,0)/denominator;
      const reliability=p.gp/(p.gp+10);
      const score=Math.max(0,Math.min(100,Math.round(50+(raw-50)*reliability)));
      byId.set(String(p.id),{score,raw,reliability,gp:p.gp,minimumGames,group:kind,
        metricWeight:denominator,breakdown});
    }
    return byId;
  }
  const forPlayer = p => p ? byId.get(String(p.id))??null : null;
  const score = p => forPlayer(p)?.score??null;
  function panel(p) {
    const data=forPlayer(p);
    const introductory='<p class="source-note">A MoneyPuck-only statistical index, calculated by RinkLens. It is <strong>not</strong> an official MoneyPuck rating, an Eye Test score, a scouting grade, or a forecast of future talent.</p>';
    if(!data)return '<section class="stat-score-panel"><div class="eyebrow">FIVE-ON-FIVE · ADVANCED DATA</div><h3>Advanced Stats Score: —</h3><p>No score until this player meets the season game minimum ('+minimumGames+' GP) and has enough verified MoneyPuck metrics and qualifying peers.</p>'+introductory+'</section>';
    const rows=data.breakdown.map(m=>'<tr><th>'+m.label+'</th><td>'+m.value.toFixed(m.digits)+'</td><td>'+Math.round(m.percentile)+'th</td><td>'+m.weight+'%</td></tr>').join('');
    return '<section class="stat-score-panel"><div class="eyebrow">MONEYPUCK METRICS · RINKLENS CALCULATION</div>'
      +'<h3>Advanced Stats Score <strong class="composite-score">'+data.score+'/100</strong></h3>'
      +'<p>Five-on-five season percentiles among qualified '+(data.group==='D'?'defensemen':'forwards')+'. Higher means a stronger result across these particular metrics, not necessarily a better overall player.</p>'
      +'<details><summary>See exactly how this score is calculated</summary>'
      +'<div class="table-wrap"><table><thead><tr><th>Metric</th><th>Value</th><th>Peer percentile</th><th>Weight</th></tr></thead><tbody>'+rows+'</tbody></table></div>'
      +'<p class="source-note">Weighted percentile average, divided by the total weight of available metrics ('+data.metricWeight+'%). Then adjusted toward 50 using GP / (GP + 10) to temper small samples. Game minimum: '+data.minimumGames+'. Equal values share their percentile rank; the peer pool is based on this season only. Scores recalculate with each MoneyPuck refresh.</p></details>'+introductory+'</section>';
  }
  return {METRICS,calculate,forPlayer,score,panel,group,get minimumGames(){return minimumGames;}};
})();
