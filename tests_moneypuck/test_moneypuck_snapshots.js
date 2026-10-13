'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const ROOT=path.join(__dirname,'..');
const moduleText=fs.readFileSync(path.join(ROOT,'stats-score.js'),'utf8');
const stats=vm.runInNewContext(moduleText+'\nRinkStats;');
for(const season of ['20242025','20252026','20262027']){
  const file=path.join(ROOT,'data','moneypuck-'+season+'.json');
  assert.ok(fs.existsSync(file),'missing MoneyPuck snapshot '+season);
  const snapshot=JSON.parse(fs.readFileSync(file,'utf8'));
  assert.equal(snapshot.source,'moneypuck');
  assert.equal(snapshot.season,season);
  assert.ok(snapshot.players.length>100);
  const withTime=snapshot.players.filter(p=>p.fiveToiMinutes!==null);
  assert.ok(withTime.length>100,season+' lacks five-on-five exposure; source refresh failed or cached schema outdated');
  assert.ok(withTime.every(p=>typeof p.fiveToiMinutes==='number'&&Number.isFinite(p.fiveToiMinutes)&&p.fiveToiMinutes>0),season+' invalid five-on-five minutes');
  assert.ok(withTime.every(p=>typeof p.fiveGp==='number'&&p.fiveGp>0),season+' 5v5 GP required');
  stats.calculate(snapshot.players);
  const forScored=snapshot.players.filter(p=>p.pos!=='D'&&stats.score(p)!==null);
  const defScored=snapshot.players.filter(p=>p.pos==='D'&&stats.score(p)!==null);
  assert.ok(forScored.length>=30,season+' too few qualified forwards');
  assert.ok(defScored.length>=30,season+' too few qualified defensemen');
  assert.ok(forScored.concat(defScored).every(p=>p.fiveGp>=stats.minimumGames&&p.fiveToiMinutes>=stats.minimumMinutes),season+' scored under minimum exposure');
  assert.ok(forScored.concat(defScored).every(p=>['Small sample','Moderate sample','Larger sample'].includes(stats.label(p))),season+' missing sample labels');
  console.log(season+': '+forScored.length+' qualifying forwards, '+defScored.length+' defensemen; '+withTime.length+' players with 5v5 ice time');
}
