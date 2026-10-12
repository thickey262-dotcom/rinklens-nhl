'use strict';
/* Film lab. Browser keeps the original video local; only consented JPEG frames reach an authenticated server. */
const RinkFilm=(()=>{
  const $f=id=>document.getElementById(id);
  const state={file:null,url:null,frames:[],observations:[],analysis:null,busy:false,playerId:null};
  const escapeText=value=>String(value??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
  function status(message,kind='info'){
    const target=$f('filmStatus');
    if(target){target.textContent=message;target.dataset.kind=kind}
  }
  function player(){
    const id=state.playerId||$f('filmPlayer').value;
    return S.players.find(p=>String(p.id)===String(id))||null;
  }
  function refreshPlayers(){
    const select=$f('filmPlayer');if(!select)return;
    const prior=state.playerId||select.value;
    select.replaceChildren(new Option('Choose a player…',''));
    S.players.filter(p=>/^[0-9]{6,10}$/.test(String(p.id))).sort((a,b)=>a.name.localeCompare(b.name)).forEach(p=>{
      select.add(new Option(p.name+' · '+p.team+' · '+p.pos,p.id));
    });
    if([...select.options].some(o=>o.value===String(prior))){select.value=String(prior);state.playerId=String(prior)}
    else {state.playerId=null;select.value=''}
  }
  function fileChanged(e){
    const file=e.target.files?.[0];if(!file)return;
    if(!file.type.startsWith('video/')||file.size>300*1024*1024){
      status('Choose a supported video under 300 MB. Video never uploads automatically.','error');
      e.target.value='';return;
    }
    if(state.url)URL.revokeObjectURL(state.url);
    state.file=file;state.url=URL.createObjectURL(file);
    state.frames=[];state.analysis=null;state.observations=[];
    const video=$f('filmVideo');video.src=state.url;video.load();
    renderFrames();renderObservations();renderAnalysis();
    status('Video opened locally. Choose a player, confirm permission to analyze this footage, then capture evidence frames.');
  }
  function duration(){
    const x=$f('filmVideo').duration;return Number.isFinite(x)?x:0;
  }
  function updateBounds(){
    const end=Math.min(120,duration()||120);
    $f('filmFrom').value='0';
    $f('filmTo').value=end.toFixed(1);
    status('Video ready. Review an identifiable player; the AI cannot follow an unidentified skater through a broadcast.');
  }
  function setBusy(flag){
    state.busy=flag;
    ['filmSample','filmCapture','filmAnalyze'].forEach(id=>{const b=$f(id);if(b)b.disabled=flag});
  }
  function snapshot(){
    const video=$f('filmVideo');
    if(!video.videoWidth||!video.videoHeight)throw Error('This video cannot be decoded by the browser.');
    const canvas=document.createElement('canvas');
    const scale=Math.min(1,768/video.videoWidth);
    canvas.width=Math.max(1,Math.round(video.videoWidth*scale));
    canvas.height=Math.max(1,Math.round(video.videoHeight*scale));
    const ctx=canvas.getContext('2d');if(!ctx)throw Error('Cannot capture this video.');
    ctx.drawImage(video,0,0,canvas.width,canvas.height);
    const image=canvas.toDataURL('image/jpeg',.62);
    if(image.length>380000)throw Error('Frame too large. Use a lower-resolution clip.');
    return {time:Math.round(video.currentTime*10)/10,image};
  }
  function addFrame(frame){
    state.frames=state.frames.filter(x=>Math.abs(x.time-frame.time)>.25);
    state.frames.push(frame);state.frames.sort((a,b)=>a.time-b.time);
    if(state.frames.length>8)state.frames.shift();
    state.analysis=null;renderFrames();renderAnalysis();
  }
  function renderFrames(){
    const root=$f('filmFrames');root.replaceChildren();
    for(const frame of state.frames){
      const box=document.createElement('div');box.className='film-frame';
      const img=document.createElement('img');img.src=frame.image;img.alt='Local video frame at '+RinkFilmCore.labelTime(frame.time);
      const line=document.createElement('div');line.className='film-frame-footer';
      const seek=document.createElement('button');seek.textContent='▶ '+RinkFilmCore.labelTime(frame.time);
      seek.type='button';seek.addEventListener('click',()=>{$f('filmVideo').currentTime=frame.time});
      const remove=document.createElement('button');remove.type='button';remove.textContent='×';remove.setAttribute('aria-label','Remove frame at '+frame.time);
      remove.addEventListener('click',()=>{state.frames=state.frames.filter(f=>f!==frame);state.analysis=null;renderFrames();renderAnalysis()});
      line.append(seek,remove);box.append(img,line);root.append(box);
    }
    $f('filmFrameCount').textContent=state.frames.length+' frames selected (2–8 required for AI)';
  }
  async function seekTo(time){
    const v=$f('filmVideo');v.pause();
    if(Math.abs(v.currentTime-time)<.08)return;
    await new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>{cleanup();reject(new Error('Video seeking timed out'))},7500);
      function cleanup(){clearTimeout(timer);v.removeEventListener('seeked',done);v.removeEventListener('error',fail)}
      function done(){cleanup();resolve()}
      function fail(){cleanup();reject(new Error('Video seek failed'))}
      v.addEventListener('seeked',done,{once:true});v.addEventListener('error',fail,{once:true});
      v.currentTime=time;
    });
  }
  async function sample(){
    if(state.busy||!state.file||!duration()){status('Upload a playable video first.','error');return}
    let start=Number($f('filmFrom').value),end=Number($f('filmTo').value);
    if(!Number.isFinite(start)||!Number.isFinite(end)||start<0||end>duration()||end-start>120){
      status('Choose a valid clip range up to two minutes.','error');return;
    }
    const times=RinkFilmCore.samplingTimes(start,end,6);
    if(!times.length){status('Choose a range of at least two seconds.','error');return}
    setBusy(true);
    const previous=$f('filmVideo').currentTime;
    try{
      const result=[];
      for(const t of times){await seekTo(t);result.push(snapshot())}
      state.frames=result;state.analysis=null;renderFrames();renderAnalysis();
      status('Captured '+result.length+' time-stamped frames locally. Review them before requesting AI analysis.','ok');
    }catch(e){status(e.message,'error')}
    finally{try{await seekTo(Math.min(previous,Math.max(0,duration()-.1)))}catch{}setBusy(false)}
  }
  function capture(){
    if(state.busy||!state.file){status('Open a video first.','error');return}
    try{addFrame(snapshot());status('Saved frame at '+RinkFilmCore.labelTime($f('filmVideo').currentTime)+' (browser-only).','ok')}
    catch(e){status(e.message,'error')}
  }
  function addObservation(){
    const p=player();if(!p){status('Choose an NHL player first.','error');return}
    const note=$f('filmNote').value.trim(),trait=$f('filmTrait').value;
    if(!RinkFilmCore.TRAITS.includes(trait)||note.length<6){status('Add a trait and an observation of at least six characters.','error');return}
    const rating=Number($f('filmGrade').value);
    const item={trait,time:Math.round($f('filmVideo').currentTime*10)/10,note:note.slice(0,500),score:rating>=1&&rating<=5?rating:null,source:'human'};
    state.observations.push(item);$f('filmNote').value='';
    storeReview();renderObservations();status('Time-stamped observation saved locally. This does not overwrite your six-trait scouting profile.','ok');
  }
  const storageKey=()=>{const p=player();return p?'rinklens-film-v1:'+S.season+':'+p.id:''};
  function storeReview(){
    const key=storageKey();if(!key)return;
    try{localStorage.setItem(key,JSON.stringify({version:1,playerId:player().id,season:S.season,observations:state.observations.slice(-100),savedAt:new Date().toISOString()}))}
    catch{status('Browser storage unavailable; export your observations for backup.','error')}
  }
  function loadReview(){
    const key=storageKey();
    state.observations=[];
    if(key)try{
      const v=JSON.parse(localStorage.getItem(key)||'null');
      if(v&&Array.isArray(v.observations))state.observations=v.observations.filter(x=>RinkFilmCore.TRAITS.includes(x.trait)&&typeof x.note==='string'&&Number.isFinite(x.time)).slice(-100);
    }catch{}
    state.frames=[];state.analysis=null;renderObservations();renderFrames();renderAnalysis();
  }
  function renderObservations(){
    const root=$f('filmObservations');root.replaceChildren();
    if(!state.observations.length){root.textContent='No film notes yet. Add an observation while watching.';return}
    for(const note of state.observations){
      const row=document.createElement('div');row.className='film-observation';
      const details=document.createElement('div');
      const head=document.createElement('strong');head.textContent=RinkFilmCore.labelTime(note.time)+' · '+note.trait+(note.score?' · '+note.score+'/5':'');
      const para=document.createElement('p');para.textContent=note.note;
      details.append(head,para);
      const del=document.createElement('button');del.type='button';del.textContent='Remove';
      del.addEventListener('click',()=>{state.observations=state.observations.filter(x=>x!==note);storeReview();renderObservations()});
      row.append(details,del);root.append(row);
    }
  }
  function renderAnalysis(){
    const root=$f('filmAIResults');root.replaceChildren();
    if(!state.analysis){root.textContent='No film-AI results yet. You can still use manual frame capture and time-stamped notes without an AI service.';return}
    const data=state.analysis,top=document.createElement('p');
    top.className='film-ai-summary';
    top.textContent=(data.identityConfirmed?'AI-assisted observations — verify before relying on them. ':'Player identity not verified; no ratings issued. ')+data.summary;root.append(top);
    for(const f of data.findings){
      const box=document.createElement('article');box.className='film-ai-item';
      const head=document.createElement('strong');head.textContent=f.trait.toUpperCase()+' · '+(f.score===null?'Not scored':f.score+'/5 (tentative)')+' · '+f.confidence+' confidence';
      const explanation=document.createElement('p');explanation.textContent=f.explanation;
      box.append(head,explanation);
      const ul=document.createElement('ul');
      for(const ev of f.evidence){const li=document.createElement('li');li.textContent=RinkFilmCore.labelTime(ev.time)+' — '+ev.observation;ul.append(li)}
      box.append(ul);root.append(box);
    }
    if(!data.findings.length){const p=document.createElement('p');p.textContent='The model could not support any trait evaluations from the selected frames.';root.append(p)}
  }
  async function analyze(){
    const p=player();
    if(!p||!state.file){status('Choose an NHL player and local video first.','error');return}
    if(!RinkCloud.configured()||!RinkCloud.user||!RinkCloud.client){
      status('AI requires your configured Supabase account and a deployed authenticated analyze-film function. Manual review works now.','error');return;
    }
    if(!$f('filmConsent').checked){status('Confirm that you have permission to analyze and send frames from this footage.','error');return}
    const identifier=$f('filmIdentifier').value.trim();
    const payload={playerId:String(p.id),playerName:p.name,season:S.season,identifier,frames:state.frames};
    if(!RinkFilmCore.validSelection(payload)){status('Provide a player identifier (e.g., jersey number/team), and 2–8 local JPEG frames.','error');return}
    setBusy(true);status('Submitting ONLY the selected still frames for authenticated AI review…');
    try{
      const {data,error}=await RinkCloud.client.functions.invoke('analyze-film',{body:payload});
      if(error)throw error;
      if(!data||typeof data!=='object')throw Error('Unexpected AI response.');
      state.analysis=RinkFilmCore.scrubAnalysis(data,state.frames.map(f=>f.time));
      renderAnalysis();
      status('AI findings returned. Review every observation—this is not a validated autonomous player-tracking system.','ok');
    }catch(e){status('AI analysis unavailable: '+String(e.message||e).slice(0,180),'error')}
    finally{setBusy(false)}
  }
  function exportReview(){
    const p=player();if(!p){status('Choose a player first.','error');return}
    const record={format:'RinkLens Film Review 1.0',player:{id:p.id,name:p.name,team:p.team},season:S.season,
      videoFileName:state.file?.name||null,originalVideoNotIncluded:true,
      observations:state.observations,aiFindings:state.analysis,frameTimes:state.frames.map(f=>f.time),
      note:'AI findings are unverified; they are not incorporated into manual eye-test grades.'};
    const url=URL.createObjectURL(new Blob([JSON.stringify(record,null,2)],{type:'application/json'}));
    const a=document.createElement('a');a.href=url;a.download='rinklens-film-'+p.id+'-'+S.season+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  function initialize(){
    $f('filmFile')?.addEventListener('change',fileChanged);
    $f('filmVideo')?.addEventListener('loadedmetadata',updateBounds);
    $f('filmCapture')?.addEventListener('click',capture);
    $f('filmSample')?.addEventListener('click',sample);
    $f('filmAddNote')?.addEventListener('click',addObservation);
    $f('filmAnalyze')?.addEventListener('click',analyze);
    $f('filmExport')?.addEventListener('click',exportReview);
    $f('filmPlayer')?.addEventListener('focus',refreshPlayers);
    $f('filmPlayer')?.addEventListener('change',()=>{state.playerId=$f('filmPlayer').value;loadReview()});
    document.addEventListener('click',e=>{
      const el=e.target.closest('[data-film-player]');if(!el)return;
      const id=el.dataset.filmPlayer;
      if(!S.players.some(p=>String(p.id)===String(id)))return;
      closePlayer();navigate('film');refreshPlayers();
      $f('filmPlayer').value=String(id);state.playerId=String(id);loadReview();
    });
    document.addEventListener('click',e=>{
      if(e.target.closest('[data-view="film"]')||e.target.closest('[data-go="film"]'))refreshPlayers();
    });
    refreshPlayers();renderFrames();renderObservations();renderAnalysis();
    window.addEventListener('pagehide',()=>{if(state.url)URL.revokeObjectURL(state.url)});
  }
  return {initialize,refreshPlayers};
})();
RinkFilm.initialize();
