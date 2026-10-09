'use strict';
// RinkLens v2: automatic NHL data, optional private Supabase sync; no analytics tracking.
const $=s=>document.querySelector(s), $$=s=>Array.from(document.querySelectorAll(s));
const traits=[['skating','Skating','Speed, edges, balance, and separation'],['puck','Puck skills','Control, passing and shot execution'],['iq','Hockey IQ','Reads, anticipation and decisions'],['defense','Defensive play','Coverage, stick detail and gap control'],['compete','Compete level','Battles, habits and consistency'],['transition','Transition','Zone exits, entries and rush play']];
const demoRows=[
 ['Alex Mercer','BUF','C',78,34,47,236,19.5],['Noah Voss','DET','C',79,28,43,215,19.2],['Elias Rourke','NJD','LW',80,31,38,240,18.2],['Luca Bennett','CAR','RW',77,23,42,207,18],['Cole Anders','BOS','RW',75,30,28,196,17.4],['Mateo Bell','COL','C',82,26,51,256,21.1],['Drew Callen','NYR','D',81,16,42,204,24.1],['Owen Sato','DAL','D',80,10,47,179,23.8],['Mason Hale','BUF','D',77,12,35,166,22.5],['Felix Carter','LAK','D',82,11,33,158,22.1],['Ryan Brooks','MTL','C',73,19,25,170,16],['Adrian Walker','TOR','LW',82,38,45,280,20],['Finn Ellis','VAN','RW',79,27,36,221,18.7],['Jonah Price','MIN','D',81,7,30,135,22.9],['Leo Hudson','OTT','C',74,20,33,175,17.8],['Asher Reed','FLA','LW',80,21,36,205,17.9],['Quinn Porter','SEA','D',69,5,19,96,19.9],['Theo Hart','PHI','RW',72,16,20,138,14.2]
];
const demo=demoRows.map((r,i)=>({id:'demo-'+(i+1),name:r[0],team:r[1],pos:r[2],gp:r[3],g:r[4],a:r[5],p:r[4]+r[5],shots:r[6],toi:r[7],xgp:40+i%6*4,cfp:44+i%4*3,xg60:.5+i%6*.11}));
const presets={
 'demo-1':{skating:4,puck:4,iq:5,defense:3,compete:5,transition:4,notes:'Illustrative report: anticipates passing lanes and creates offense.'},
 'demo-4':{skating:5,puck:3,iq:4,defense:5,compete:4,transition:5,notes:'Illustrative report: strong pace on exits and entries.'},
 'demo-7':{skating:3,puck:5,iq:4,defense:4,compete:3,transition:5,notes:'Illustrative report: high-end transition vision.'},
 'demo-11':{skating:5,puck:3,iq:4,defense:3,compete:5,transition:4,notes:'Illustrative report: drives play with speed.'},
 'demo-16':{skating:4,puck:4,iq:4,defense:5,compete:5,transition:4,notes:'Illustrative report: strong detail on puck retrievals.'}
};
const S={players:demo,source:'demo',season:'20262027',scouts:{},watch:new Set(),compare:[],weight:60,search:'',team:'all',pos:'all',rating:'all',sort:'analytics',active:null,draft:{},view:'dashboard',statMeta:null,loadToken:0};
const esc=x=>String(x??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
const n=x=>{const v=Number(x);return Number.isFinite(v)?v:0};
const round=x=>Math.round(x), val=(x,d=0)=>Number.isFinite(x)?x.toFixed(d):'—';
const storageGet=(k,otherwise)=>{try{return JSON.parse(localStorage.getItem(k))??otherwise}catch{return otherwise}};
const storageSet=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v));return true}catch{notice('Local browser storage unavailable. Export your reports to keep them.');return false}};
const dataScope=()=>RinkCloud.user?.id?'user:'+RinkCloud.user.id:(S.source==='demo'?'guest:demo':'guest:real');
const scoutKey=()=>`rinklens-scouting-v2:${dataScope()}:${S.season}`;
const watchKey=()=>`rinklens-watch-v2:${dataScope()}:${S.season}`;
const pendingKey=(season=S.season)=>`rinklens-sync-pending-v1:${RinkCloud.user?.id||'none'}:${season}`;
function localReports(){
 const saved=storageGet(scoutKey(),null);
 if(saved!==null)return saved;
 // One-time migration from the first release; account data is intentionally NOT copied from guest storage.
 if(RinkCloud.user)return {};
 const legacySources=S.source==='demo'?['demo']:['nhl','moneypuck'];
 return Object.assign({},...legacySources.map(src=>storageGet(`rinklens-scouting-v1:${src}:${S.season}`,{})));
}
function localWatch(){
 const saved=storageGet(watchKey(),null);
 if(saved!==null)return saved;
 if(RinkCloud.user)return [];
 const legacySources=S.source==='demo'?['demo']:['nhl','moneypuck'];
 return [...new Set(legacySources.flatMap(src=>storageGet(`rinklens-watch-v1:${src}:${S.season}`,[])))];
}
const seasonLabel=()=>S.season.slice(0,4)+'–'+S.season.slice(-2);
const position=p=>p.pos==='D'?'D':'F';
const per60=(p,field)=>p.gp&&p.toi?n(p[field])*60/(p.toi*p.gp):0;
const playerFor=id=>S.players.find(p=>p.id===id);
const reportFor=p=>{const r=S.scouts[p.id];return r&&traits.every(([k])=>n(r[k])>=1&&n(r[k])<=5)?r:null};
const eye=p=>{const r=reportFor(p);return r?round(traits.reduce((s,[k])=>s+n(r[k]),0)/6*20):null};
const combined=p=>eye(p)===null?null:round(p.index*S.weight/100+eye(p)*(100-S.weight)/100);
function notice(msg){const toast=$('#toast');toast.textContent=msg;toast.classList.add('show');clearTimeout(notice.timer);notice.timer=setTimeout(()=>toast.classList.remove('show'),4200)}
function calc(){const enough=S.players.filter(p=>p.gp>=10);const pool=enough.length>=8?enough:S.players;const adv=S.source==='moneypuck';
 const positionPct=(p,fn)=>{const values=pool.filter(q=>position(q)===position(p)).map(fn).filter(Number.isFinite);if(!values.length)return 50;const v=fn(p),below=values.filter(x=>x<v).length,equal=values.filter(x=>x===v).length;return round((below+equal/2)/values.length*100)};
 for(const p of S.players){let parts;
  if(adv)parts=[[.45,q=>q.xgp],[.20,q=>q.cfp],[.20,q=>q.xg60],[.15,q=>per60(q,'p')]];
  else parts=[[.55,q=>per60(q,'p')],[.30,q=>per60(q,'shots')],[.15,q=>per60(q,'g')]];
  p.index=round(parts.reduce((a,[w,fn])=>a+w*positionPct(p,fn),0));
 }
}
function setDataset(players,source,season){S.players=players;S.source=source;S.season=season;S.compare=[];S.scouts=localReports();if(source==='demo'&&!Object.keys(S.scouts).length&&!RinkCloud.user)S.scouts=JSON.parse(JSON.stringify(presets));S.watch=new Set(localWatch());S.search='';S.team=S.pos=S.rating='all';$('#searchInput').value='';$('#seasonSelect').value=season;$('#scoutSearch').value='';$('#posFilter').value='all';$('#ratingFilter').value='all';
 $('#teamFilter').innerHTML='<option value="all">All teams</option>'+Array.from(new Set(players.map(p=>p.team))).sort().map(t=>`<option value="${esc(t)}">${esc(t)}</option>`).join('');calc();render();}
function renderSource(){const src=$('#sourceText');$('#sourceBanner .source-dot').className='source-dot '+(S.source==='demo'?'demo':'real');if(S.source==='demo')src.innerHTML='<b>DEMO MODE</b> — Every player, statistic, and initial scouting grade shown here is fictional and illustrative.';
 else if(S.source==='nhl')src.innerHTML=`<b>NHL STATS</b> — ${seasonLabel()} regular-season numbers. ${S.statMeta?.updatedAt?'Updated '+esc(new Date(S.statMeta.updatedAt).toLocaleDateString())+' · ':''}${esc(S.statMeta?.kind||'NHL Stats REST')}. Our Production Index is an independent calculation, not an official metric.`;
 else src.innerHTML=`<b>IMPORTED ADVANCED DATA</b> — ${seasonLabel()} MoneyPuck CSV. Credit the provider and check data-use permissions.`;
 $('#snapshotSource').textContent=S.source==='demo'?'Illustrative dataset':S.source==='nhl'?'NHL summary stats':'Imported 5v5 dataset';$('#advHeader').textContent=S.source==='moneypuck'?'5V5 INDEX':'PROD. INDEX';}
function renderKPIs(){const gradeCount=S.players.filter(p=>eye(p)!==null).length;$('#kpiPlayers').textContent=S.players.length.toLocaleString();$('#kpiRated').textContent=gradeCount;$('#ratedCountSide').textContent=gradeCount;$('#kpiWatch').textContent=S.watch.size;$('#kpiAnalytics').textContent=S.players.length?round(S.players.reduce((s,p)=>s+p.index,0)/S.players.length):'—';}
function renderLeaders(){const top=[...S.players].sort((a,b)=>b.index-a.index).slice(0,5);$('#topPlayers').innerHTML=top.map((p,i)=>`<div class="top-player" data-open="${esc(p.id)}"><span class="rank-num">${String(i+1).padStart(2,'0')}</span><span class="team-tile">${esc(p.team)}</span><span class="player-identity"><span class="player-title">${esc(p.name)}</span><span class="player-sub" style="display:block">${esc(p.pos)} · ${p.gp} GP · ${p.p} PTS</span></span><span><span class="score-display" style="display:block">${p.index}</span><span class="score-label">${S.source==='moneypuck'?'5V5':'PROD.'} INDEX</span></span></div>`).join('');}
function renderPlot(){const rated=S.players.filter(p=>eye(p)!==null);if(!rated.length){$('#scatterArea').innerHTML='<p style="text-align:center">No scouting reports. Grade a player to plot both perspectives.</p>';return}
 const w=540,h=255,l=46,r=14,t=12,b=32,x=v=>l+(w-l-r)*v/100,y=v=>t+(h-t-b)*(1-v/100);let svg=`<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="Scatter plot comparing statistical and scouting scores">`;
 for(let i=0;i<=100;i+=25){svg+=`<line x1="${x(i)}" x2="${x(i)}" y1="${t}" y2="${h-b}" stroke="#294052" stroke-dasharray="3 4"/><line x1="${l}" x2="${w-r}" y1="${y(i)}" y2="${y(i)}" stroke="#294052" stroke-dasharray="3 4"/><text x="${x(i)}" y="${h-15}" fill="#8eaaba" text-anchor="middle" font-size="10">${i}</text><text x="${l-10}" y="${y(i)+3}" fill="#8eaaba" text-anchor="end" font-size="10">${i}</text>`}
 for(const p of rated){const e=eye(p);svg+=`<circle cx="${x(p.index)}" cy="${y(e)}" r="7" fill="${p.index>=50&&e>=50?'#82e6ce':'#f0bd80'}" stroke="#0c1a27" stroke-width="2" data-open="${esc(p.id)}" style="cursor:pointer"><title>${esc(p.name)} | Data ${p.index}; Scout ${e}</title></circle>`}
 svg+=`<text x="${(w+l-r)/2}" y="${h-1}" fill="#8eaaba" text-anchor="middle" font-size="10">STATISTICAL INDEX →</text><text x="11" y="${(h-b+t)/2}" transform="rotate(-90 11 ${(h-b+t)/2})" fill="#8eaaba" text-anchor="middle" font-size="10">EYE TEST →</text></svg>`;$('#scatterArea').innerHTML=svg;}
function filtered(){const q=S.search.toLowerCase();return S.players.filter(p=>(!q||p.name.toLowerCase().includes(q)||p.team.toLowerCase().includes(q))&&(S.team==='all'||p.team===S.team)&&(S.pos==='all'||position(p)===S.pos)&&(S.rating==='all'||S.rating==='rated'&&eye(p)!==null||S.rating==='unrated'&&eye(p)===null||S.rating==='watch'&&S.watch.has(p.id))).sort((a,b)=>S.sort==='name'?a.name.localeCompare(b.name):S.sort==='points'?b.p-a.p:S.sort==='eye'?(eye(b)??-1)-(eye(a)??-1):S.sort==='combined'?(combined(b)??-1)-(combined(a)??-1):b.index-a.index)}
function renderTable(){const list=filtered();$('#resultCount').textContent=list.length+' SKATERS';$('#playerRows').innerHTML=list.length?list.map(p=>{const e=eye(p),c=combined(p);return `<tr><td><div class="table-player" data-open="${esc(p.id)}"><span class="team-tile">${esc(p.team)}</span><span><strong>${esc(p.name)} ${S.watch.has(p.id)?'☆':''}</strong><small>${esc(p.pos)} · ${esc(p.team)}</small></span></div></td><td>${p.gp}</td><td>${p.g}</td><td>${p.a}</td><td><strong>${p.p}</strong></td><td>${val(per60(p,'p'),2)}</td><td><span class="stat-pill">${p.index}</span></td><td><span class="stat-pill ${e===null?'no-grade':'eye'}">${e??'—'}</span></td><td><span class="stat-pill ${c===null?'no-grade':''}">${c??'—'}</span></td><td><button class="table-action ${S.compare.includes(p.id)?'selected':''}" data-compare="${esc(p.id)}" aria-label="Add ${esc(p.name)} to comparison">⇄</button></td></tr>`}).join(''):'<tr><td colspan="10" class="empty-table">No players matched those filters.</td></tr>';}
function renderReports(){const arr=S.players.filter(p=>eye(p)!==null).sort((a,b)=>eye(b)-eye(a));$('#scoutingCount').textContent=arr.length+' REPORT'+(arr.length===1?'':'S');$('#scoutedList').innerHTML=arr.length?arr.map(p=>`<div class="report-item" data-open="${esc(p.id)}"><span class="team-tile">${esc(p.team)}</span><span style="flex:1"><span class="player-title">${esc(p.name)}</span><span class="player-sub" style="display:block">${esc(p.pos)} · ${esc(S.scouts[p.id].date||'Example report')}</span></span><span class="report-score">${eye(p)}</span></div>`).join(''):'<div class="report-placeholder"><div class="large-icon">◎</div><h3>No reports yet</h3><p>Search below to evaluate a player.</p></div>';renderSuggestions();}
function renderSuggestions(){const q=($('#scoutSearch').value||'').toLowerCase().trim();$('#scoutSuggestions').innerHTML=S.players.filter(p=>p.name.toLowerCase().includes(q)||p.team.toLowerCase().includes(q)).slice(0,8).map(p=>`<button class="suggestion" data-open="${esc(p.id)}"><strong>${esc(p.name)}</strong><br><span style="color:#90aabc">${esc(p.pos)} · ${esc(p.team)} ${eye(p)!==null?'· Edit grade':''}</span></button>`).join('');}
function renderCompare(){const arr=S.compare.map(playerFor).filter(Boolean);if(!arr.length){$('#comparisonContent').innerHTML='<div class="compare-blank"><h3>Select two players</h3><p>In the database, tap ⇄ next to the players you want to compare.</p><button class="primary-button" data-go="players">Browse players →</button></div>';return}
 let html=`<div class="panel compare-slider"><div><div class="eyebrow muted">CUSTOMIZE THE COMBINED EVALUATION</div><h3>Data ${S.weight}% / Eye test ${100-S.weight}%</h3></div><input type="range" min="0" max="100" step="5" id="weightRange" value="${S.weight}" aria-label="Data weight"><span style="font-size:10px;color:#8aa6b3">Scouted players only</span></div><div class="compare-columns">`;
 for(const p of arr){html+=`<section class="panel"><div class="compare-player-head"><span class="team-tile">${esc(p.team)}</span><div><h3>${esc(p.name)}</h3><div class="player-sub">${esc(p.team)} · ${esc(p.pos)} · ${p.gp} GP</div></div><button class="remove-compare" data-remove="${esc(p.id)}">✕</button></div><div class="compare-metrics">${[['STAT INDEX',p.index],['EYE TEST',eye(p)??'—'],['COMBINED',combined(p)??'—'],['POINTS',p.p],['POINTS/60',val(per60(p,'p'),2)],[S.source==='moneypuck'?'5V5 xG%':'SHOTS',S.source==='moneypuck'?val(p.xgp,1)+'%':p.shots]].map(([label,v])=>`<div class="compare-metric"><small>${label}</small><strong>${v}</strong></div>`).join('')}</div><h4>SCOUTING TRAITS</h4>`;
 for(const [k,name] of traits){const v=reportFor(p)?.[k];html+=`<div class="compare-trait"><div class="compare-trait-top"><span>${name}</span><span>${v?v+'/5':'Not rated'}</span></div><div class="compare-bar"><div style="width:${v?v*20:0}%"></div></div></div>`}
 html+=`<div class="compare-notes">${esc(S.scouts[p.id]?.notes||'No scouting notes saved.')}</div><button class="secondary-button" style="margin-top:15px" data-open="${esc(p.id)}">${eye(p)===null?'Create report':'Edit report'} →</button></section>`}
 if(arr.length===1)html+='<div class="compare-blank"><h3>Add one more player</h3><p>Choose from the searchable database.</p><button class="secondary-button" data-go="players">Browse players →</button></div>';
 $('#comparisonContent').innerHTML=html+'</div>';$('#weightRange').addEventListener('input',e=>{S.weight=n(e.target.value);renderCompare()});}
function render(){renderSource();renderKPIs();renderLeaders();renderPlot();renderTable();renderReports();renderCompare();}
function navigate(view){S.view=view;$$('.view').forEach(x=>x.classList.toggle('active',x.id==='view-'+view));$$('.nav-item').forEach(x=>x.classList.toggle('active',x.dataset.view===view));$('#breadcrumb').textContent=({dashboard:'Overview',players:'Player database',scouting:'Scouting board',compare:'Player comparison',methodology:'Methodology',account:'Account & sync'})[view]||'Overview';if(view==='players')renderTable();if(view==='scouting')renderReports();if(view==='compare')renderCompare();window.scrollTo({top:0,behavior:'smooth'});}
function toggleCompare(id){if(S.compare.includes(id))S.compare=S.compare.filter(x=>x!==id);else if(S.compare.length<2)S.compare.push(id);else S.compare=[S.compare[1],id];renderTable();renderCompare();notice(S.compare.length===2?'Two players selected — open Comparison':'Comparison selection updated');}
function toggleWatch(id){
 const enabled=!S.watch.has(id);
 if(enabled)S.watch.add(id);else S.watch.delete(id);
 storageSet(watchKey(),[...S.watch]);
 if(RinkCloud.user && S.source!=='demo') {enqueueWatch(id,enabled);flushPending(S.season);}
 renderKPIs();renderTable();openPlayer(id);
}
function openPlayer(id){const p=playerFor(id);if(!p)return;S.active=id;S.draft={...(S.scouts[id]||{})};$('#modalContent').innerHTML=`<div class="modal-profile"><span class="team-tile" style="width:60px;height:60px;font-size:17px">${esc(p.team)}</span><div><h2 id="modalTitle">${esc(p.name)}</h2><p>${esc(p.pos)} · ${esc(p.team)} · ${p.gp} games · ${eye(p)===null?'Not yet scouted':'Eye-test grade '+eye(p)+'/100'}</p></div></div><div class="modal-numbers">${[['POINTS',p.p],['POINTS / 60',val(per60(p,'p'),2)],['STAT INDEX',p.index],['COMBINED',combined(p)??'—']].map(([label,v])=>`<div><small>${label}</small><strong>${v}</strong></div>`).join('')}</div><div class="modal-divider"></div><h4>YOUR SIX-TRAIT SCOUTING ASSESSMENT</h4><p>Choose a 1–5 grade for each trait. Grade independently of the statistical index.</p><div class="grade-grid">${traits.map(([k,name])=>`<div class="grade-control"><div class="grade-label"><span>${name}</span><span id="selected-${k}">${S.draft[k]||'—'} / 5</span></div><div class="grade-buttons">${[1,2,3,4,5].map(v=>`<button type="button" data-grade="${k}" data-value="${v}" class="${n(S.draft[k])===v?'chosen':''}">${v}</button>`).join('')}</div></div>`).join('')}</div><label class="notes-label" for="scoutNotes">Film / game notes</label><textarea id="scoutNotes" maxlength="4000" placeholder="Document what you observed and what to revisit">${esc(S.draft.notes||'')}</textarea><div class="modal-actions"><button class="secondary-button" id="modalWatch">${S.watch.has(id)?'★ Remove watchlist':'☆ Add to watchlist'}</button><button class="secondary-button" id="modalCompare">⇄ Compare</button><button class="primary-button" id="saveReport">Save scout report →</button></div><div class="modal-meta">${RinkCloud.user?'Signed-in reports sync to your private account when online.': 'Reports are saved to this browser only.'} Demo scouting reports are fictional and are never cloud-synced.</div>`;$('#playerModal').hidden=false;document.body.style.overflow='hidden';$('#closeModal').focus();}
function closePlayer(){$('#playerModal').hidden=true;document.body.style.overflow='';S.active=null;}
function saveReport(){if(!S.active)return;S.draft.notes=$('#scoutNotes').value.trim();if(traits.some(([k])=>n(S.draft[k])<1||n(S.draft[k])>5)){notice('Complete all six trait grades before saving');return}S.draft.date=new Date().toLocaleDateString();S.scouts[S.active]={...S.draft};storageSet(scoutKey(),S.scouts);if(RinkCloud.user&&S.source!=='demo'){enqueueReport(S.active,S.scouts[S.active]);flushPending(S.season)}closePlayer();render();notice(RinkCloud.user?'Report saved locally; cloud sync queued':'Scouting report saved in your browser');}
function download(name,text,type){const url=URL.createObjectURL(new Blob([text],{type})),a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);}
const csvEsc=s=>{s=String(s??'');return /[,"\r\n]/.test(s)?'"'+s.replaceAll('"','""')+'"':s;};
function exportGrades(){const rows=[['Season','Source','ID','Name','Team','Position',...traits.map(t=>t[1]),'Eye test','Notes','Date']];for(const p of S.players){const r=reportFor(p);if(r)rows.push([seasonLabel(),S.source,p.id,p.name,p.team,p.pos,...traits.map(([k])=>r[k]),eye(p),r.notes||'',r.date||''])}if(rows.length<2){notice('No completed reports to export');return}download('rinklens-scouts-'+S.season+'.csv',rows.map(r=>r.map(csvEsc).join(',')).join('\r\n'),'text/csv;charset=utf-8');}
function parseCSV(text){const rows=[];let row=[],value='',quoted=false;text=text.replace(/^\uFEFF/,'');for(let i=0;i<text.length;i++){let c=text[i];if(quoted){if(c==='"'&&text[i+1]==='"'){value+='"';i++}else if(c==='"')quoted=false;else value+=c;}else if(c==='"')quoted=true;else if(c===','){row.push(value);value='';}else if(c==='\n'){row.push(value.replace(/\r$/,''));rows.push(row);row=[];value='';}else value+=c;}if(value||row.length){row.push(value);rows.push(row)}return rows;}
const percent=v=>{const x=Number(v);return Number.isFinite(x)?(x<=1?x*100:x):0};
function parseMoneyPuck(text){let rows=parseCSV(text);if(rows.length<3)throw new Error('CSV is empty');const header=rows.shift(),keys=Object.fromEntries(header.map((k,i)=>[k,i]));if(!('playerId' in keys)||!('situation' in keys)||!('onIce_xGoalsPercentage' in keys))throw new Error('Expected a MoneyPuck season skaters.csv file');const field=(r,k)=>r[keys[k]]??'';const players=new Map();
 for(const row of rows){const id=field(row,'playerId'),sit=field(row,'situation');if(!id||!['5on5','all'].includes(sit))continue;const old=players.get(id)||{};const record=Object.fromEntries(header.map((k,i)=>[k,row[i]]));if(!old[sit]||n(record.icetime)>n(old[sit].icetime))old[sit]=record;players.set(id,old);}
 const out=[];for(const [id,obj] of players){const all=obj.all||obj['5on5'],ev=obj['5on5'];if(!all||!ev||!n(all.icetime)||!n(ev.icetime))continue;const gp=n(all.games_played||ev.games_played),pos=all.position||ev.position||'C';if(!gp||pos==='G')continue;out.push({id:String(id),name:all.name||ev.name||'Unknown',team:all.team||ev.team||'—',pos,gp,g:n(all.I_F_goals),a:n(all.I_F_primaryAssists)+n(all.I_F_secondaryAssists),p:n(all.I_F_points),shots:n(all.I_F_shotsOnGoal),toi:n(all.icetime)/60/gp,xgp:percent(ev.onIce_xGoalsPercentage),cfp:percent(ev.onIce_corsiPercentage),xg60:n(ev.I_F_xGoals)*3600/n(ev.icetime)});}
 if(out.length<5)throw new Error('Not enough skaters parsed. Use full season skaters.csv.');return out;}
async function importFile(file){try{const out=parseMoneyPuck(await file.text());setDataset(out,'moneypuck',$('#seasonSelect').value);S.statMeta={kind:'Local advanced CSV'};renderSource();if(RinkCloud.user)await syncCloud();navigate('players');notice(`${out.length} skaters imported successfully`)}catch(err){notice('CSV import failed: '+String(err.message).slice(0,100))}}
const parseTOI=t=>{if(typeof t==='string'&&t.includes(':')){const v=t.split(':').map(Number);return n(v[0])+n(v[1])/60;}const v=n(t);return v>100?v/60:v;};
// Use versioned, verified NHL snapshots generated by the included daily GitHub Action.
// When there is no snapshot, use the NHL REST endpoint directly; if that fails, use
// an explicitly labelled locally cached REAL response (never fictional demo data).
async function fetchJSON(url,timeout=12000){
 const controller=new AbortController(), timer=setTimeout(()=>controller.abort(),timeout);
 try{const response=await fetch(url,{signal:controller.signal,cache:'no-store'});
   if(!response.ok)throw new Error('HTTP '+response.status);
   return await response.json();
 }finally{clearTimeout(timer)}
}
function normalizeNHL(rows){
 const seen=new Set();return rows.map(r=>({
  id:String(r.playerId||r.id||''),name:r.skaterFullName||r.name||'Unknown',
  team:r.teamAbbrevs||r.team||'—',pos:r.positionCode||r.pos||'C',gp:n(r.gamesPlayed??r.gp),
  g:n(r.goals??r.g),a:n(r.assists??r.a),p:n(r.points??r.p),shots:n(r.shots),
  toi:typeof r.timeOnIcePerGame!=='undefined'?parseTOI(r.timeOnIcePerGame):n(r.toi)
 })).filter(p=>{if(!p.id||p.pos==='G'||p.gp<=0||seen.has(p.id))return false;seen.add(p.id);return true})
}
async function getNHL(season,forceLive){
 const direct=async()=>{
  const exp=encodeURIComponent('seasonId='+season+' and gameTypeId=2');
  const json=await fetchJSON(`https://api.nhle.com/stats/rest/en/skater/summary?cayenneExp=${exp}&limit=-1&start=0`,16000);
  const players=normalizeNHL(json.data||[]);
  if(players.length<5)throw new Error('No NHL skaters for this season yet');
  return {players, updatedAt:new Date().toISOString(),kind:'NHL direct API'};
 };
 const snapshot=async()=>{
  const json=await fetchJSON(`data/nhl-${season}.json?v=${Math.floor(Date.now()/3600000)}`);
  if(json.source!=='nhl'||json.season!==season)throw new Error('Invalid season snapshot');
  const players=normalizeNHL(json.players||[]);
  if(players.length<5)throw new Error('Empty season snapshot');
  return {players,updatedAt:json.updatedAt,kind:'Daily NHL snapshot'};
 };
 const tries=forceLive?[direct,snapshot]:[snapshot,direct];
 for(const fetcher of tries){try{return await fetcher()}catch(err){console.info('NHL source unavailable:',err.message)}}
 const cached=storageGet(`rinklens-nhl-cache-v1:${season}`,null);
 if(cached?.players?.length>=5){return {...cached,kind:'Offline cached NHL data (may be outdated)'}}
 throw new Error('No usable NHL statistics are available on this connection');
}
async function loadNHL({initial=false,forceLive=false}={}){
 const btn=$('#loadNHL'),initialText=btn.innerHTML,season=$('#seasonSelect').value,token=++S.loadToken;
 btn.disabled=true;btn.textContent='Refreshing…';
 try{
  const dataset=await getNHL(season,forceLive);
  if(token!==S.loadToken)return;
  S.statMeta={updatedAt:dataset.updatedAt,kind:dataset.kind};
  if(!dataset.kind.startsWith('Offline')) storageSet(`rinklens-nhl-cache-v1:${season}`,dataset);
  setDataset(dataset.players,'nhl',season);
  if(!initial)navigate('players');
  notice(`Loaded ${dataset.players.length} actual NHL skaters (${dataset.kind})`);
  if(RinkCloud.user)await syncCloud();
 }catch(err){
  if(token!==S.loadToken)return;
  console.warn('NHL refresh:',err);
  $('#seasonSelect').value=S.season;
  if(!initial)notice('Could not update NHL data. Existing data kept; try again or use CSV import.');
 }finally{if(token===S.loadToken){btn.disabled=false;btn.innerHTML=initialText}}
}

function pendingData(season){return storageGet(pendingKey(season),{reports:{},watch:{}})}
function enqueueReport(id,report){const pending=pendingData(S.season);pending.reports[id]=report;storageSet(pendingKey(),pending)}
function enqueueWatch(id,enabled){const pending=pendingData(S.season);pending.watch[id]=enabled;storageSet(pendingKey(),pending)}
let flushing=false;
async function flushPending(season){
 if(!RinkCloud.user||flushing)return;
 flushing=true;
 const key=pendingKey(season),queued=storageGet(key,{reports:{},watch:{}});
 let failures=0;
 for(const [id,report] of Object.entries(queued.reports)){
  try{await RinkCloud.saveReport(season,id,report);
   const latest=storageGet(key,{reports:{},watch:{}});
   if(JSON.stringify(latest.reports[id])===JSON.stringify(report))delete latest.reports[id];
   storageSet(key,latest);
  }catch(e){failures++;console.warn('Report sync:',e)}
 }
 for(const [id,on] of Object.entries(queued.watch)){
  try{await RinkCloud.setWatch(season,id,on);
   const latest=storageGet(key,{reports:{},watch:{}});
   if(latest.watch[id]===on)delete latest.watch[id];storageSet(key,latest);
  }catch(e){failures++;console.warn('Watch sync:',e)}
 }
 flushing=false;
 if(failures && season===S.season)$('#accountStatus').textContent=`${failures} changes are saved locally, pending cloud sync. Retry when connected.`;
}
async function syncCloud(){
 if(!RinkCloud.user||S.source==='demo')return;
 const userId=RinkCloud.user.id,season=S.season;
 $('#accountStatus').textContent='Syncing account data…';
 try{
  await flushPending(season);
  const remote=await RinkCloud.read(season);
  if(RinkCloud.user?.id!==userId||S.season!==season)return;
  const pending=pendingData(season);
  S.scouts=Object.fromEntries(remote.reports.map(r=>[String(r.player_id),{
   ...Object.fromEntries(traits.map(([k])=>[k,n(r[k])])),notes:r.notes||'',date:new Date(r.updated_at).toLocaleDateString()
  }]));
  Object.assign(S.scouts,pending.reports);
  S.watch=new Set(remote.watch);
  for(const [id,enabled] of Object.entries(pending.watch)){
   if(enabled)S.watch.add(id);else S.watch.delete(id);
  }
  storageSet(scoutKey(),S.scouts);storageSet(watchKey(),[...S.watch]);
  render();
  const count=Object.keys(pending.reports).length+Object.keys(pending.watch).length;
  $('#accountStatus').textContent=count?`Synced; ${count} local change(s) still pending. You can retry.`:`Account data synced for ${seasonLabel()}.`;
 }catch(err){
  console.warn('Cloud sync:',err);
  $('#accountStatus').textContent='Cloud sync unavailable: '+String(err.message).slice(0,130)+' — local copy kept.';
 }
}
function renderAccount(){
 const configured=RinkCloud.configured(),user=RinkCloud.user;
 $('#cloudHeading').textContent=user?'Signed in and syncing':configured?'Sign in to sync':'Cloud not configured';
 $('#cloudDescription').textContent=user?'Private scouting reports and watchlists sync to your account when internet is available.':configured?'Enter your email and use the sign-in link we send to connect another device.':'To enable cross-device reports, set up the included Supabase database and configure config.js.';
 $('#accountSignedOut').hidden=!!user;
 $('#accountSignedIn').hidden=!user;
 $('#accountIdentity').textContent=user?.email||'';
 $('#sendSignin').disabled=!configured;
 if(!user)$('#accountStatus').textContent=configured?'Ready for email sign-in. Guest reports stay on this device until you explicitly import them.':'Cloud is not connected. All reports remain local to this device.';
}
async function importGuest(){
 if(!RinkCloud.user||S.source==='demo'){notice('Load real NHL data and sign in first');return}
 const season=S.season;
 const srcs=['nhl','moneypuck'];
 const reports=Object.assign({},...srcs.map(src=>storageGet(`rinklens-scouting-v1:${src}:${season}`,{})),storageGet(`rinklens-scouting-v2:guest:real:${season}`,{}));
 const watch=[...new Set([...srcs.flatMap(src=>storageGet(`rinklens-watch-v1:${src}:${season}`,[])),...storageGet(`rinklens-watch-v2:guest:real:${season}`,[])])];
 const allowed=new Set(S.players.map(p=>p.id));
 const importReports=Object.entries(reports).filter(([id,r])=>allowed.has(id)&&traits.every(([k])=>n(r[k])>=1&&n(r[k])<=5));
 const importWatch=watch.filter(id=>allowed.has(id));
 if(!importReports.length&&!importWatch.length){notice('No matching guest reports or watchlist items on this device');return}
 const pending=pendingData(season);
 for(const [id,r] of importReports){S.scouts[id]=r;pending.reports[id]=r;}
 for(const id of importWatch){S.watch.add(id);pending.watch[id]=true;}
 storageSet(pendingKey(season),pending);storageSet(scoutKey(),S.scouts);storageSet(watchKey(),[...S.watch]);render();
 await syncCloud();notice(`Imported ${importReports.length} guest reports and ${importWatch.length} watchlist entries`);
}
async function initializeCloud(){
 renderAccount();
 try{
  await RinkCloud.initialize(async()=>{
   setDataset(S.players,S.source,S.season);renderAccount();
   if(RinkCloud.user)await syncCloud();
  });
  renderAccount();
  if(RinkCloud.user){setDataset(S.players,S.source,S.season);renderAccount();await syncCloud();}
 }catch(err){console.warn('Cloud init:',err);$('#accountStatus').textContent='Account service not available: '+err.message}
}

function setup(){traits.forEach(([k,name,description],i)=>$('#traitsGuide').insertAdjacentHTML('beforeend',`<div class="trait-box"><div class="trait-index">0${i+1}</div><div class="trait-name">${name}</div><div class="trait-desc">${description}</div></div>`));$('#currentYear').textContent=new Date().getFullYear();
 $$('.nav-item').forEach(b=>b.addEventListener('click',()=>navigate(b.dataset.view)));
 document.addEventListener('click',e=>{const go=e.target.closest('[data-go]');if(go)navigate(go.dataset.go);const open=e.target.closest('[data-open]');if(open)openPlayer(open.dataset.open);const compare=e.target.closest('[data-compare]');if(compare)toggleCompare(compare.dataset.compare);const remove=e.target.closest('[data-remove]');if(remove){S.compare=S.compare.filter(x=>x!==remove.dataset.remove);renderTable();renderCompare()}});
 $('#sourceMore').addEventListener('click',()=>navigate('methodology'));
 $('#searchInput').addEventListener('input',e=>{S.search=e.target.value;renderTable()});$('#teamFilter').addEventListener('change',e=>{S.team=e.target.value;renderTable()});$('#posFilter').addEventListener('change',e=>{S.pos=e.target.value;renderTable()});$('#ratingFilter').addEventListener('change',e=>{S.rating=e.target.value;renderTable()});$('#sortSelect').addEventListener('change',e=>{S.sort=e.target.value;renderTable()});$('#scoutSearch').addEventListener('input',renderSuggestions);
 $('#loadNHL').addEventListener('click',()=>loadNHL({forceLive:true}));
 $('#seasonSelect').addEventListener('change',()=>loadNHL());
 $('#sendSignin').addEventListener('click',async()=>{
  const email=$('#accountEmail').value.trim();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){notice('Enter a valid email address');return}
  const btn=$('#sendSignin');btn.disabled=true;
  try{await RinkCloud.magicLink(email);$('#accountStatus').textContent='Check your email for the sign-in link. Open the link on this website.';notice('Sign-in email requested');}
  catch(e){$('#accountStatus').textContent=e.message;notice('Unable to send sign-in email')}
  finally{btn.disabled=false;}
 });
 $('#signOut').addEventListener('click',async()=>{try{await RinkCloud.signOut()}catch(e){notice('Sign out failed: '+e.message)}});
 $('#syncNow').addEventListener('click',syncCloud);
 $('#importGuest').addEventListener('click',importGuest);
 $('#importDataButton').addEventListener('click',()=>$('#csvFile').click());$('#csvFile').addEventListener('change',e=>{if(e.target.files?.[0])importFile(e.target.files[0]);e.target.value=''});$('#exportGrades').addEventListener('click',exportGrades);
 $('#closeModal').addEventListener('click',closePlayer);$('#playerModal').addEventListener('click',e=>{if(e.target===$('#playerModal'))closePlayer()});document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('#playerModal').hidden)closePlayer()});
 $('#modalContent').addEventListener('click',e=>{const g=e.target.closest('[data-grade]');if(g){S.draft[g.dataset.grade]=n(g.dataset.value);$$(`[data-grade="${g.dataset.grade}"]`).forEach(b=>b.classList.toggle('chosen',b.dataset.value===g.dataset.value));$('#selected-'+g.dataset.grade).textContent=g.dataset.value+' / 5';}if(e.target.closest('#saveReport'))saveReport();if(e.target.closest('#modalWatch'))toggleWatch(S.active);if(e.target.closest('#modalCompare')){toggleCompare(S.active);closePlayer()}});
 setDataset(demo,'demo','20262027');
 initializeCloud();
 // Auto-update on every opening (if hosted), with a validated real-data cache fallback.
 loadNHL({initial:true});
}
setup();
