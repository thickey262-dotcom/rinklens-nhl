'use strict';
/* Five EXTRA model perspectives for the top 100 qualified skaters per season.
 * Not five observers, not verified scouts, and never community ballots.
 * Uses the same verified 5v5 position-relative percentiles as RinkStats.
 */
const RinkLenses=(()=>{
 const TOP=100;
 const CONFIG=Object.freeze([
  {key:'expected',name:'Expected goals',weights:{xgfPct:55,ixG60:10,cfPct:5,ffPct:5,hdCfPct:15,fiveToiMinutes:10}},
  {key:'creation',name:'Chance creation',weights:{xgfPct:15,ixG60:45,cfPct:5,ffPct:5,hdCfPct:20,fiveToiMinutes:10}},
  {key:'possession',name:'Puck possession',weights:{xgfPct:20,ixG60:5,cfPct:35,ffPct:25,hdCfPct:5,fiveToiMinutes:10}},
  {key:'danger',name:'High-danger play',weights:{xgfPct:20,ixG60:10,cfPct:5,ffPct:10,hdCfPct:45,fiveToiMinutes:10}},
  {key:'usage',name:'Ice time and impact',weights:{xgfPct:20,ixG60:15,cfPct:5,ffPct:5,hdCfPct:15,fiveToiMinutes:40}}
 ]);
 let byId=new Map();
 const clamp=(value,reference)=>Math.max(0,Math.min(100,
   Math.max(reference-5,Math.min(reference+5,value))));
 function calculate(players){
   byId=new Map();
   if(!Array.isArray(players)||typeof RinkStats==='undefined')return byId;
   const leaders=players.filter(p=>RinkStats.score(p)!==null)
     .sort((a,b)=>RinkStats.score(b)-RinkStats.score(a)||String(a.id).localeCompare(String(b.id)))
     .slice(0,TOP);
   leaders.forEach((p,index)=>{
     const advanced=RinkStats.forPlayer(p);
     if(!advanced||!Array.isArray(advanced.breakdown))return;
     const pieces=CONFIG.map(model=>{
       const weights=advanced.breakdown.filter(m=>Number.isFinite(m.percentile)&&model.weights[m.key]>0);
       const total=weights.reduce((sum,m)=>sum+model.weights[m.key],0);
       if(total<=0)return null;
       const mean=weights.reduce((sum,m)=>sum+m.percentile*model.weights[m.key],0)/total;
       const shrunk=Math.round(50+(mean-50)*advanced.reliability);
       return Object.freeze({key:model.key,name:model.name,score:clamp(shrunk,advanced.score)});
     });
     if(pieces.every(Boolean)){
       byId.set(String(p.id),Object.freeze({
         rank:index+1,reference:advanced.score,
         components:Object.freeze(pieces),
         source:'five statistical perspectives (not people)'
       }));
     }
   });
   return byId;
 }
 const forPlayer=p=>p?byId.get(String(p.id))??null:null;
 const included=p=>forPlayer(p)!==null;
 const total=()=>byId.size;
 return {TOP,CONFIG,calculate,forPlayer,included,total,clamp};
})();
