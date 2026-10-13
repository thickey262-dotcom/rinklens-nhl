'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const code=fs.readFileSync(path.join(__dirname,'../money.js'),'utf8');

function makePlayer(index){
 return {
  id:String(8000000+index),name:'Player '+String(index+1).padStart(3,'0'),
  team:index%2?'BUF':'NYR',pos:index%2?'C':'D',
  gp:10,g:2,a:3,p:53-index,p60:2,xgfPct:51,cfPct:51,ixG60:.3
 };
}
const handlers={};
const elements=new Map();
function element(id){
 if(!elements.has(id)){
  elements.set(id,{
   id,value:id==='season'?'20262027':id==='sort'?'advanced':'',
   textContent:'',innerHTML:'',disabled:false,hidden:false,
   selectedOptions:[{text:'2026–27'}],
   classList:{toggle(){}},
   addEventListener(type,callback){handlers[id+':'+type]=callback;},
  });
 }
 return elements.get(id);
}
let scrollCount=0;
const players=Array.from({length:53},(_,i)=>makePlayer(i));
const ctx={
 document:{
  getElementById:element,addEventListener(){},
  querySelector(){return {scrollIntoView(){scrollCount++;}}}
 },
 window:{RinkEye:null},
 RinkStats:{
  calculate(){},score(p){return p.p;},label(){return null;},reason(){return null;},
  panel(){return '';}
 },
 fetch:async url=>({ok:true,json:async()=>({
  source:'moneypuck',season:url.match(/moneypuck-(\d{8})/)[1],
  players,updatedAt:'2026-10-13T00:00:00Z'
 })}),
 console,
};
const api=vm.runInNewContext(code+'\n({state,load,render,changePage,filtered})',ctx);
const countRows=()=> (element('rows').innerHTML.match(/<tr>/g)||[]).length;
(async()=>{
 // The script starts an initial load on evaluation.
 await api.load();
 assert.equal(api.state.page,1);
 assert.equal(countRows(),25);
 assert.equal(element('pageSummary').textContent,'Showing 1–25 of 53 players');
 assert.equal(element('pageNumber').textContent,'Page 1 of 3');
 assert.equal(element('pagePrev').disabled,true);
 assert.equal(element('pageNext').disabled,false);
 assert.equal(element('pagination').hidden,false);
 assert.equal(element('results').textContent,'53 matching players · 25 per page');

 handlers['pageNext:click']();
 assert.equal(api.state.page,2);
 assert.equal(countRows(),25);
 assert.equal(element('pageSummary').textContent,'Showing 26–50 of 53 players');
 assert.equal(element('pagePrev').disabled,false);
 handlers['pageNext:click']();
 assert.equal(api.state.page,3);
 assert.equal(countRows(),3);
 assert.equal(element('pageSummary').textContent,'Showing 51–53 of 53 players');
 assert.equal(element('pageNext').disabled,true);
 handlers['pageNext:click']();
 assert.equal(api.state.page,3,'cannot move beyond final page');
 assert.equal(scrollCount,2,'only real page changes scroll to the table');
 handlers['pagePrev:click']();
 assert.equal(api.state.page,2);
 assert.equal(countRows(),25);

 // Refreshing Eye Test render or a comparison selection should keep the page.
 api.state.selected=['8000001','8000002'];
 api.render();
 assert.equal(api.state.page,2);
 assert.equal(element('rows').innerHTML.includes('Player 001'),false);

 // Search results and filters are applied BEFORE paging.
 element('search').value='Player 005';
 handlers['search:input']();
 assert.equal(api.state.page,1);
 assert.equal(countRows(),1);
 assert.equal(element('pageSummary').textContent,'Showing 1–1 of 1 players');
 assert.equal(element('pagePrev').disabled,true);
 assert.equal(element('pageNext').disabled,true);

 element('search').value='Nothing matches';
 handlers['search:input']();
 assert.equal(countRows(),1,'one explanatory empty-state row is rendered');
 assert.equal(element('pagination').hidden,true);
 assert.equal(element('pageSummary').textContent,'No matching players');

 element('search').value='';
 handlers['search:input']();
 assert.equal(countRows(),25);
 element('team').value='BUF';
 handlers['team:change']();
 assert.equal(api.state.page,1);
 assert.equal(api.filtered().length,26);
 assert.equal(countRows(),25);
 handlers['pageNext:click']();
 assert.equal(countRows(),1);
 element('position').value='D';
 handlers['position:change']();
 assert.equal(api.state.page,1);
 assert.equal(api.filtered().length,0);
 element('position').value='';
 handlers['position:change']();
 handlers['pageNext:click']();
 element('sort').value='name';
 handlers['sort:change']();
 assert.equal(api.state.page,1,'changing sort resets pagination');

 // Switching season clears the previous page before new results load.
 handlers['pageNext:click']();
 element('season').value='20252026';
 element('season').selectedOptions=[{text:'2025–26'}];
 await handlers['season:change']();
 // The season handler calls load() but doesn't return its promise.
 await Promise.resolve();await Promise.resolve();await Promise.resolve();
 assert.equal(api.state.page,1);
 assert.equal(api.state.season,'20252026');
 assert.equal(countRows(),25);
 assert.ok(code.includes('PAGE_SIZE = 25'));
 assert.ok(code.includes('allRows.slice('));
 assert.ok(!code.includes('PAGE_SIZE = 50'));
 console.log('PASS: 25 rows, partial last page, page boundaries, search/filter/sort/season reset, Eye Test render and comparison preservation.');
})().catch(err=>{console.error(err);process.exitCode=1});
