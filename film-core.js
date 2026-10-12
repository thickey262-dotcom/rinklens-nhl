'use strict';
/* Pure, testable film-review helpers. Do not infer traits without actual observed evidence. */
const RinkFilmCore=(()=>{
  const TRAITS=['skating','puck','iq','defense','compete','transition'];
  function labelTime(seconds){
    if(!Number.isFinite(Number(seconds))||Number(seconds)<0)return '0:00';
    const n=Math.floor(Number(seconds));
    return Math.floor(n/60)+':'+String(n%60).padStart(2,'0');
  }
  function samplingTimes(start,end,count=6){
    if(!Number.isFinite(start)||!Number.isFinite(end)||end-start<2||count<2||count>8)return [];
    const length=end-start;
    return Array.from({length:count},(_,i)=>Math.round((start+0.08*length+(i/(count-1))*0.84*length)*10)/10);
  }
  function validSelection(payload){
    if(!payload||typeof payload!=='object')return false;
    if(!/^[0-9]{6,10}$/.test(String(payload.playerId||'')))return false;
    if(!/^20[0-9]{6}$/.test(String(payload.season||'')))return false;
    if(!/^.{1,100}$/.test(String(payload.playerName||'')))return false;
    if(!/^.{1,20}$/.test(String(payload.identifier||'')))return false;
    if(!Array.isArray(payload.frames)||payload.frames.length<2||payload.frames.length>8)return false;
    return payload.frames.every(x=>x&&Number.isFinite(x.time)&&x.time>=0&&x.time<=7200
      &&typeof x.image==='string'&&/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(x.image)
      &&x.image.length<=380000);
  }
  function scrubAnalysis(value,frameTimes=[]){
    if(!value||typeof value!=='object')return {status:'unverified',findings:[],summary:'No usable film assessment was returned.'};
    const findings=[];
    for(const item of Array.isArray(value.findings)?value.findings:[]){
      if(!TRAITS.includes(item?.trait)||!Array.isArray(item.evidence))continue;
      const evidence=item.evidence.filter(e=>Number.isFinite(e?.time)&&
        frameTimes.some(t=>Math.abs(t-e.time)<0.12)&&
        typeof e?.observation==='string'&&e.observation.trim().length>3)
        .slice(0,3).map(e=>({time:e.time,observation:e.observation.slice(0,240)}));
      if(!evidence.length)continue;
      const confidence=['low','medium','high'].includes(item.confidence)?item.confidence:'low';
      const score=Number.isInteger(item.score)&&item.score>=1&&item.score<=5&&confidence!=='low'?item.score:null;
      findings.push({trait:item.trait,score,confidence,evidence,explanation:String(item.explanation||'').slice(0,280)});
    }
    const identityConfirmed=value.identityConfirmed===true;
    if(!identityConfirmed)for(const item of findings)item.score=null;
    return {
      status:identityConfirmed?'review-required':'identity-unverified',
      identityConfirmed,summary:String(value.summary||'').slice(0,600),
      findings:findings.slice(0,6)
    };
  }
  return {TRAITS,labelTime,samplingTimes,validSelection,scrubAnalysis};
})();
