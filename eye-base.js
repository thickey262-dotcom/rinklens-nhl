'use strict';
/* RinkLens: a statistical starting estimate adapted from the user's NHL Career Ranking weights.
 * This is season-level MoneyPuck skater data, not a subjective or career scout grade.
 * Forwards: GP 30%, average all-situations TOI 20%, points/game 40%, 5v5 +/- 10%.
 * Defensemen: GP 30%, average all-situations TOI 30%, points/game 30%, 5v5 +/- 10%.
 * Five-on-five +/- is on-ice GOALS FOR minus AGAINST (not official NHL +/-).
 * Fan-submitted scouting grades and the Advanced Stats Score are unaffected.
 */
const RinkBase = (() => {
  const WEIGHTS=Object.freeze({
    F:Object.freeze({gp:30,toi:20,ppg:40,fivePlusMinus:10}),
    D:Object.freeze({gp:30,toi:30,ppg:30,fivePlusMinus:10})
  });
  const COMPONENTS=Object.freeze([
    ['gp','Games played',0],['toi','Average ice time / game (minutes)',2],['ppg','Points per game',3],
    ['fivePlusMinus','5-on-5 +/- (goals for minus against)',0]
  ]);
  const MIN_PEERS=20;
  let rankings=new Map();
  const finite=n=>typeof n==='number'&&Number.isFinite(n);
  const group=p=>p?.pos==='D'?'D':['C','L','R','LW','RW'].includes(p?.pos)?'F':null;
  const usable=p=>group(p)&&Number.isInteger(p.gp)&&p.gp>=1&&p.gp<=120
    &&finite(p.toi)&&p.toi>0&&p.toi<=65
    &&Number.isInteger(p.p)&&p.p>=0&&p.p<=400;
  const validValue=(p,key)=>key==='fivePlusMinus'
    ? Number.isInteger(p.fivePlusMinus)&&p.fivePlusMinus>=-150&&p.fivePlusMinus<=150
    : finite(p[key]);
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
      pools[pos][key]=rows.filter(p=>group(p)===pos&&validValue(p,key)).map(p=>p[key]).sort((a,b)=>a-b);
    for(const p of rows){
      const pos=group(p);
      if(pools[pos].gp.length<MIN_PEERS)continue;
      const weights=WEIGHTS[pos];
      // Do not invent zero +/- or compare players to a tiny incomplete pool.
      // If the upstream field is absent, renormalize the three known inputs.
      const parts=COMPONENTS.filter(([key])=>validValue(p,key)&&
        (key!=='fivePlusMinus'||pools[pos][key].length>=MIN_PEERS))
        .map(([key,label,digits])=>({
          key,label,digits,value:p[key],weight:weights[key],percentile:percentile(pools[pos][key],p[key])
        }));
      const usedWeight=parts.reduce((sum,item)=>sum+item.weight,0);
      const raw=parts.reduce((sum,item)=>sum+item.percentile*item.weight,0)/usedWeight;
      // Season adaptation of the career-ranking weights. Avoid early 1-GP outliers.
      const reliability=p.gp/(p.gp+10);
      const score=Math.max(0,Math.min(100,Math.round(50+(raw-50)*reliability)));
      rankings.set(String(p.id),{
        score,raw,group:pos,gp:p.gp,toi:p.toi,ppg:p.ppg,
        fivePlusMinus:validValue(p,'fivePlusMinus')?p.fivePlusMinus:null,
        plusMinusIncluded:parts.some(x=>x.key==='fivePlusMinus'),usedWeight,reliability,
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
    const caveat='<p class="source-note">Statistical starting estimate using MoneyPuck season GP, average all-situations TOI, points/game, and <strong>5-on-5 goal differential</strong> (goals scored minus goals allowed while on the ice). This last number is a 5-on-5 +/- proxy, <strong>not official NHL +/-</strong>, and reflects teammates, goaltending and circumstances as well as the player. Not an observed Eye Test, an official MoneyPuck rating or the separate Advanced Stats Score.</p>';
    if(!result)return '<section class="eye-base-panel"><h4>Formula Baseline: —</h4><p>Missing GP, points, ice time, or sufficient position peers; no estimate is invented.</p>'+caveat+'</section>';
    return '<section class="eye-base-panel"><h4>Formula Baseline: <strong>'+result.score+'/100</strong></h4>'
      +'<p>'+result.sample+'. Relative to '+(result.group==='D'?'defensemen':'forwards')+' from the selected season.</p>'
      +(result.plusMinusIncluded?'':'<p class="source-note">5-on-5 +/- unavailable for this player or season. Other weights were rescaled; no missing +/- was treated as zero.</p>')
      +'<details><summary>See the formula from the NHL Player Ranking project</summary>'
      +'<table class="base-table"><thead><tr><th>Statistic</th><th>Value</th><th>Rank</th><th>Weight</th></tr></thead><tbody>'
      +result.breakdown.map(x=>'<tr><th>'+x.label+'</th><td>'+x.value.toFixed(x.digits)+'</td><td>'+Math.round(x.percentile)+'th percentile</td><td>'+x.weight+'%</td></tr>').join('')
      +'</tbody></table>'
      +'<p class="source-note">Weighted position-specific percentiles are adjusted toward 50 by GP/(GP+10) to reduce single-game extremes. The 10% 5-on-5 +/- component is only used when a reliable pool of same-position players exists. The original career ranking requires 100 career games; that threshold is not applied to an individual season.</p>'
      +'</details>'+caveat+'</section>';
  }
  return {calculate,forPlayer,score,panel,WEIGHTS,COMPONENTS,group,MIN_PEERS};
})();
