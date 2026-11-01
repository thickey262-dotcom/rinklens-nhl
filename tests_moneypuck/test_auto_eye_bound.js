'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const statsSource=fs.readFileSync(path.join(root,'stats-score.js'),'utf8');
const baseSource=fs.readFileSync(path.join(root,'eye-base.js'),'utf8');
const eyeSource=fs.readFileSync(path.join(root,'eye.js'),'utf8');
const beforeInit=eyeSource.slice(0,eyeSource.indexOf('// The player table uses window.RinkEye'));
assert.ok(beforeInit.includes('function display(id)'),'eye source must have auto ranking display');
const state={season:'20262027',players:[],page:1,ready:true};
const cloud={user:null,client:null,initialize:async()=>true};
const nodes=new Map();
const document={getElementById(id){if(!nodes.has(id))nodes.set(id,{addEventListener(){},dataset:{},textContent:'',hidden:false});return nodes.get(id);},addEventListener(){}};
const build=new Function('state','get','RinkCloud','safe','render','renderCompare','document','window','console',
  statsSource+'\n'+baseSource+'\n'+beforeInit+'\nreturn {stats:RinkStats,base:RinkBase,eye:RinkEye};');
const {stats,base,eye}=build(state,id=>state.players.find(p=>p.id===id),cloud,String,()=>{},()=>{},document,{},console);
(async()=>{
  let total=0,provisional=0,official=0,clamped=0;
  for(const season of ['20242025','20252026','20262027']){
    const snap=JSON.parse(fs.readFileSync(path.join(root,'data','moneypuck-'+season+'.json'),'utf8'));
    state.season=season;
    state.players=snap.players;
    stats.calculate(state.players);
    base.calculate(state.players);
    await eye.reload(season);
    let seasonProvisional=0,seasonOfficial=0;
    for(const p of state.players){
      const anchor=stats.anchor(p),entry=eye.display(p.id);
      assert.ok(anchor,'a real provisional or qualified advanced reference is required for '+p.id+' '+season);
      assert.equal(entry.value!==null,true,'no invented absent Eye Test score for '+p.id);
      assert.equal(entry.advancedAnchor,anchor.score);
      assert.equal(entry.provisional,anchor.provisional);
      assert.equal(entry.anchored,true);
      assert.ok(Math.abs(entry.value-anchor.score)<=5,'outside +/-5 for '+p.name+' '+season);
      assert.ok(entry.value>=0&&entry.value<=100);
      assert.equal(entry.base,entry.value,'with no fan votes, auto rating equals the displayed starting value');
      assert.equal(entry.rawBase,base.score(p),'original position formula remains independently visible');
      if(entry.rawBase!==null&&Math.abs(entry.rawBase-anchor.score)>5){
        assert.notEqual(entry.rawBase,entry.value,'large differences are truly capped');
        clamped++;
      }
      if(anchor.provisional){
        assert.equal(stats.score(p),null,'provisional is not a qualified Advanced Stats Score');
        assert.equal(stats.provisional(p).score,anchor.score);
        seasonProvisional++;provisional++;
      }else{
        assert.equal(stats.score(p),anchor.score,'qualified score remains unmodified');
        seasonOfficial++;official++;
      }
      total++;
    }
    assert.equal(seasonOfficial+seasonProvisional,state.players.length);
    if(season==='20262027'){
      assert.equal(seasonOfficial,505,'current qualified Advanced Stats Score count');
      assert.equal(seasonProvisional,235,'current small-sample skaters use explicitly provisional reference');
      assert.equal(state.players.length,740);
    }
  }
  assert.ok(clamped>100,'five-point bound must materially affect the automatic ranking');
  const good=state.players.find(p=>stats.score(p)!==null&&base.score(p)!==null);
  assert.ok(good);
  const anchor=stats.anchor(good),realId=good.id;
  const grades={skating:10,puck:10,iq:10,defense:10,compete:10,transition:10,shooting:10,positioning:10};
  cloud.user={id:'first-fan',email:'person@example.com'};
  cloud.client={from(table){
    return {
      select(){return {eq:async()=>({data:table==='community_eye_votes'?[{player_id:realId,...grades}]:[],error:null})};}
    };
  }};
  await eye.reload(state.season);
  let e=eye.display(realId);
  assert.equal(e.personal,100,'human grade is preserved unmodified');
  assert.equal(e.isPrivate,true);
  assert.equal(e.humanWeight,.3);
  assert.ok(Math.abs(e.value-anchor.score)<=5,'private preview remains bounded');
  const vote={season_id:state.season,player_id:realId,reviewer_count:5,score:95,
    skating:9.5,puck:9.5,iq:9.5,defense:9.5,compete:9.5,transition:9.5,shooting:9.5,positioning:9.5};
  cloud.client={from(table){
    return {select(){return {eq:async()=>({data:table==='community_eye_scores'?[vote]:[{player_id:realId,...grades}],error:null})};}};
  }};
  await eye.reload(state.season);
  e=eye.display(realId);
  assert.equal(e.community,95,'public human score remains raw and independent');
  assert.equal(e.personal,100,'private human score is unchanged');
  assert.equal(e.humanWeight,.7,'5+ reviewer weighting preserved');
  assert.ok(Math.abs(e.value-anchor.score)<=5,'public blended auto ranking remains bounded');
  const panel=eye.panel(good);
  assert.match(panel,/statistical reference/);
  assert.match(panel,/Real fan grades are never modified/);
  assert.match(panel,/Community human-rating average/);
  console.log('PASS: '+total+' real skaters across 3 seasons, '+official+' qualified / '+provisional+' provisional, '+clamped+' bounded ranks; private/public human scores stay genuine.');
})().catch(e=>{console.error(e);process.exitCode=1;});
