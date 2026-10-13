'use strict';
const $ = id => document.getElementById(id);
const state = {players:[],season:'20262027',selected:[],token:0,ready:false};
const safe = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const missing = value => typeof value !== 'number' || !Number.isFinite(value);
const show = (value,digits=0) => missing(value) ? '—' : Number(value).toFixed(digits);
const fields=[['gp','Games played',0],['g','Goals',0],['a','Assists',0],['p','Points',0],['p60','Points per 60 · all situations',2],['xgfPct','Expected goals share · 5-on-5',1],['cfPct','Corsi share · 5-on-5',1],['ffPct','Fenwick share · 5-on-5',1],['ixG60','Individual expected goals per 60 · 5-on-5',2],['hdCfPct','High-danger shot share · 5-on-5',1]];
const label = p => p.name + ' (' + p.team + ', ' + p.pos + ')';
const get = id => state.players.find(p=>p.id===id);
function status(message,isError=false){$('status').textContent=message;$('status').classList.toggle('error',isError)}
function position(p){return p.pos==='D'?'D':'F'}
async function load(){
 const season=$('season').value,token=++state.token;
 state.season=season;state.selected=[];state.players=[];state.ready=false;
 RinkStats.calculate([]);
 $('rows').innerHTML='';$('playerCount').textContent='—';$('updated').textContent='—';$('seasonSummary').textContent=season.slice(0,4)+'–'+season.slice(6);
 status('Loading MoneyPuck data for '+$('season').selectedOptions[0].text+'…');renderCompare();
 if(window.RinkEye) void RinkEye.reload(season);
 try{
  const response=await fetch('data/moneypuck-'+season+'.json',{cache:'no-store'});
  if(!response.ok)throw Error('Season data not published yet');
  const data=await response.json();
  if(token!==state.token)return;
  if(data.source!=='moneypuck'||data.season!==season||!Array.isArray(data.players)||!data.players.length)throw Error('Invalid MoneyPuck snapshot');
  state.players=data.players.filter(p=>typeof p.name==='string'&&typeof p.id==='string'&&p.gp>0);
  RinkStats.calculate(state.players);
  state.ready=true;
  $('playerCount').textContent=state.players.length.toLocaleString();
  $('updated').textContent=data.updatedAt?new Date(data.updatedAt).toLocaleDateString():'Not recorded';
  const teams=[...new Set(state.players.map(p=>p.team))].sort();
  $('team').innerHTML='<option value="">All teams</option>'+teams.map(t=>'<option value="'+safe(t)+'">'+safe(t)+'</option>').join('');
  status('Player statistics: MoneyPuck · Regular season · Goals, assists and points: all situations · Advanced metrics: 5-on-5. RinkLens Advanced Stats Score: computed from MoneyPuck metrics. Eye Test: separate viewer ratings.');
  render();
  if(window.RinkEye) void RinkEye.reload(season);
 }catch(err){if(token!==state.token)return;status('MoneyPuck statistics are currently unavailable for this season. No substitute or estimated data is shown. '+err.message,true);$('rows').innerHTML='<tr><td colspan="12">No verified MoneyPuck data available.</td></tr>';$('results').textContent='0 players';}
}
function filtered(){
 const q=$('search').value.trim().toLowerCase(),t=$('team').value,pos=$('position').value,sort=$('sort').value;
 const sortValue = p => sort==='eye'?(window.RinkEye?.score(p.id)??null):sort==='advanced'?RinkStats.score(p):p[sort];
 return state.players.filter(p=>(!q||p.name.toLowerCase().includes(q)||p.team.toLowerCase().includes(q))&&(!t||p.team===t)&&(!pos||position(p)===pos)).sort((a,b)=>sort==='name'?a.name.localeCompare(b.name):(missing(sortValue(a))?(missing(sortValue(b))?0:1):missing(sortValue(b))?-1:sortValue(b)-sortValue(a))||a.name.localeCompare(b.name));
}
function render(){
 const rows=filtered();$('results').textContent=rows.length+' players';
 $('rows').innerHTML=rows.length?rows.map(p=>'<tr><td><button type="button" class="player-name" data-open="'+safe(p.id)+'">'+safe(p.name)+'</button><small>'+safe(p.team)+' · '+safe(p.pos)+'</small></td>'+[['gp',0],['g',0],['a',0],['p',0],['p60',2],['xgfPct',1],['cfPct',1],['ixG60',2]].map(([k,d])=>'<td>'+show(p[k],d)+'</td>').join('')+'<td class="advanced-score-cell" title="'+safe(RinkStats.label(p)??RinkStats.reason(p)??'Score unavailable')+'">'+(RinkStats.score(p)??'—')+(RinkStats.label(p)?'<small class="sample-label '+(RinkStats.label(p)==='Small sample'?'is-small':'')+'">'+safe(RinkStats.label(p))+'</small>':'')+'</td><td class="eye-table">'+(window.RinkEye?.score(p.id)??'—')+'</td><td><button type="button" class="mini" data-compare="'+safe(p.id)+'" aria-label="Compare '+safe(p.name)+'">'+(state.selected.includes(p.id)?'✓ Added':'+ Add')+'</button></td></tr>').join(''):'<tr><td colspan="12">No matching players found.</td></tr>';
}
function renderCompare(){
 if(!state.selected.length){$('comparison').textContent='Select up to two players from the table above.';return}
 const p=state.selected.map(get).filter(Boolean);
 $('comparison').innerHTML='<div class="comparison-head">'+p.map(x=>'<div><strong>'+safe(x.name)+'</strong><small>'+safe(x.team)+' · '+safe(x.pos)+'</small><button type="button" class="mini" data-remove="'+safe(x.id)+'">Remove</button></div>').join('')+'</div><div class="table-wrap"><table><thead><tr><th>Statistic</th>'+p.map(x=>'<th>'+safe(x.name)+'</th>').join('')+'</tr></thead><tbody>'+fields.map(([k,name,d])=>'<tr><th>'+name+'</th>'+p.map(x=>'<td>'+show(x[k],d)+'</td>').join('')+'</tr>').join('')+'<tr><th>Advanced Stats Score · MoneyPuck-based /100</th>'+p.map(x=>'<td>'+String(RinkStats.score(x)??'—')+(RinkStats.label(x)?'<small>'+safe(RinkStats.label(x))+'</small>':'')+'</td>').join('')+'</tr>'+'<tr><th>Eye Test · community viewer rating /100</th>'+p.map(x=>'<td>'+String(window.RinkEye?.score(x.id)??'—')+'</td>').join('')+'</tr>'+'</tbody></table></div>';
}
function detail(id){
 const p=get(id);if(!p)return;
 $('detail').innerHTML='<div class="eyebrow">MONEYPUCK PLAYER STATISTICS</div><h2 id="dialogTitle">'+safe(p.name)+'</h2><p>'+safe(p.team)+' · '+safe(p.pos)+' · '+state.season.slice(0,4)+'–'+state.season.slice(6)+'</p><div class="detail-grid">'+fields.map(([k,name,d])=>'<div><span>'+name+'</span><strong>'+show(p[k],d)+'</strong></div>').join('')+'</div>'+RinkStats.panel(p)+'<p class="source-note">MoneyPuck regular-season skater data. Counting totals are all situations; xGF%, CF%, FF%, ixG/60 and HDCF% are 5-on-5. These statistics are not scouting opinions.</p><a href="https://moneypuck.com/data.htm" target="_blank" rel="noopener noreferrer">View MoneyPuck source ↗</a>'+(window.RinkEye?RinkEye.panel(p):'');
 $('modal').hidden=false;$('close').focus();
}
function close(){$('modal').hidden=true;}
document.addEventListener('click',event=>{
 const open=event.target.closest('[data-open]'),comp=event.target.closest('[data-compare]'),remove=event.target.closest('[data-remove]');
 if(open)detail(open.dataset.open);
 if(comp){const id=comp.dataset.compare;state.selected=state.selected.includes(id)?state.selected.filter(x=>x!==id):[...state.selected.slice(-1),id];render();renderCompare();}
 if(remove){state.selected=state.selected.filter(x=>x!==remove.dataset.remove);render();renderCompare();}
 if(event.target===$('modal'))close();
});
$('close').addEventListener('click',close);
document.addEventListener('keydown',event=>{if(event.key==='Escape')close()});
$('season').addEventListener('change',load);
['search','team','position','sort'].forEach(id=>$(id).addEventListener(id==='search'?'input':'change',render));
load();
