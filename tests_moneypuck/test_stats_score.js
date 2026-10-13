'use strict';
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const moduleCode = fs.readFileSync(path.join(__dirname,'../stats-score.js'),'utf8');
const stats = vm.runInNewContext(moduleCode+'\nRinkStats;');

const make = (count,pos,gp) => Array.from({length:count},(_,i)=>({
  id:String((pos==='D'?2000000:1000000)+i),pos,gp,
  xgfPct:30+i,cfPct:32+i,ffPct:33+i,ixG60:0.05+i*0.03,hdCfPct:28+i
}));
const forwards=make(40,'C',60),defense=make(35,'D',60);
assert.equal(stats.METRICS.reduce((sum,m)=>sum+m.weight,0),100,'weights must sum to 100');
assert.equal(stats.minimumGames,10,'default before first dataset');
stats.calculate([...forwards,...defense]);
assert.equal(stats.minimumGames,10);
assert.ok(stats.score(forwards[39])>stats.score(forwards[0]),'higher values mean higher score');
assert.ok(stats.score(defense[34])>stats.score(defense[0]),'defensemen receive independent scores');
assert.ok(stats.score(forwards[39])>=50 && stats.score(forwards[39])<=100);
assert.ok(stats.score(defense[0])>=0 && stats.score(defense[0])<=50);
const defenseBefore=stats.score(defense[17]);
stats.calculate([...forwards.map(p=>({...p,xgfPct:99,cfPct:95,ffPct:90,ixG60:9,hdCfPct:94})),...defense]);
assert.equal(stats.score(defense[17]),defenseBefore,'a forward-only change cannot alter a defense percentile');

const partial=forwards.map(p=>({...p}));
partial[0].hdCfPct=null;
stats.calculate([...partial,...defense]);
assert.equal(typeof stats.score(partial[0]),'number','one optional metric can be missing');
assert.equal(stats.forPlayer(partial[0]).metricWeight,85,'missing HDCF% redistributes the other 85%');
partial[0].xgfPct=null;
stats.calculate([...partial,...defense]);
assert.equal(stats.score(partial[0]),null,'missing required xGF% must suppress the index');
partial[0].xgfPct=30;partial[0].ixG60=null;
stats.calculate([...partial,...defense]);
assert.equal(stats.score(partial[0]),null,'missing required individual xG must suppress the index');
const sparse=[...forwards.slice(0,15),...defense.slice(0,15)];
stats.calculate(sparse);
assert.equal(stats.score(sparse[0]),null,'fewer than 30 same-position peers must not receive scores');
const early=[...make(40,'C',4),...make(35,'D',4)];
stats.calculate(early);
assert.equal(stats.minimumGames,3,'game threshold adapts to early season');
const earlyTop=stats.score(early[39]);
const late=[...make(40,'C',70),...make(35,'D',70)];
stats.calculate(late);
const lateTop=stats.score(late[39]);
assert.ok(earlyTop>=50 && earlyTop<lateTop,'small samples are pulled toward neutral 50');
assert.equal(stats.score({...late[0],id:'player-with-no-data'}),null,'do not invent a player score');
assert.ok(!moduleCode.includes('community_eye_votes')&&!moduleCode.includes('RinkEye'),'statistics must remain independent of Eye Test votes');
console.log('Advanced Stats Score tests passed: weighting, peers, eligibility, missing data, shrinkage and separation.');
