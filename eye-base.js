'use strict';
/* RinkLens: a statistical starting estimate adapted from the user's NHL Career Ranking weights.
 * This is season-level MoneyPuck skater data, not a subjective or career scout grade.
 * Forwards: GP 35%, average all-situations TOI 20%, points per game 45%.
 * Defensemen: GP 35%, average all-situations TOI 25%, points per game 40%.
 */
const RinkBase = (() => {
  const WEIGHTS=Object.freeze({
    F:Object.freeze({gp:35,toi:20,ppg:45}),
    D:Object.freeze({gp:35,toi:25,ppg:40})
  });
  const COMPONENTS=Object.freeze([
    ['gp','Games played',0],['toi','Average ice time / game (minutes)',2],['ppg','Points per game',3]
  ]);
  const MIN_PEERS=20;
  let rankings=new Map();
  const finite=n=>typeof n==='number'&&Number.isFinite(n);
  const group=p=>p?.pos==='D'?'D':['C','L','R','LW','RW'].includes(p?.pos)?'F':null;
  const usable=p=>group(p)&&Number.isInteger(p.gp)&&p.gp>=1&&p.gp<=120
    &&finite(p.toi)&&p.toi>0&&p.toi<=65
    &&Number.isInteger(p.p)&&p.p>=0&&p.p<=400;
  const before=(arr,value,inclusive)=>{
    let lo=0,hi=arr.length;
    while(lo<hi){let mid=Math.floor((lo+hi)/2);if(arr[mid]<value||(inclusive&&arr[mid]===value))lo=mid+1;else hi=mid;}
    return lo;
  };
  const percentile=(arr,val)=>{
    if(!arr.length)return null;
    const less=before(arr,val,false),leq=before(arr,val,true);
    return 100*(less+(leq-less)/2)/arr.length;
  };
  function calculate(players){
    rankings=new Map();
    const rows=(Array.isArray(players)?players:[]).filter(usable).map(p=>({...p,ppg:p.p/p.gp}));
    const pools={F:{},D:{}};
    for(const pos of ['F','D'])for(const [key] of COMPONENTS)
      pools[pos][key]=rows.filter(p=>group(p)===pos).map(p=>p[key]).sort((a,b)=>a-b);
    for(const p of rows){
      const pos=group(p);
      if(pools[pos].gp.length<MIN_PEERS)continue;
      const weights=WEIGHTS[pos];
      const parts=COMPONENTS.map(([key,label,digits])=>({
        key,label,digits,value:p[key],weight:weights[key],percentile:percentile(pools[pos][key],p[key])
      }));
      const raw=parts.reduce((sum,item)=>sum+item.percentile*item.weight,0)/100;
      // Season adaptation of the career-ranking weights. Avoid early 1-GP outliers.
      const reliability=p.gp/(p.gp+10);
      const score=Math.max(0,Math.min(100,Math.round(50+(raw-50)*reliability)));
      rankings.set(String(p.id),{
        score,raw,group:pos,gp:p.gp,toi:p.toi,ppg:p.ppg,reliability,
        sample:p.gp<10?'Very small season sample':p.gp<25?'Small season sample':'Established season sample',
        breakdown:parts
      });
    }
    return rankings;
  }
  const forPlayer=player=>player?rankings.get(String(player.id))??null:null;
  const score=player=>forPlayer(player)?.score??null;
  function panel(player){
    const result=forPlayer(player);
    const caveat='<p class="source-note">Statistical starting estimate using MoneyPuck season GP, average all-situations TOI, and points/game. Adapted from the separate NHL career-ranking formula; <strong>not an observed Eye Test</strong>, not a MoneyPuck rating, and not the existing five-on-five Advanced Stats Score. Season percentiles are not directly comparable to career ranks.</p>';
    if(!result)return '<section class="eye-base-panel"><h4>Formula Baseline: —</h4><p>Missing GP, points, ice time, or sufficient position peers; no estimate is invented.</p>'+caveat+'</section>';
    return '<section class="eye-base-panel"><h4>Formula Baseline: <strong>'+result.score+'/100</strong></h4>'
      +'<p>'+result.sample+'. Relative to '+(result.group==='D'?'defensemen':'forwards')+' from the selected season.</p>'
      +'<details><summary>See the formula from the NHL Player Ranking project</summary>'
      +'<table class="base-table"><thead><tr><th>Statistic</th><th>Value</th><th>Rank</th><th>Weight</th></tr></thead><tbody>'
      +result.breakdown.map(x=>'<tr><th>'+x.label+'</th><td>'+x.value.toFixed(x.digits)+'</td><td>'+Math.round(x.percentile)+'th percentile</td><td>'+x.weight+'%</td></tr>').join('')
      +'</tbody></table>'
      +'<p class="source-note">Weighted position-specific percentiles are adjusted toward 50 by GP/(GP+10) to reduce single-game extremes. The original career ranking requires 100 career games; that threshold is not applied to an individual season.</p>'
      +'</details>'+caveat+'</section>';
  }
  return {calculate,forPlayer,score,panel,WEIGHTS,COMPONENTS,group,MIN_PEERS};
})();
