'use strict';
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const moduleCode=fs.readFileSync(path.join(__dirname,'../stats-score.js'),'utf8');
const stats=vm.runInNewContext(moduleCode+'\nRinkStats;');

const make=(count,pos,gp,minutes=gp*12)=>Array.from({length:count},(_,i)=>({
  id:String((pos==='D'?2000000:1000000)+i),pos,gp,fiveGp:gp,
  fiveToiMinutes:minutes,toi:20,
  xgfPct:30+i,cfPct:32+i,ffPct:33+i,ixG60:0.05+i*.03,hdCfPct:28+i
}));
const forwards=make(40,'C',60);
const defense=make(35,'D',60);
for(const kind of ['F','D']){
  assert.equal(Object.values(stats.WEIGHTS[kind]).reduce((sum,v)=>sum+v,0),100);
}
assert.notEqual(stats.WEIGHTS.F.ixG60,stats.WEIGHTS.D.ixG60);
assert.equal(stats.minimumGames,10);
assert.equal(stats.minimumMinutes,100);
stats.calculate([...forwards,...defense]);
assert.equal(stats.minimumGames,10);
assert.equal(stats.minimumMinutes,100);
assert.ok(stats.score(forwards[39])>stats.score(forwards[0]));
assert.ok(stats.score(defense[34])>stats.score(defense[0]));
assert.ok(stats.score(forwards[39])>=50&&stats.score(forwards[39])<=100);
assert.ok(stats.score(defense[0])>=0&&stats.score(defense[0])<=50);
const defenseBefore=stats.score(defense[17]);
stats.calculate([...forwards.map(p=>({...p,xgfPct:99,cfPct:95,ffPct:90,ixG60:9,hdCfPct:94})),...defense]);
assert.equal(stats.score(defense[17]),defenseBefore,'forward changes must not affect D peer percentiles');
const partial=forwards.map(p=>({...p}));
partial[0].hdCfPct=null;
stats.calculate([...partial,...defense]);
assert.equal(typeof stats.score(partial[0]),'number');
assert.equal(stats.forPlayer(partial[0]).metricWeight,85,'forward HDCF weight is 15');
partial[0].xgfPct=null;
stats.calculate([...partial,...defense]);
assert.equal(stats.score(partial[0]),null,'xGF share required');
partial[0].xgfPct=30;partial[0].ixG60=null;
stats.calculate([...partial,...defense]);
assert.equal(stats.score(partial[0]),null,'individual xG required');
partial[0].ixG60=.05;partial[0].ffPct=null;
stats.calculate([...partial,...defense]);
assert.equal(stats.score(partial[0]),null,'require at least 4 metrics');
stats.calculate([...forwards,...defense]);
assert.equal(stats.score({...forwards[0],id:'unknown'}),null);
assert.equal(stats.reason({...forwards[0],id:'unknown'}),null);

const restricted=forwards.map(p=>({...p}));
restricted[0].fiveToiMinutes=99.999;
stats.calculate([...restricted,...defense]);
assert.equal(stats.score(restricted[0]),null,'player just below 100 5v5 minutes not scored');
assert.match(stats.reason(restricted[0]),/100/);
restricted[0].fiveToiMinutes=100;
stats.calculate([...restricted,...defense]);
assert.notEqual(stats.score(restricted[0]),null,'100 5v5 minutes allowed');
restricted[0].fiveToiMinutes=null;
restricted[0].toi=999999;
stats.calculate([...restricted,...defense]);
assert.equal(stats.score(restricted[0]),null,'all-situations TOI must not replace 5v5 TOI');
assert.match(stats.reason(restricted[0]),/missing/);
restricted[0].fiveToiMinutes=180;restricted[0].fiveGp=9;
stats.calculate([...restricted,...defense]);
assert.equal(stats.score(restricted[0]),null,'9 5v5 GP is insufficient despite more ice time');
restricted[0].fiveGp=null;
stats.calculate([...restricted,...defense]);
assert.equal(stats.score(restricted[0]),null,'missing 5v5 GP must not fall back to all-situations GP');

const few=[...forwards.slice(0,15),...defense.slice(0,15)];
stats.calculate(few);
assert.equal(stats.score(few[0]),null,'require 30 peers in a position group');
const early=make(40,'C',4,45).concat(make(35,'D',4,45));
stats.calculate(early);
assert.equal(stats.minimumGames,3);
assert.equal(stats.minimumMinutes,30);
const earlyTop=stats.score(early[39]);
assert.ok(earlyTop>=50);
const edge=early.map(p=>({...p}));
edge[0].fiveToiMinutes=29.999;
stats.calculate(edge);
assert.equal(stats.score(edge[0]),null,'below 30 early 5v5 minutes ineligible');
edge[0].fiveToiMinutes=30;
stats.calculate(edge);
assert.notEqual(stats.score(edge[0]),null);
const seasonEdge=early.map(p=>({...p}));
seasonEdge[0].gp=15;
stats.calculate(seasonEdge);
assert.equal(stats.minimumGames,10,'top GP reaches 15: established threshold');
assert.equal(stats.minimumMinutes,100);
const late=make(40,'C',70,840).concat(make(35,'D',70,840));
stats.calculate(late);
assert.ok(earlyTop<stats.score(late[39]),'tiny sample must shrink toward neutral');
assert.equal(stats.label(late[39]),'Larger sample');
const medium=make(40,'C',30,480).concat(make(35,'D',30,480));
stats.calculate(medium);
assert.equal(stats.label(medium[39]),'Moderate sample');
const small=make(40,'C',12,140).concat(make(35,'D',12,140));
stats.calculate(small);
assert.equal(stats.label(small[39]),'Small sample');
assert.ok(stats.forPlayer(small[39]).effectiveGames<=12);
assert.equal(stats.forPlayer(small[39]).score,stats.score(small[39]));
stats.calculate([...forwards,...defense]);
const specialF=make(40,'C',65,780);
const specialD=make(40,'D',65,780);
for(const arr of [specialF,specialD]){
  for(const player of arr){
    player.xgfPct=50;player.ixG60=0.5;player.cfPct=50;player.ffPct=50;player.hdCfPct=50;
  }
  arr[0].ixG60=1.5;
}
stats.calculate([...specialF,...specialD]);
assert.ok(stats.score(specialF[0])>stats.score(specialD[0]),
  'forwards place more weight on a high individual xG metric than defensemen');
assert.ok(!moduleCode.includes('community_eye_votes')&&!moduleCode.includes('RinkEye'),
  'Advanced Stats Score cannot mix in Eye Test votes or grades');
console.log('PASS: position weights, 5v5 minutes/games, sample labels, missing inputs, percentile groups, shrinkage and Eye Test separation.');
