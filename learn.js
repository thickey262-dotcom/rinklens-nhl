'use strict';
/* RinkLens Stats School: standalone, explanatory, hypothetical examples only. */
(() => {
  const stats = [
    {id:'corsi',abbrev:'CF%',name:'Corsi For Percentage',category:'Possession',summary:'Who is taking more shot attempts?',short:'Share of all attempts, including blocked and missed shots.',formula:'CF ÷ (CF + CA) × 100',fields:[['for','Attempts for',60,0,9999],['against','Attempts against',40,0,9999]],type:'share',unit:'%',explain:'At 60 attempts for and 40 against, your team had 60% of the shot attempts while the player was on the ice.',watch:'Watch whether the team keeps play in the offensive zone and gets pucks toward the net.',caution:'It is a shot-attempt proxy, not a stopwatch of actual puck possession. Score effects, teammates and competition change the picture.',friend:'“They controlled the shot-attempt battle, even if the scoreboard didn’t show it.”'},
    {id:'fenwick',abbrev:'FF%',name:'Fenwick For Percentage',category:'Possession',summary:'What if you ignore blocked shots?',short:'The share of unblocked shot attempts.',formula:'FF ÷ (FF + FA) × 100',fields:[['for','Unblocked for',38,0,9999],['against','Unblocked against',30,0,9999]],type:'share',unit:'%',explain:'Fenwick removes blocked shots from the shot-attempt count, leaving on-net and missed shots.',watch:'Watch if shots are getting through traffic toward the goal rather than being blocked.',caution:'Neither Fenwick nor Corsi directly measures chance quality.',friend:'“They got more unblocked pucks toward the net.”'},
    {id:'xg',abbrev:'xG',name:'Expected Goals',category:'Chance quality',summary:'How dangerous were those chances?',short:'Add the goal probabilities assigned to shots.',formula:'Shot 1 xG + Shot 2 xG + Shot 3 xG',fields:[['s1','Shot 1 probability',0.04,0,1],['s2','Shot 2 probability',0.17,0,1],['s3','Shot 3 probability',0.28,0,1]],type:'sum',unit:' xG',explain:'Three shots worth 0.04, 0.17 and 0.28 xG add to 0.49 expected goals. That is a total expectation, not a promise of half a goal.',watch:'Watch slot passes, lateral puck movement, rebound opportunities, screens, and shot location.',caution:'Different providers use different models and inputs. xG does not capture every piece of skill or context.',friend:'“They didn’t just shoot more—they created more dangerous looks.”'},
    {id:'xgf',abbrev:'xGF%',name:'Expected Goals For Percentage',category:'Chance quality',summary:'Who owned the quality of chances?',short:'A team’s share of total expected goals while on the ice.',formula:'xGF ÷ (xGF + xGA) × 100',fields:[['for','Expected goals for',2.6,0,9999],['against','Expected goals against',1.4,0,9999]],type:'share',unit:'%',explain:'An xGF% of 65% means 65% of the combined expected goals came from chances created by that side, in this example.',watch:'Watch whether the player helps drive quality chances and limits slot chances against.',caution:'An on-ice share belongs to five skaters and the matchups, not solely to the player. Compare the same game situation (such as 5v5).',friend:'“They won the expected-goal share; the chances were better, not just more frequent.”'},
    {id:'hdcf',abbrev:'HDCF%',name:'High-Danger Chance Share',category:'Chance quality',summary:'Who is winning the dangerous ice?',short:'Share of the high-danger chances created.',formula:'HDCF ÷ (HDCF + HDCA) × 100',fields:[['for','High-danger for',12,0,9999],['against','High-danger against',8,0,9999]],type:'share',unit:'%',explain:'12 chances for out of 20 total high-danger chances gives a 60% share.',watch:'Look for attacks into the inner slot and for defensive protection of the middle of the ice.',caution:'High-danger definitions vary by provider. A count does not weigh every chance equally.',friend:'“They owned the slot areas where goals are likelier.”'},
    {id:'p60',abbrev:'P/60',name:'Points Per 60 Minutes',category:'Context',summary:'How much did they produce for their ice time?',short:'Points normalized to 60 minutes of total ice time.',formula:'Points ÷ Ice time in minutes × 60',fields:[['points','Points',22,0,9999],['minutes','Ice time (minutes)',700,0,200000]],type:'rate',unit:' P/60',explain:'A player with 22 points in 700 minutes has 1.89 points per 60 minutes of ice time.',watch:'Look for who is creating chances per shift, then check whether the production is 5v5 or on the power play.',caution:'Small samples, power-play usage, teammates and sheltered minutes can inflate a rate.',friend:'“He produces at a strong rate when he actually gets on the ice.”'},
    {id:'pdo',abbrev:'PDO',name:'Shooting + Save Percentage',category:'Context',summary:'Did goals go in at an unusual rate?',short:'On-ice shooting percentage plus save percentage.',formula:'On-ice Sh% + On-ice Sv%',fields:[['shoot','On-ice shooting %',10.5,0,100],['save','On-ice save %',92.1,0,100]],type:'pdo',unit:' PDO',explain:'10.5% shooting plus 92.1% save percentage gives a PDO of 102.6 (some sources display 1.026).',watch:'Watch for repeatable shooting talent, goaltending performances and unsustainable scoring streaks.',caution:'PDO above 100 is not automatically “luck.” Talent and shot quality affect it, too. Avoid treating it as a verdict.',friend:'“Their percentages are running hot; I’d check if that holds up.”'},
    {id:'gsax',abbrev:'GSAx',name:'Goals Saved Above Expected',category:'Goaltending',summary:'Did the goalie beat the shot-quality expectation?',short:'Expected goals against minus goals actually allowed.',formula:'Expected goals against − Actual goals against',fields:[['expected','Expected goals against',28.4,0,9999],['actual','Goals allowed',23,0,9999]],type:'difference',unit:' GSAx',explain:'If the model expects 28.4 goals against and the goalie allows 23, that is +5.4 goals saved above expected.',watch:'Look for difficult saves, rebound control, traffic management, and whether the team suppresses chances.',caution:'Results depend on the xG model and shot data; small samples are noisy. A positive number is not an isolated measurement of talent.',friend:'“He’s saved more goals than the shot-quality model expected.”'}
  ];
  const questions = [
    {q:'A team has 58% CF at 5v5. What does that actually say?',opts:['They held the puck for exactly 58% of the time.','They took 58% of the combined shot attempts.','They scored 58% of the goals.'],answer:1,why:'Corsi counts shot attempts. It is used as a proxy for territorial play, not timed puck possession.'},
    {q:'A team generated 2.8 xG but scored once. What is the safest takeaway?',opts:['They created chances that the model valued at 2.8 goals on average.','They deserved exactly three goals.','The goalie definitely got lucky.'],answer:0,why:'xG sums estimated shot probabilities; it does not guarantee a particular goal total or prove why actual goals differed.'},
    {q:'A player has 64% on-ice xGF%. Does it mean they alone caused all the chances?',opts:['Yes—xGF% is an individual attribution metric.','No—five skaters, teammates, opponents and usage matter.','It means the player took 64% of their team’s shots.'],answer:1,why:'On-ice share is a team-on-ice outcome, not an isolated causal grade for a player.'},
    {q:'A goalie has +6 GSAx. What does that mean?',opts:['They allowed six more goals than expected.','They posted a .906 save percentage.','They allowed six fewer goals than the model expected.'],answer:2,why:'GSAx = xGA − actual goals allowed. Positive indicates fewer goals allowed than the model expected.'}
  ];
  const root=document.querySelector('#view-learn');
  if(!root)return;
  const q=s=>root.querySelector(s);
  let selected='corsi',filter='All',query='',idx=0,chosen=null,score=0,complete=false;
  const categories=['All','Possession','Chance quality','Context','Goaltending'];
  const fmt=(x,d=1)=>Number.isFinite(x)?x.toFixed(d):'—';
  function calculate(stat,vals){
    if(vals.some(v=>!Number.isFinite(v)||v<0))return null;
    if(stat.type==='share'){const total=vals[0]+vals[1];return total>0?vals[0]/total*100:null}
    if(stat.type==='sum')return vals.reduce((a,b)=>a+b,0);
    if(stat.type==='rate')return vals[1]>0?vals[0]/vals[1]*60:null;
    if(stat.type==='pdo')return vals[0]+vals[1];
    if(stat.type==='difference')return vals[0]-vals[1];
    return null;
  }
  function renderFilters(){
    q('#learnFilters').innerHTML=categories.map(cat=>`<button type="button" class="learn-filter ${cat===filter?'is-current':''}" data-learn-filter="${cat}" aria-pressed="${cat===filter}">${cat}</button>`).join('');
  }
  function renderCards(){
    const shown=stats.filter(s=>(filter==='All'||s.category===filter)&&(!query||`${s.name} ${s.abbrev} ${s.summary} ${s.short}`.toLowerCase().includes(query)));
    q('#learnCards').innerHTML=shown.length?shown.map(s=>`<button type="button" class="learn-stat-card ${s.id===selected?'selected':''}" data-learn-stat="${s.id}" aria-pressed="${s.id===selected}"><span class="learn-stat-head"><span class="learn-acronym">${s.abbrev}</span><span class="learn-category">${s.category}</span></span><strong>${s.name}</strong><span class="learn-short">${s.summary}</span><span class="learn-card-more">Learn & try it →</span></button>`).join(''):'<div class="learn-empty">No stats matched your search. Try “xG”, “goals”, or “shots”.</div>';
  }
  function renderDetail(){
    const stat=stats.find(s=>s.id===selected);
    if(!stat)return;
    q('#learnDetail').innerHTML=`<div class="learn-detail-top"><span class="eyebrow">STAT BREAKDOWN · ${stat.category.toUpperCase()}</span><span class="learn-example-tag">HYPOTHETICAL EXAMPLE</span></div><h3>${stat.name} <span>${stat.abbrev}</span></h3><p class="learn-lead">${stat.short}</p><div class="learn-formula"><span>THE MATH</span><strong>${stat.formula}</strong></div><div class="learn-worked"><h4>Change the numbers</h4><p>Enter your own example values and see the result update instantly.</p><div class="learn-inputs">${stat.fields.map(([key,label,value,min,max])=>`<label class="learn-number-label"><span>${label}</span><input type="number" inputmode="decimal" step="any" min="${min}" max="${max}" data-example-field="${key}" value="${value}"></label>`).join('')}</div><div class="learn-result"><div><span>YOUR RESULT</span><strong id="learnResult" aria-live="polite"></strong></div><p id="learnResultText"></p></div></div><div class="learn-readout"><div><h4>👀 What to look for</h4><p>${stat.watch}</p></div><div><h4>⚠️ Don't overclaim it</h4><p>${stat.caution}</p></div></div><div class="learn-friendline"><span>SOUND SMARTER WITH YOUR FRIENDS</span><p>${stat.friend}</p></div>`;
    const inputs=[...q('#learnDetail').querySelectorAll('[data-example-field]')];
    function update(){
      const vals=inputs.map(inp=>inp.value.trim()===''?NaN:Number(inp.value));
      let invalid=vals.some((v,i)=>!Number.isFinite(v)||v<Number(inputs[i].min)||v>Number(inputs[i].max));
      const result=invalid?null:calculate(stat,vals);
      q('#learnResult').textContent=result===null?'—':`${result>=0&&stat.type==='difference'?'+':''}${fmt(result,stat.type==='sum'?2:stat.type==='rate'?2:1)}${stat.unit}`;
      q('#learnResultText').textContent=result===null?'Enter valid numbers. Percentages must be 0–100, and a share needs at least one attempt.':stat.type==='share'?(result===50?'The two sides split this metric evenly.':`This side accounted for ${fmt(result)}% of the total in your example.`):stat.type==='sum'?'This is the sum of the three hypothetical shot probabilities.':stat.type==='rate'?'Rate per 60 minutes of ice time, not per game.':stat.type==='pdo'?'A rough on-ice percentage check. Not a pure luck score.':stat.type==='difference'?'Positive = fewer goals allowed than expected. Negative = more than expected.':'';
      inputs.forEach((inp,i)=>inp.setAttribute('aria-invalid',String(!Number.isFinite(vals[i])||vals[i]<Number(inp.min)||vals[i]>Number(inp.max))));
    }
    inputs.forEach(inp=>inp.addEventListener('input',update));update();
  }
  function showStat(id){if(!stats.some(s=>s.id===id))return;selected=id;renderCards();renderDetail();}
  function renderQuiz(){
    const el=q('#learnQuiz');
    if(complete){el.innerHTML=`<div class="learn-quiz-score"><span>FINAL SCORE</span><strong>${score} / ${questions.length}</strong><p>${score===questions.length?'You know how to talk stats without overclaiming them.':'You are getting the hang of it. Review the cards and try again.'}</p><button type="button" class="primary-button" id="learnRestart">Try again ↻</button></div>`;return;}
    const item=questions[idx];
    el.innerHTML=`<div class="learn-quiz-top"><span>QUESTION ${idx+1} / ${questions.length}</span><span>${score} right so far</span></div><div class="learn-quiz-progress"><div style="width:${(idx/questions.length)*100}%"></div></div><h3>${item.q}</h3><div class="learn-choices">${item.opts.map((o,i)=>`<button type="button" class="learn-choice ${chosen===i?'is-picked':''} ${chosen!==null&&i===item.answer?'is-right':''} ${chosen===i&&i!==item.answer?'is-wrong':''}" data-learn-answer="${i}" ${chosen!==null?'disabled':''}>${String.fromCharCode(65+i)}. ${o}</button>`).join('')}</div>${chosen===null?'':`<p class="learn-explanation" role="status"><strong>${chosen===item.answer?'Correct!':'Not quite.'}</strong> ${item.why}</p><button type="button" class="primary-button" id="learnNext">${idx===questions.length-1?'See your score →':'Next question →'}</button>`}`;
  }
  q('#learnSearch').addEventListener('input',e=>{query=e.target.value.trim().toLowerCase();renderCards()});
  root.addEventListener('click',e=>{
    const category=e.target.closest('[data-learn-filter]');if(category){filter=category.dataset.learnFilter;renderFilters();renderCards();return;}
    const stat=e.target.closest('[data-learn-stat]');if(stat){showStat(stat.dataset.learnStat);return;}
    const answer=e.target.closest('[data-learn-answer]');if(answer&&chosen===null){chosen=Number(answer.dataset.learnAnswer);if(chosen===questions[idx].answer)score++;renderQuiz();return;}
    if(e.target.closest('#learnNext')){if(idx===questions.length-1){complete=true;}else{idx++;chosen=null;}renderQuiz();return;}
    if(e.target.closest('#learnRestart')){idx=0;score=0;chosen=null;complete=false;renderQuiz();}
  });
  renderFilters();renderCards();renderDetail();renderQuiz();
})();