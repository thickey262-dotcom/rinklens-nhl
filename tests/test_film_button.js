'use strict';
/* Mock browser DOM smoke test: verify Film Lab status text and button wiring.
   No network or private API key is needed. */
const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
assert(html.includes('id="filmCheckResult"'),'visible status exists in HTML');
assert(html.includes('film.js?v=20261012-connection-fix'),'new script cache-bust is referenced');
const nodes=new Map();
function node(id){
 const n={id,handlers:{},dataset:{},disabled:false,textContent:'',value:'',options:[],
   addEventListener(event,callback){this.handlers[event]=callback;},
   replaceChildren(...items){this.options=items;},
   add(item){this.options.push(item);}};
 nodes.set(id,n);return n;
}
const ids=['filmFile','filmVideo','filmCapture','filmSample','filmAddNote','filmCheckGemini',
 'filmAnalyze','filmExport','filmPlayer','filmObservations','filmFrames','filmFrameCount',
 'filmAIResults','filmStatus','filmCheckResult'];
ids.forEach(node);
const cloud={configured:()=>false,user:null,client:null};
const ctx={
 document:{getElementById:id=>nodes.get(id)||null,addEventListener(){}},
 window:{addEventListener(){}},
 Option:function(text,value){return {text,value}},
 RinkFilmCore:{labelTime:()=>'',TRAITS:[]},
 RinkCloud:cloud,
 S:{players:[],season:'20262027'},
 clearTimeout,setTimeout,URL,Blob,console
};
vm.createContext(ctx);
const js=fs.readFileSync(path.join(root,'film.js'),'utf8');
vm.runInContext(js,ctx);
const button=nodes.get('filmCheckGemini'),display=nodes.get('filmCheckResult'),status=nodes.get('filmStatus');
assert.equal(typeof button.handlers.click,'function','click handler must be attached');
(async()=>{
 await button.handlers.click();
 assert.match(display.textContent,/not signed in/i,'unsigned user sees reason next to button');
 assert.equal(status.textContent,display.textContent);
 cloud.configured=()=>true;cloud.user={id:'fake-account'};
 cloud.client={functions:{invoke:async() => ({data:{ready:true,model:'gemini-2.5-flash-lite'},error:null})}};
 await button.handlers.click();
 assert.match(display.textContent,/CONNECTED/i,'signed-in user sees result immediately');
 assert.equal(button.disabled,false,'button re-enabled');
 assert.match(button.textContent,/Check Gemini connection/,'button text restored');
 cloud.client={functions:{invoke:async() => ({data:{ready:false,error:'Google model is unavailable'},error:null})}};
 await button.handlers.click();
 assert.match(display.textContent,/Google model is unavailable/,'provider errors visible without console');
 cloud.client={functions:{invoke:async() => ({data:null,error:{message:'Network blocked'}})}};
 await button.handlers.click();
 assert.match(display.textContent,/Network blocked/,'network errors visible');
 console.log('Film check button click, signed-out, success, model restriction and network error tests passed.');
})().catch(e=>{console.error(e);process.exitCode=1});
