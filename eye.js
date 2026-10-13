'use strict';
/* One Eye Test rating only: verified-format community votes, never a stats-derived proxy. */
const RinkEye = (() => {
  // Shared storage fields, with position-specific scouting meanings.
  // Each submitted ballot rates all eight fields from 1 to 10.
  const TRAITS = Object.freeze({
    F: [
      ['skating','Skating & speed'],
      ['shooting','Shooting & finishing'],
      ['puck','Puck skills & playmaking'],
      ['iq','Offensive hockey IQ'],
      ['positioning','Offensive positioning'],
      ['defense','Two-way defensive play'],
      ['compete','Compete level & physicality'],
      ['transition','Transition offense']
    ],
    D: [
      ['skating','Skating & mobility'],
      ['positioning','Gap control & positioning'],
      ['defense','Defensive coverage'],
      ['iq','Defensive reads & hockey IQ'],
      ['puck','Passing & puck movement'],
      ['transition','Breakouts & transition'],
      ['compete','Board battles & physicality'],
      ['shooting','Point shots & offense']
    ]
  });
  const KEYS = ['skating','puck','iq','defense','compete','transition','shooting','positioning'];
  const ratingGroup = player => player?.pos === 'D' ? 'D' : ['C','L','R','LW','RW'].includes(player?.pos) ? 'F' : null;
  const ratingTraits = player => TRAITS[ratingGroup(player)] || [];
  const scale = Array.from({length:10},(_,i)=>i+1);
  let published = new Map(), own = new Map(), ownAccount = null, activeSeason = '', requestId = 0, saving = false, loadError = '';
  const validId = id => /^\d{6,10}$/.test(String(id));
  function score(id) {
    if (activeSeason !== state.season || !validId(id)) return null;
    return published.get(String(id))?.score ?? null;
  }
  function count(id) { return published.get(String(id))?.reviewer_count ?? 0; }
  // Private preview is based only on this signed-in user's eight saved ballot fields.
  // It is never written into community_eye_scores or visible to another account.
  function personalScore(id) {
    if (activeSeason !== state.season || !validId(id) || !RinkCloud.user ||
        RinkCloud.user.id !== ownAccount) return null;
    const ballot = own.get(String(id));
    if (!ballot || !KEYS.every(key => Number.isInteger(Number(ballot[key]))
      && Number(ballot[key]) >= 1 && Number(ballot[key]) <= 10)) return null;
    return Math.round(KEYS.reduce((sum,key)=>sum+Number(ballot[key]),0) / KEYS.length * 10);
  }
  function display(id) {
    const community = score(id), personal = personalScore(id);
    const value = community ?? personal;
    return {value,community,personal,
      label:community !== null ? 'Community Eye Test' : personal !== null ? 'Your Rating (Private)' : ''};
  }
  function hasOwn(id) { return !!RinkCloud.user && activeSeason===state.season && own.has(String(id)); }
  function publishUpdates() {
    if (typeof render === 'function') render();
    if (typeof renderCompare === 'function') renderCompare();
    const slot = document.getElementById('eyePanel');
    if (slot?.dataset?.eyePlayer) {
      const player = get(slot.dataset.eyePlayer);
      if (player) slot.outerHTML = panel(player);
    }
    const countEl = document.getElementById('eyeCoverage');
    if (countEl) countEl.textContent = published.size + ' players with community Eye Test scores this season';
    const note = document.getElementById('eyeAvailability');
    if (note) note.textContent = loadError || (published.size ? 'Public averages are shown when three reviewers qualify. Your own saved ratings are visible privately while signed in.' : 'Your saved Eye Test ratings are visible privately when you sign in. A public community average requires three different signed-in reviewers.');
  }
  async function reload(season = state.season) {
    const req = ++requestId;
    const requestedAccount = RinkCloud.user?.id ?? null;
    // Never show a previous user's private ballots or ballots for another season.
    if (season !== activeSeason || requestedAccount !== ownAccount) {
      published = new Map();
      own = new Map();
    }
    activeSeason = season;
    ownAccount = requestedAccount;
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
          .select('season_id,player_id,reviewer_count,skating,puck,iq,defense,compete,transition,shooting,positioning,score')
          .eq('season_id',season),
        RinkCloud.user
          ? client.from('community_eye_votes')
              .select('player_id,skating,puck,iq,defense,compete,transition,shooting,positioning')
              .eq('season_id',season)
          : Promise.resolve({data:[],error:null})
      ]);
      if (req !== requestId || season !== state.season || requestedAccount !== (RinkCloud.user?.id ?? null)) return;
      if (publicResult.error) throw publicResult.error;
      if (ownResult.error) throw ownResult.error;
      const publicNext = new Map();
      const ownNext = new Map();
      for (const row of publicResult.data || []) {
        if (row.season_id !== season || !validId(row.player_id)
            || Number(row.reviewer_count) < 3 || !Number.isInteger(row.score)
            || row.score < 10 || row.score > 100
            || !KEYS.every(key => Number(row[key]) >= 1 && Number(row[key]) <= 10)) continue;
        publicNext.set(String(row.player_id),row);
      }
      for (const row of ownResult.data || []) {
        if (requestedAccount && validId(row.player_id) &&
            KEYS.every(key => Number.isInteger(Number(row[key])) &&
            Number(row[key]) >= 1 && Number(row[key]) <= 10)) ownNext.set(String(row.player_id),row);
      }
      published = publicNext;
      own = ownNext;
      ownAccount = requestedAccount;
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
    const group = ratingGroup(player), traits = ratingTraits(player);
    const s = score(id), personal = personalScore(id);
    const heading = '<div class="eyebrow">VIEWER OPINION · SEPARATE FROM MONEYPUCK</div><h3>Eye Test: '+(group==='D'?'Defenseman':'Forward')+'</h3>';
    const result = '<div class="eye-result">'
      +(personal !== null ? '<p><strong class="eye-score">'+personal+'/100</strong> <span class="eye-private-label">Your Rating (Private)</span><small>Only you can see your individual rating when signed in.</small></p>' : '')
      +(s === null
        ? '<p class="eye-pending"><strong>Community score pending.</strong> A public average appears after three different signed-in viewers rate this player. '+(personal !== null ? 'Your rating has been saved.' : 'You can submit your own rating below.')+'</p>'
        : '<p><strong class="eye-score">'+s+'/100</strong> <span class="eye-public-label">Community Eye Test</span><small>Average of '+r.reviewer_count+' viewer'+(r.reviewer_count===1?'':'s')+'. Not a professional scouting grade.</small></p>')
      +'</div>';
    const traitDetails = r
      ? '<details><summary>See eight position-specific viewer averages</summary><div class="eye-traits">'+traits.map(([key,name]) => '<div><span>'+name+'</span><b>'+Number(r[key]).toFixed(1)+'/10</b></div>').join('')+'</div></details>'
      : '';
    let participation = '<p class="source-note">Eye Test is an opinion from viewers who say they watched this player. It is separate from MoneyPuck data, and contributors are not verified professional scouts.</p>';
    if (!RinkCloud.client || !RinkCloud.user) {
      participation += '<p>Rating takes about a minute after signing in.</p><button type="button" class="button primary eye-signin-action" data-eye-signin>Sign in to rate this player</button>';
    } else {
      // Explicit quick fill sets all eight grades identically, not inferred from stats.
      const quickChoices=scale.map(v=>
        '<button type="button" class="eye-quick-btn" data-eye-fill="'+v+'" aria-label="Apply '+v+' out of 10 to all eight skills">'
        +v+'</button>').join('');
      const traitChoices=traits.map(([key,name])=>
        '<fieldset class="eye-trait"><legend>'+name+'</legend><div class="eye-grade-options">'
        +scale.map(v=>'<label class="eye-grade">'
          +'<input type="radio" name="'+key+'" value="'+v+'" required'+(Number(mine?.[key])===v?' checked':'')+'>'
          +'<span>'+v+'</span></label>').join('')
        +'</div></fieldset>').join('');
      participation += '<form id="eyeVoteForm" data-eye-player="'+safe(id)+'"><h4>'+(mine?'Update your Eye Test rating':'Give your Eye Test rating')+'</h4>'
        +(mine?'<p class="eye-saved"><strong>You rated this player.</strong> Change any grade below and save again.</p>':'<p>Give each '+(group==='D'?'defenseman':'forward')+' skill a 1–10 grade based on games you actually watched.</p>')
        +'<fieldset class="eye-quick"><legend>Quick fill (optional)</legend>'
        +'<p>Want the same grade for every skill? Tap a number, then adjust any individual skills below. This applies <strong>that exact grade to all eight traits</strong>.</p>'
        +'<div class="eye-quick-options">'+quickChoices+'</div>'
        +'<p id="eyeQuickStatus" class="source-note" aria-live="polite"></p></fieldset>'
        +'<p class="eye-scale">1 = Poor · 3 = Below average · 5 = Average · 7 = Good · 9 = Excellent · 10 = Elite</p>'
        +'<div class="vote-grid">'+traitChoices+'</div>'
        +'<label class="watch-consent"><input type="checkbox" name="watched" required> I watched this player this season and agree to include my ratings in anonymous public averages.</label>'
        +'<div class="vote-buttons"><button type="submit" class="button primary">'+(mine?'Save updated rating':'Save Eye Test rating')+'</button>'
        +(mine?'<button type="button" class="mini" data-eye-withdraw="'+safe(id)+'">Withdraw my vote</button>':'')
        +'</div><p class="source-note">One vote per signed-in account, player and season. You can update or withdraw your vote. Individual ratings stay private; only averages with three or more accounts become public.</p></form>';
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
    if (!validId(id) || !ratingGroup(get(id)) || !/^20\d{6}$/.test(state.season)) throw Error('Select a player in the current season.');
    if (!form.elements.namedItem('watched')?.checked) throw Error('Confirm that you watched this player this season.');
    const grades = {};
    for (const key of KEYS) {
      const grade = Number(form.elements.namedItem(key)?.value);
      if (!Number.isInteger(grade) || grade < 1 || grade > 10) throw Error('Rate all eight position-specific skills from 1 to 10.');
      grades[key] = grade;
    }
    saving = true;
    try {
      const season = state.season, currentUser = RinkCloud.user.id;
      const result = await RinkCloud.client.from('community_eye_votes').upsert(
        {user_id:RinkCloud.user.id,season_id:season,player_id:id,...grades},
        {onConflict:'user_id,season_id,player_id'}
      );
      if (result.error) throw result.error;
      // Immediately show this authenticated user's saved rating, even before
      // the public 3-reviewer threshold is reached.
      if (season === state.season && RinkCloud.user?.id === currentUser) {
        ownAccount = currentUser;
        own.set(String(id),{player_id:String(id),...grades});
        publishUpdates();
      }
      await reload(season);
      return 'Your Eye Test rating was saved. Your private score is visible now; the community score requires three reviewers.';
    } finally { saving = false; }
  }
  async function withdraw(id) {
    if (saving) throw Error('A vote is already being changed.');
    if (!RinkCloud.user || !RinkCloud.client || !get(id)) throw Error('Sign in and select a valid player.');
    saving = true;
    try {
      const season=state.season, currentUser=RinkCloud.user.id;
      const result=await RinkCloud.client.from('community_eye_votes').delete()
        .eq('user_id',RinkCloud.user.id).eq('season_id',season).eq('player_id',id);
      if (result.error) throw result.error;
      if (season === state.season && RinkCloud.user?.id === currentUser) {
        own.delete(String(id));
        publishUpdates();
      }
      await reload(season);
      return 'Your Eye Test vote was withdrawn.';
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
    const fillButton=event.target.closest('[data-eye-fill]');
    if(fillButton) {
      const form=fillButton.closest('#eyeVoteForm');
      const grade=Number(fillButton.dataset.eyeFill);
      if(form && Number.isInteger(grade) && grade>=1 && grade<=10) {
        for(const trait of KEYS) {
          const radio=form.querySelector('input[name="'+trait+'"][value="'+grade+'"]');
          if(radio)radio.checked=true;
        }
        const status=form.querySelector('#eyeQuickStatus');
        if(status)status.textContent='All eight skills set to '+grade+'/10. Review them individually, confirm you watched, then save.';
      }
      return;
    }
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
  return {initialize,reload,score,count,hasOwn,personalScore,display,panel,ratingGroup,ratingTraits,KEYS};
})();
// The player table uses window.RinkEye to display scores and open direct rating.
window.RinkEye = RinkEye;
RinkEye.initialize();
