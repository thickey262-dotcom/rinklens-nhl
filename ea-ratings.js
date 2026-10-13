'use strict';
/* Public NHL 27 game ratings, NEVER human film grades or private scouting.
   Only uniquely matched official EA player entries are shown. */
const RinkEA=(()=>{
 let players=new Map(),updatedAt=null,available=false,loadError=null;
 function normalize(v){
   return String(v||'').normalize('NFKD').toLowerCase().replace(/[ø]/g,'o').replace(/[đ]/g,'d')
     .replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/g,'');
 }
 function ingest(snapshot){
   const records=Array.isArray(snapshot?.players)?snapshot.players:[];
   if(snapshot?.game!=='NHL 27'||snapshot?.sourceUrl!=='https://www.ea.com/games/nhl/ratings'||records.length<1) return false;
   const next=new Map(),ambiguous=new Set();
   for(const row of records){
     if(!row||typeof row.name!=='string'||typeof row.pos!=='string'||!Number.isInteger(row.ovr)||row.ovr<40||row.ovr>99)continue;
     const key=normalize(row.name);
     if(!key)continue;
     if(next.has(key)){ambiguous.add(key);continue}
     next.set(key,{name:row.name,pos:row.pos,ovr:row.ovr,rank:row.rank,
       acl:row.acl,spd:row.spd,dek:row.dek,pas:row.pas,slp:row.slp,wsp:row.wsp});
   }
   for(const key of ambiguous)next.delete(key);
   if(!next.size)return false;
   players=next;available=true;updatedAt=snapshot.updatedAt||null;loadError=null;return true;
 }
 function forPlayer(p,season){
   // Game NHL 27 must never be quietly applied to a past NHL statistical season.
   if(!p||season!=='20262027'||String(p.id).startsWith('demo-'))return null;
   const found=players.get(normalize(p.name));
   if(!found)return null;
   const defense=String(p.pos)==='D';
   if((found.pos==='D')!==defense || found.pos==='G')return null;
   return found;
 }
 const score=(p,season)=>forPlayer(p,season)?.ovr??null;
 const status=()=>({loaded:available,count:players.size,updatedAt,loadError});
 async function load(){
   try{
     const res=await fetch('data/ea-nhl27.json',{cache:'no-store'});
     if(!res.ok)throw new Error('No EA NHL 27 ratings snapshot available');
     const data=await res.json();
     if(!ingest(data))throw new Error('Invalid EA NHL 27 ratings data');
     return true;
   }catch(e){loadError=String(e?.message||e);return false}
 }
 function panel(p,season){
   const x=forPlayer(p,season);
   const url='https://www.ea.com/games/nhl/ratings';
   if(!x)return '<div class="ea-rating-panel ea-unavailable"><strong>EA NHL 27–based eye-test proxy</strong><p>No verified EA NHL 27 rating for this player'+(season!=='20262027'?' in this historical season':' in EA’s published top-player list')+'. This is not a human film grade.</p><a href="'+url+'" target="_blank" rel="noopener noreferrer">Official EA ratings ↗</a></div>';
   const fields=[['Acceleration',x.acl],['Speed',x.spd],['Deking',x.dek],['Passing',x.pas],['Slapshot power',x.slp],['Wristshot power',x.wsp]].filter(([,v])=>Number.isInteger(v));
   return '<section class="ea-rating-panel"><div><span class="ea-eyebrow">EA SPORTS NHL 27 · VIDEO GAME RATING</span><strong class="ea-rating-figure">'+x.ovr+' <small>/99 OVR</small></strong><p>EA-based eye-test proxy. This is EA’s game rating, not an independent film evaluation or a replacement for your private six-trait scouting report.</p></div>'+
    '<div class="ea-attributes">'+fields.map(([name,v])=>'<div><span>'+name+'</span><b>'+v+'</b></div>').join('')+'</div>'+
    '<p class="ea-source">Source: <a href="'+url+'" target="_blank" rel="noopener noreferrer">EA SPORTS NHL 27 player ratings ↗</a>. Ratings may change with EA roster updates. Player matched by unique normalized name and skater position.</p></section>';
 }
 return {normalize,ingest,forPlayer,score,load,status,panel};
})();
