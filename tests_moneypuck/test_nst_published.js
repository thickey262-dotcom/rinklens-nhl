'use strict';
/* Regression against the uploaded 2026-27 Natural Stat Trick skater export.
 * Never invent NST values for a missing player or a different season.
 */
const fs=require('node:fs'), path=require('node:path'), vm=require('node:vm');
const assert=require('node:assert/strict');
const root=path.join(__dirname,'..');
const ns=JSON.parse(fs.readFileSync(path.join(root,'data/nst-20262027.json'),'utf8'));
const mp=JSON.parse(fs.readFileSync(path.join(root,'data/moneypuck-20262027.json'),'utf8'));
const source=fs.readFileSync(path.join(root,'source-average.js'),'utf8');
const S=vm.runInNewContext(source+'\nRinkSources;');
assert.equal(ns.season,'20262027');
assert.equal(ns.source,'naturalstattrick');
assert.equal(ns.situation,'5v5');
assert.equal(ns.seasonType,'regular');
assert.equal(ns.adjustment,'raw');
assert.equal(ns.players.length,740,'the uploaded export includes exactly 740 skater rows');
assert.equal(new Set(ns.players.map(p=>p.id)).size,740,'every NST skater is reconciled to a unique NHL player ID');
assert.ok(ns.players.every(p=>/^\d{7}$/.test(p.id)),'IDs must be seven-digit NHL player identifiers');
assert.ok(ns.players.every(p=>['C','L','R','D','LW','RW'].includes(p.pos)),'no goalies');
// Test data mapping against the source's own as-of timestamp; production separately checks freshness.
const result=S.blend(mp.players,ns,'20262027',ns.updatedAt);
assert.equal(result.imported,true);
assert.ok(result.matched>=400,'a useful number of skaters must be matched to this season');
assert.ok(result.averaged>=1000,'both sources must contribute genuine metric pairs');
const playerId='8478402'; // Connor McDavid, crosschecked against the MoneyPuck file
const old=mp.players.find(p=>p.id===playerId);
const next=result.players.find(p=>p.id===playerId);
const imported=ns.players.find(p=>p.id===playerId);
assert.ok(old&&next&&imported&&next.nstComparison);
const average=(a,b)=>Math.round(((a+b)/2)*100)/100;
for(const key of ['xgfPct','cfPct','ffPct','hdCfPct']){
  assert.equal(next[key],average(old[key],imported[key]));
  assert.equal(next.nstComparison[key].moneypuck,old[key]);
  assert.equal(next.nstComparison[key].nst,imported[key]);
  assert.equal(next.nstComparison[key].method,'Two-source arithmetic mean');
}
for(const key of ['gp','g','a','p','fiveGp','fiveToiMinutes','toi','ixG60'])
  assert.equal(next[key],old[key],key+' must stay MoneyPuck-only');
const pettersson=ns.players.filter(p=>p.name==='Elias Pettersson');
assert.equal(pettersson.length,2);
assert.notEqual(pettersson[0].id,pettersson[1].id);
for(const p of pettersson)assert.ok(result.players.find(q=>q.id===p.id)?.nstComparison);
const stale=S.blend(mp.players,ns,'20262027','2026-11-06T00:00:00Z');
assert.equal(stale.imported,false);
assert.equal(stale.matched,0);
assert.match(stale.reason,/48 hours/);
const noExport=S.blend(mp.players,null,'20262027');
assert.equal(noExport.matched,0);
assert.equal(noExport.players,mp.players,'missing NST export must not alter original MoneyPuck players');
const wrongSeason=S.blend(mp.players,ns,'20252026');
assert.equal(wrongSeason.imported,false,'2026-27 must not leak into another season');
console.log('PASS: actual NST import '+ns.players.length+' skaters, '+result.matched+' matched, '+result.averaged+' source-paired metrics, player ID disambiguation, and no mismatched seasons.');
