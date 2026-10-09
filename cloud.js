'use strict';
/* Optional Supabase account sync. No account or external JS library is needed when unconfigured. */
const RinkCloud = (() => {
  const config = window.RINKLENS_CONFIG || {};
  let client = null, user = null, sessionListener = null;
  const configured = () => /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test((config.supabaseUrl || '').trim()) &&
    typeof config.supabasePublishableKey === 'string' && config.supabasePublishableKey.length > 15;
  function loadClient() {
    return new Promise((resolve, reject) => {
      if (window.supabase?.createClient) return resolve(window.supabase);
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js';
      script.async = true;
      script.onload = () => window.supabase?.createClient ? resolve(window.supabase) : reject(new Error('Supabase library unavailable'));
      script.onerror = () => reject(new Error('Unable to load the Supabase library'));
      document.head.appendChild(script);
    });
  }
  async function initialize(onChange) {
    sessionListener = onChange;
    if (!configured()) return false;
    const lib = await loadClient();
    client = lib.createClient(config.supabaseUrl.trim(), config.supabasePublishableKey.trim(), {
      auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true }
    });
    const {data, error} = await client.auth.getSession();
    if (error) throw error;
    user = data.session?.user || null;
    client.auth.onAuthStateChange((event, session) => {
      const next = session?.user || null;
      if (user?.id !== next?.id) {
        user = next;
        setTimeout(() => sessionListener?.(user), 0);
      }
    });
    return true;
  }
  async function magicLink(email) {
    if (!client) throw new Error('Cloud service is not configured');
    const redirect = `${location.origin}${location.pathname}`;
    const {error} = await client.auth.signInWithOtp({email, options: {emailRedirectTo: redirect}});
    if (error) throw error;
  }
  async function signOut() {
    if (!client) return;
    const {error} = await client.auth.signOut();
    if (error) throw error;
  }
  async function read(season) {
    if (!user) throw new Error('Please sign in');
    const [r,w] = await Promise.all([
      client.from('scouting_reports').select('player_id,skating,puck,iq,defense,compete,transition,notes,updated_at').eq('season_id', season),
      client.from('watchlist').select('player_id').eq('season_id', season)
    ]);
    if (r.error) throw r.error;
    if (w.error) throw w.error;
    return {reports:r.data || [],watch:(w.data || []).map(item => String(item.player_id))};
  }
  async function saveReport(season, playerId, report) {
    if (!user) throw new Error('Please sign in');
    const fields = Object.fromEntries(['skating','puck','iq','defense','compete','transition'].map(k => [k, Number(report[k])]));
    const {error} = await client.from('scouting_reports').upsert({
      user_id:user.id, season_id:season, player_id:String(playerId), ...fields,
      notes:String(report.notes || ''), updated_at:new Date().toISOString()
    }, {onConflict:'user_id,season_id,player_id'});
    if (error) throw error;
  }
  async function setWatch(season, playerId, enabled) {
    if (!user) throw new Error('Please sign in');
    const query = client.from('watchlist');
    const {error} = enabled ?
      await query.upsert({user_id:user.id, season_id:season, player_id:String(playerId)}, {onConflict:'user_id,season_id,player_id'}):
      await query.delete().eq('season_id', season).eq('player_id', String(playerId));
    if (error) throw error;
  }
  return {configured, initialize, magicLink, signOut, read, saveReport, setWatch, get user(){return user}, get client(){return client}};
})();