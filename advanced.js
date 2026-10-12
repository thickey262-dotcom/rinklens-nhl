'use strict';
/* RinkLens player-level advanced statistics. Data is from the explicitly published
   MoneyPuck season skaters download, not derived from NHL summary stats. */
const RinkAdvanced = (() => {
  const FIELDS = [
    {key:'xgfPct', name:'xGF%', full:'On-ice expected-goal share', lesson:'xgf', digits:1, suffix:'%', hint:'Share of 5v5 expected goals for the team while this skater is on the ice. Teammates and deployment matter.'},
    {key:'cfPct', name:'CF%', full:'Corsi / shot-attempt share', lesson:'corsi', digits:1, suffix:'%', hint:'Share of 5v5 shot attempts when on ice. NOT measured puck-possession time.'},
    {key:'ffPct', name:'FF%', full:'Fenwick / unblocked shot-attempt share', lesson:'fenwick', digits:1, suffix:'%', hint:'Share of 5v5 attempts that reached the net or missed it, excluding blocked attempts.'},
    {key:'ixG60', name:'ixG/60', full:'Individual expected goals per 60', lesson:'xg', digits:2, suffix:'', hint:'The player’s own 5v5 shot-quality value per 60 minutes of their ice time.'},
    {key:'hdCfPct', name:'HDCF%', full:'On-ice high-danger chance share', lesson:'hdcf', digits:1, suffix:'%', hint:'Share of high-danger shots for vs against at 5v5 using the data provider’s chance definition.'}
  ];
  let meta = null, status = 'pending', requestId = 0;
  const good = value => typeof value === 'number' && Number.isFinite(value);
  const valid = (v,min,max) => good(v) && v >= min && v <= max;
  const fmt = (p,key) => {
    const field=FIELDS.find(f=>f.key===key);
    if(!field)return '—';
    const v=read(p,key);
    return valid(v,0,field.suffix==='%'?100:1000)?v.toFixed(field.digits)+field.suffix:'—';
  };
  const read=(p,key) => {
    if(p.advanced && Object.prototype.hasOwnProperty.call(p.advanced,key))return p.advanced[key];
    if(S.source==='moneypuck'){
      const legacy={xgfPct:p.xgp,cfPct:p.cfp,ixG60:p.xg60};
      return good(legacy[key])?legacy[key]:null;
    }
    return null;
  };
  const has=p=>FIELDS.some(f=>good(read(p,f.key)));
  function profile(p){
    const available=has(p),sample=p.advanced?.gp||p.gp||0;
    const asof=meta?.updatedAt?` · Updated ${new Date(meta.updatedAt).toLocaleDateString()}`:'';
    const cards=FIELDS.map(f=>{
      const value=fmt(p,f.key);
      return `<button type="button" class="adv-player-metric" data-stat-help="${f.lesson}" title="Learn ${f.full}"><span class="adv-metric-label">${f.name} <span aria-hidden="true">ⓘ</span></span><strong>${value}</strong><span class="adv-metric-sub">${f.full}</span></button>`;
    }).join('');
    return `<section class="adv-player-section" aria-label="Advanced statistics for ${esc(p.name)}"><div class="adv-heading"><div><span class="eyebrow muted">WHAT THE NUMBERS SAY · 5-ON-5</span><h3>Advanced stats <small>tap any metric to learn it ↗</small></h3></div><span class="adv-tag">${S.source==='demo'?'DEMO':available?'REAL DATA':'NOT AVAILABLE'}</span></div><div class="adv-player-grid">${cards}</div><p class="adv-player-foot">${S.source==='demo'?'These examples are fictional.':available?'5v5 season skater data from <a href="https://moneypuck.com/data.htm" target="_blank" rel="noopener noreferrer">MoneyPuck.com ↗</a> (non-commercial use; attribution required).'+asof+ (sample<15?' <strong>Small sample:</strong> be careful with early-season percentages.':''):'Advanced 5v5 numbers are not in the NHL summary feed. They appear when a matching MoneyPuck season snapshot is refreshed or its CSV is imported. Missing values are never estimated.'} On-ice shares describe five skaters together, not an individual player’s isolated impact.</p></section>`;
  }
  async function load(season){
    const request=++requestId;
    meta=null; status='loading';
    if(S.source!=='nhl')return;
    try{
      const res=await fetch(`data/advanced-${season}.json?v=${Math.floor(Date.now()/3600000)}`,{cache:'no-store'});
      if(!res.ok)throw Error('Snapshot not yet generated');
      const data=await res.json();
      if(data.source!=='moneypuck'||data.season!==season||!Array.isArray(data.players))throw Error('Invalid snapshot');
      if(request!==requestId||S.season!==season||S.source!=='nhl')return;
      const byId=new Map(data.players.map(p=>[String(p.id),p]));
      let found=0;
      for(const p of S.players){
        const adv=byId.get(String(p.id));
        p.advanced=adv?{
          gp:Number(adv.gp)||null,
          xgfPct:valid(adv.xgfPct,0,100)?adv.xgfPct:null,
          cfPct:valid(adv.cfPct,0,100)?adv.cfPct:null,
          ffPct:valid(adv.ffPct,0,100)?adv.ffPct:null,
          ixG60:valid(adv.ixG60,0,100)?adv.ixG60:null,
          hdCfPct:valid(adv.hdCfPct,0,100)?adv.hdCfPct:null
        }:null;
        if(has(p))found++;
      }
      meta={updatedAt:data.updatedAt,matched:found};status='ready';
      RinkAuto.invalidate();
      renderTable();renderCompare();
      if(S.active && !$('#playerModal').hidden){
        const player=playerFor(S.active);
        const target=$('.report-card');
        if(player&&target)target.outerHTML=RinkReports.profile(player);
      }
    }catch(e){
      if(request!==requestId)return;
      status='unavailable';
      console.info('Player-level advanced snapshot unavailable:',e.message);
    }
  }
  function showLesson(id){
    navigate('learn');
    const card=document.querySelector(`#view-learn [data-learn-stat="${id}"]`);
    if(card)card.click();
    document.querySelector('#view-learn .learn-detail')?.scrollIntoView({behavior:'smooth',block:'start'});
  }
  document.addEventListener('click',event=>{
    const el=event.target.closest('[data-stat-help]');
    if(!el)return;
    event.preventDefault();
    if(!$('#playerModal').hidden)closePlayer();
    showLesson(el.dataset.statHelp);
  });
  return {load, profile, fmt, has, read, fields:FIELDS};
})();
