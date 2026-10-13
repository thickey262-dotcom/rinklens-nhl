'use strict';
/* One Eye Test rating only: verified-format community votes, never a stats-derived proxy. */
const RinkEye = (() => {
  const TRAITS = [
    ['skating','Skating'],['puck','Puck skills'],['iq','Hockey IQ'],
    ['defense','Defensive play'],['compete','Compete level'],['transition','Transition']
  ];
  let published = new Map(), own = new Map(), activeSeason = '', requestId = 0, saving = false, loadError = '';
  const validId = id => /^\d{6,10}$/.test(String(id));
  function score(id) {
    if (activeSeason !== state.season || !validId(id)) return null;
    return published.get(String(id))?.score ?? null;
  }
  function count(id) { return published.get(String(id))?.reviewer_count ?? 0; }
  function publishUpdates() {
    if (typeof render === 'function') render();
    if (typeof renderCompare === 'function') renderCompare();
    const slot = document.getElementById('eyePanel');
    if (slot && slot.dataset.eyePlayer) {
      const player = get(slot.dataset.eyePlayer);
      if (player) slot.outerHTML = panel(player);
    }
    const countEl = document.getElementById('eyeCoverage');
    if (countEl) countEl.textContent = published.size + ' players with community Eye Test scores this season';
    const note = document.getElementById('eyeAvailability');
    if (note) note.textContent = loadError || (published.size ? 'Qualified viewer averages are shown in the player table.' : 'No qualified Eye Test scores yet. Three different signed-in viewers are needed before a score appears.');
  }
  async function reload(season = state.season) {
    const req = ++requestId;
    activeSeason = season;
    published = new Map();
    own = new Map();
    loadError = '';
    publishUpdates();
    if (!RinkCloud.client) {
      loadError = 'Eye Test voting is temporarily unavailable; MoneyPuck player statistics are unaffected.';
      publishUpdates();
      return;
    }
    try {
      const client = RinkCloud.client;
      const [publicResult, ownResult] = await Promise.all([
        client.from('community_eye_scores')
          .select('season_id,player_id,reviewer_count,skating,puck,iq,defense,compete,transition,score')
          .eq('season_id',season),
        RinkCloud.user
          ? client.from('community_eye_votes')
              .select('player_id,skating,puck,iq,defense,compete,transition')
              .eq('season_id',season)
          : Promise.resolve({data:[],error:null})
      ]);
      if (req !== requestId || season !== state.season) return;
      if (publicResult.error) throw publicResult.error;
      if (ownResult.error) throw ownResult.error;
      for (const row of publicResult.data || []) {
        if (row.season_id !== season || !validId(row.player_id)
            || Number(row.reviewer_count) < 3 || !Number.isInteger(row.score)
            || row.score < 20 || row.score > 100
            || !TRAITS.every(([key]) => Number(row[key]) >= 1 && Number(row[key]) <= 5)) continue;
        published.set(String(row.player_id),row);
      }
      for (const row of ownResult.data || []) {
        if (validId(row.player_id)) own.set(String(row.player_id),row);
      }
      loadError = '';
    } catch (error) {
      if (req !== requestId) return;
      loadError = 'Eye Test votes could not be loaded. Existing MoneyPuck statistics are still available.';
      console.warn('Eye Test loading:', error);
    }
    publishUpdates();
  }
  function panel(player) {
    const id = String(player.id), r = published.get(id), mine = own.get(id);
    const s = score(id);
    const heading = '<div class="eyebrow">VIEWER OPINION · SEPARATE FROM MONEYPUCK</div><h3>Eye Test</h3>';
    const result = s === null
      ? '<p><strong>Not yet rated.</strong> Public scores appear only after at least three different signed-in viewers have rated the player for this season.</p>'
      : '<p><strong class="eye-score">'+s+'/100</strong> · Average of '+r.reviewer_count+' viewer'+(r.reviewer_count === 1?'':'s')+'. Not a professional scouting grade.</p>';
    const traitDetails = r
      ? '<details><summary>See the six viewer averages</summary><div class="eye-traits">'+TRAITS.map(([key,name]) => '<div><span>'+name+'</span><b>'+Number(r[key]).toFixed(1)+'/5</b></div>').join('')+'</div></details>'
      : '';
    let participation = '<p class="source-note">Eye Test is an opinion from people who confirm they watched the player, not a calculation from hockey statistics. Voters are not independently verified as scouts.</p>';
    if (!RinkCloud.client || !RinkCloud.user) {
      participation += '<button type="button" class="mini" data-eye-signin>Sign in to rate this player</button>';
    } else {
      participation += '<form id="eyeVoteForm" data-eye-player="'+safe(id)+'"><h4>'+(mine?'Update your Eye Test vote':'Give your Eye Test rating')+'</h4><p>Rate what you observed while watching this player in the selected season.</p><div class="vote-grid">'
        + TRAITS.map(([key,name]) => '<label>'+name+'<select name="'+key+'" required><option value="">Choose a grade</option>'
          + [1,2,3,4,5].map(v=>'<option value="'+v+'"'+(Number(mine?.[key])===v?' selected':'')+'>'+v+' — '+['','Needs work','Developing','Average','Strong','Excellent'][v]+'</option>').join('')+'</select></label>').join('')
        + '</div><label class="watch-consent"><input type="checkbox" name="watched" required> I watched this player this season and agree to contribute my grades to anonymous public averages.</label>'
        + '<div class="vote-buttons"><button type="submit" class="button primary">'+(mine?'Update my vote':'Submit my vote')+'</button>'
        + (mine?'<button type="button" class="mini" data-eye-withdraw="'+safe(id)+'">Withdraw my vote</button>':'')
        + '</div><p class="source-note">One vote per account, player and season. Votes can be updated or withdrawn, subject to the server’s anti-spam limits.</p></form>';
    }
    return '<section id="eyePanel" class="eye-panel" data-eye-player="'+safe(id)+'">'+heading+result+traitDetails+participation+'</section>';
  }
  function authView() {
    const signedIn = !!RinkCloud.user;
    const label = document.getElementById('eyeAccountState');
    if (label) label.textContent = signedIn
      ? 'Signed in as '+RinkCloud.user.email+'. Your eye-test votes are private; only qualifying averages are public.'
      : 'Anyone can read scores. Sign in by email to submit a vote.';
    const out = document.getElementById('eyeSignedOut'), ins = document.getElementById('eyeSignedIn');
    if (out) out.hidden = signedIn;
    if (ins) ins.hidden = !signedIn;
    const error = document.getElementById('eyeSignInStatus');
    if (error && !RinkCloud.client) error.textContent = 'Account service unavailable at the moment.';
  }
  async function initialize() {
    try {
      await RinkCloud.initialize(() => { authView(); void reload(state.season); });
    } catch (error) {
      console.warn('Eye Test sign-in initialization:',error);
    }
    authView();
    await reload(state.season);
  }
  async function submit(id,form) {
    if (saving) throw Error('A vote is already being saved.');
    if (!RinkCloud.user || !RinkCloud.client) throw Error('Sign in first.');
    if (!validId(id) || !get(id) || !/^20\d{6}$/.test(state.season)) throw Error('Select a player in the current season.');
    if (!form.elements.namedItem('watched')?.checked) throw Error('Confirm that you watched this player this season.');
    const grades = {};
    for (const [key] of TRAITS) {
      const grade = Number(form.elements.namedItem(key)?.value);
      if (!Number.isInteger(grade) || grade < 1 || grade > 5) throw Error('Rate all six skills from 1 to 5.');
      grades[key] = grade;
    }
    saving = true;
    try {
      const season = state.season;
      const result = await RinkCloud.client.from('community_eye_votes').upsert(
        {user_id:RinkCloud.user.id,season_id:season,player_id:id,...grades},
        {onConflict:'user_id,season_id,player_id'}
      );
      if (result.error) throw result.error;
      await reload(season);
      return 'Your Eye Test vote was saved.';
    } finally { saving = false; }
  }
  async function withdraw(id) {
    if (saving) throw Error('A vote is already being changed.');
    if (!RinkCloud.user || !RinkCloud.client || !get(id)) throw Error('Sign in and select a valid player.');
    saving = true;
    try {
      const season=state.season;
      const result=await RinkCloud.client.from('community_eye_votes').delete()
        .eq('user_id',RinkCloud.user.id).eq('season_id',season).eq('player_id',id);
      if (result.error) throw result.error;
      await reload(season);
      return 'Your vote was withdrawn.';
    } finally {saving=false;}
  }
  function message(s) {
    const el=document.getElementById('eyeMessage');
    if(el) el.textContent=s;
  }
  document.addEventListener('submit', async event => {
    const form=event.target;
    if(form?.id!=='eyeVoteForm')return;
    event.preventDefault();
    const button=form.querySelector('[type="submit"]');button.disabled=true;
    message('Saving your Eye Test vote…');
    try {const m=await submit(form.dataset.eyePlayer,form);message(m);}
    catch(error) {message('Could not save: '+String(error.message || error).slice(0,180));button.disabled=false;}
  });
  document.addEventListener('click',async event=>{
    if(event.target.closest('[data-eye-signin]')) {
      close();
      document.getElementById('eyetest')?.scrollIntoView({behavior:'smooth',block:'start'});
      document.getElementById('eyeEmail')?.focus();
    }
    const button=event.target.closest('[data-eye-withdraw]');
    if(!button || !window.confirm('Withdraw your Eye Test vote for this season?'))return;
    button.disabled=true;message('Withdrawing your vote…');
    try {const m=await withdraw(button.dataset.eyeWithdraw);message(m);}
    catch(error) {message('Could not withdraw: '+String(error.message || error).slice(0,180));button.disabled=false;}
  });
  document.getElementById('eyeSignInForm').addEventListener('submit',async event=>{
    event.preventDefault();
    const email=document.getElementById('eyeEmail').value.trim();
    const note=document.getElementById('eyeSignInStatus');
    const button=event.target.querySelector('button[type="submit"]');
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){note.textContent='Enter a valid email address.';return;}
    button.disabled=true;note.textContent='Requesting your sign-in link…';
    try {await RinkCloud.magicLink(email);note.textContent='Check your inbox for a sign-in link. Open it on this website.';}
    catch(error){note.textContent='Sign-in error: '+String(error.message||error).slice(0,130);}
    finally{button.disabled=false;}
  });
  document.getElementById('eyeSignOut').addEventListener('click',async()=>{
    try {await RinkCloud.signOut();}
    catch(error){document.getElementById('eyeSignInStatus').textContent='Could not sign out: '+error.message;}
  });
  return {initialize,reload,score,count,panel};
})();
RinkEye.initialize();
