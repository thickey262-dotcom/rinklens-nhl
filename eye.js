'use strict';
/* Separate real human Eye Test ballots from a clearly labeled stat-anchored automated ranking. */
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
  const cap=(value,stat)=>Math.max(0,Math.min(100,
    Math.max(stat-5,Math.min(stat+5,value))));
  function display(id) {
    const community=score(id),personal=personalScore(id);
    const player=get(id);
    const rawBase=(typeof RinkBase!=='undefined' ? RinkBase.score(player) : null);
    const reference=(typeof RinkStats!=='undefined'&&typeof RinkStats.anchor==='function')
      ? RinkStats.anchor(player) : null;
    // The automated ranking is *intentionally* derived from, and restricted
    // to +/-5 of, the Advanced Stats Score (or labeled provisional reference).
    // Never pretend this is independent film/scout observation.
    const starting=reference?cap(rawBase??reference.score,reference.score):rawBase;
    const extra=reference && typeof RinkLenses!=='undefined'
      ? RinkLenses.forPlayer(player) : null;
    const extraScores=extra?.components||[];
    // One existing baseline plus five distinct, labeled statistical lenses.
    // These are correlated calculations, NOT five independent film reviews.
    const base=starting!==null && extraScores.length===5
      ?cap(Math.round((starting+extraScores.reduce((sum,m)=>sum+m.score,0))/6),reference.score)
      :starting;
    const voters=count(id);
    const isPublic=community!==null;
    const human=isPublic?community:personal;
    const humanWeight=human===null?0:isPublic
      ? (voters>=5?0.70:voters===4?0.60:0.50)
      : 0.30;
    const unboundedValue=human===null?base:base===null?human:
      Math.round(base*(1-humanWeight)+human*humanWeight);
    const value=reference&&unboundedValue!==null
      ?cap(unboundedValue,reference.score):unboundedValue;
    const label=isPublic?'Combined Eye Test ('+voters+' reviewers)'
      : personal!==null?'Your Combined Preview (Private)'
      : reference?(reference.provisional?'Eye Test · Provisional starting estimate':'Eye Test · RinkLens starting estimate')
      : base!==null?'Formula Baseline · No public reviews':'';
    // RinkLens supplies one clearly marked MODEL contribution for any player
    // with a statistical estimate. It is never an authenticated human ballot,
    // never inserted in Supabase, and NEVER satisfies the 3-human-vote gate.
    const modelEntries=base!==null?(extraScores.length===5?6:1):0;
    const publicFanEntries=isPublic?voters:0;
    return {value,base,rawBase,community,personal,reviewers:voters,
      humanWeight,label,isPrivate:!isPublic&&personal!==null,
      advancedAnchor:reference?.score??null,provisional:reference?.provisional??false,
      anchored:reference!==null,unboundedValue,
      modelEntries,publicFanEntries,visibleEntries:modelEntries+publicFanEntries,
      modelExtra:extraScores,top100:extra?.rank??null,
      ownPrivateEntry:!isPublic&&personal!==null?1:0};
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
    if (countEl){
      const modelCount=(state.players||[]).filter(p=>display(p.id).modelEntries>0).length;
      const enriched=(state.players||[]).filter(p=>display(p.id).modelEntries===6).length;
      countEl.textContent=modelCount+' skaters with one Eye Test ranking · '+enriched
        +' top-100 players with five extra statistical evaluations · '+published.size
        +' with eligible public fan feedback. RinkLens models do not count as human voters.';
    }
    const note = document.getElementById('eyeAvailability');
    if (note) note.textContent = loadError || (published.size
      ? 'One Eye Test ranking per player: a RinkLens statistical starting point, updated with eligible fan grades. Public fan feedback requires three people.'
      : 'One Eye Test ranking per player starts with the RinkLens statistical model. Your fan grade can update your private preview; three human votes are needed for the public blend.');
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
    const s=score(id),personal=personalScore(id),merged=display(id);
    const heading='<div class="eyebrow">ONE EYE TEST RANKING · RINKLENS + REAL FANS</div>'
      +'<h3>Eye Test: '+(group==='D'?'Defenseman':'Forward')+'</h3>';
    const sources=merged.modelEntries
      ? (merged.modelEntries===6?'6 RinkLens statistical evaluations (including five extra for the top 100)':'1 RinkLens statistical evaluation')
        +' · all model-generated, not people'
        +(merged.publicFanEntries?' + '+merged.publicFanEntries+' published fan review'+(merged.publicFanEntries===1?'':'s'):' · public fan average pending')
      : (merged.publicFanEntries?merged.publicFanEntries+' published fan reviews':'No reliable model estimate available');
    const result='<div class="eye-result">'
      +(merged.value!==null
        ? '<p class="eye-unified-score"><strong class="eye-score">'+merged.value+'/100</strong> '
          +'<span class="'+(merged.isPrivate?'eye-private-label':'eye-public-label')+'">'
          +merged.label+'</span></p>'
        : '<p><strong>Eye Test ranking unavailable:</strong> insufficient statistics and no qualifying fan feedback.</p>')
      +'<p class="eye-source-summary"><strong>Contributions:</strong> '+sources+'.</p>'
      +(personal!==null?'<p class="eye-private-note">Your fan grade is saved and visible only to you; '
          +(s!==null?'it is included in the qualified fan average.':'your private Eye Test preview includes it.')+'</p>':'')
      +(s===null?'<p class="eye-pending">Fan average pending: at least three distinct real reviewers are required before fan feedback affects the public ranking.</p>':'')
      +(merged.modelExtra.length===5?'<details class="eye-merge-details"><summary>Five extra statistical perspectives for top-100 players</summary>'
        +'<p>These are alternate weightings of the same season’s verified five-on-five statistics, not separate fan reviews or new scouting observations. They contribute to the one RinkLens starting estimate alongside the original formula, with each model component bounded to five points from the advanced reference.</p>'
        +'<p><strong>Statistical perspectives:</strong> '+merged.modelExtra.map(x=>x.name).join(' · ')+'</p></details>':'')
      +'<details class="eye-merge-details"><summary>How the one Eye Test ranking is calculated</summary>'
      +'<p>RinkLens starts with a position-based statistical estimate, then combines it with actual fan grades when eligible. With no fan ratings, it is a <strong>model-generated estimate, not a scouting observation</strong>. '
      +(merged.modelExtra.length===5?'For top-100 players, the model starting value is the equal average of six correlated statistical evaluations: the original baseline plus five alternate metric-weighted perspectives. For other skaters the starting value uses the original formula alone. ':'')
      +'One signed-in fan can see a private preview (70% model / 30% personal grade); '
      +'with three qualifying reviewers the public score uses 50% model / 50% fan average; '
      +'four use 40% model / 60% fans, and five or more use 30% model / 70% fans.</p>'
      +'<p>The displayed Eye Test ranking stays within 5 points of the qualified Advanced Stats Score (or clearly labeled provisional small-sample reference). '
      +'The original fan ballots remain unmodified, are not counted as model votes and never become public until three real reviewers qualify. '
      +'This is one combined ranking, not two competing Eye Test scores.</p></details>'
      +'</div>';
    const traitDetails = r
      ? '<details><summary>See eight position-specific viewer averages</summary><div class="eye-traits">'+traits.map(([key,name]) => '<div><span>'+name+'</span><b>'+Number(r[key]).toFixed(1)+'/10</b></div>').join('')+'</div></details>'
      : '';
    let participation = '<p class="source-note">Your authentic fan grade contributes to the same Eye Test ranking once eligible. The RinkLens model is not a human voter, and no model grade is stored as a fan submission. Fan ballots are private and unmodified; contributors are not verified professional scouts.</p>';
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
      return 'Your Eye Test grade was saved. Your combined preview has updated. A public community average needs three reviewers.';
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
