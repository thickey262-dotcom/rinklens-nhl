'use strict';
/*
 * RinkLens source-aware NHL analytics.
 * Natural Stat Trick is included ONLY when an authenticated-by-operator,
 * manually obtained 5v5 regular-season export was imported. No scraping.
 * Arithmetic mean of comparable %, not a pooled shot/xG event calculation.
 */
const RinkSources=(()=>{
 const COMPARABLE=Object.freeze([
  {key:'xgfPct',label:'Expected goals share (xGF%)'},
  {key:'cfPct',label:'Corsi shot-attempt share (CF%)'},
  {key:'ffPct',label:'Fenwick unblocked share (FF%)'},
  {key:'hdCfPct',label:'High-danger shot share (HDCF%)'}
 ]);
 const valid=n=>typeof n==='number'&&Number.isFinite(n)&&n>=0&&n<=100;
 const norm=s=>String(s||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'')
   .toLowerCase().replace(/[^a-z0-9]+/g,' ').trim().replace(/\s+/g,' ');
 const group=p=>p?.pos==='D'?'D':['C','L','R','LW','RW'].includes(p?.pos)?'F':null;
 const team=p=>String(p?.team||'').trim().toUpperCase();
 const isWholeSeason=p=>['TOT','TOTAL','ALL','2TM','3TM','4TM'].includes(team(p));
 const samePlayer=(mp,ns)=>{
   if(!group(mp)||group(mp)!==group(ns))return false;
   // Only a stable verified NHL player ID, or a unique exact name, is acceptable.
   if(ns.id&&/^\d{6,10}$/.test(String(ns.id))&&String(ns.id)!==String(mp.id))return false;
   if(!ns.id&&norm(mp.name)!==norm(ns.name))return false;
   if(ns.id&&norm(ns.name)&&norm(mp.name)!==norm(ns.name))return false;
   if(!isWholeSeason(ns)&&team(ns)&&team(mp)&&team(ns)!==team(mp))return false;
   return true;
 };
 function blend(players,snapshot,season){
   const original=Array.isArray(players)?players:[];
   const result={players:original,matched:0,averaged:0,imported:false,reason:'No verified Natural Stat Trick export for the selected season.'};
   if(!snapshot)return result;
   if(snapshot.source!=='naturalstattrick'||snapshot.season!==season||
      snapshot.situation!=='5v5'||snapshot.seasonType!=='regular'||
      snapshot.adjustment!=='raw'||!Array.isArray(snapshot.players)){
     result.reason='Natural Stat Trick import metadata did not match the selected regular season and 5-on-5 context.';
     return result;
   }
   const rows=snapshot.players.filter(p=>p&&group(p)&&norm(p.name)&&COMPARABLE.some(m=>valid(p[m.key])));
   const byId=new Map(),byName=new Map();
   for(const p of rows){
     if(p.id&&/^\d{6,10}$/.test(String(p.id))){
       const key=String(p.id);byId.set(key,[...(byId.get(key)||[]),p]);
     }else{
       const key=norm(p.name)+'|'+group(p);byName.set(key,[...(byName.get(key)||[]),p]);
     }
   }
   let matched=0,averaged=0;
   const updated=original.map(p=>{
     // Duplicate matches (e.g. separate team stints or same names) must not be guessed/merged.
     const candidates=(byId.get(String(p.id))||byName.get(norm(p.name)+'|'+group(p))||[])
        .filter(row=>samePlayer(p,row));
     if(candidates.length!==1)return p;
     const nst=candidates[0],fields={};
     const next={...p};
     for(const m of COMPARABLE){
       const mp=valid(p[m.key])?p[m.key]:null;
       const ns=valid(nst[m.key])?nst[m.key]:null;
       if(ns===null)continue;
       const method=mp===null?'Natural Stat Trick only':'Two-source arithmetic mean';
       next[m.key]=mp===null?ns:Math.round(((mp+ns)/2)*100)/100;
       fields[m.key]={moneypuck:mp,nst:ns,result:next[m.key],method};
       if(mp!==null)averaged++;
     }
     if(!Object.keys(fields).length)return p;
     next.nstComparison=fields;
     matched++;
     return next;
   });
   return {players:updated,matched,averaged,imported:true,
     reason:matched?matched+' players matched; '+averaged+' matching metrics averaged equally across MoneyPuck and Natural Stat Trick.'
        :'NST export loaded, but no unique player and position matches were confirmed.'};
 }
 return {COMPARABLE,blend,samePlayer};
})();