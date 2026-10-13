'use strict';
/* Readability settings are browser-local; scouting data and scores are untouched. */
const RinkReadability=(()=>{
  const key='rinklens-large-text-v1';
  const largeButton=document.getElementById('textSizeToggle');
  const advancedButton=document.getElementById('advancedColumnsToggle');
  const table=document.getElementById('playerTable');
  let large=false;
  try{large=localStorage.getItem(key)==='true'}catch{}
  function setLarge(value){
    large=Boolean(value);
    document.body.classList.toggle('large-text',large);
    if(largeButton){
      largeButton.setAttribute('aria-pressed',String(large));
      largeButton.setAttribute('aria-label',large?'Use standard text size':'Use larger text size');
      largeButton.textContent=large?'A− Standard text':'A+ Larger text';
    }
    try{localStorage.setItem(key,String(large))}catch{}
  }
  function setAdvanced(value){
    if(!table||!advancedButton)return;
    const show=Boolean(value);
    table.classList.toggle('show-advanced',show);
    advancedButton.setAttribute('aria-pressed',String(show));
    advancedButton.textContent=show?'Hide advanced stats':'Show advanced stats';
  }
  setLarge(large);
  setAdvanced(false);
  largeButton?.addEventListener('click',()=>setLarge(!large));
  advancedButton?.addEventListener('click',()=>setAdvanced(!table.classList.contains('show-advanced')));
  document.addEventListener('keydown',event=>{
    if(event.key!=='Enter'&&event.key!==' ')return;
    const target=event.target?.closest?.('[data-open][role="button"]');
    if(!target)return;
    event.preventDefault();
    target.click();
  });
  return {setLarge,setAdvanced};
})();
