'use strict';
// Runs the deployed-compatible Deno handler with fake Supabase Auth and Gemini responses.
// NO REAL GEMINI API KEY, BILLING, OR NETWORK CALL IS USED.
const assert = require("node:assert/strict");
const vm = require("node:vm");
const fs = require("node:fs");
const path = require("node:path");
const code=fs.readFileSync(path.join(__dirname,"..","supabase","functions","analyze-film","index.ts"),"utf8");
let handler, apiEnabled=false, statusGemini=200, calls=[], mode="valid";
const settings={SUPABASE_URL:"https://example.supabase.co",SUPABASE_ANON_KEY:"public-test-key",GEMINI_API_KEY:""};
const sample={playerId:"8478402",playerName:"Connor McDavid",season:"20262027",identifier:"EDM #97",
  consent:true,frames:[{time:2,image:"data:image/jpeg;base64,AAAA"},{time:8,image:"data:image/jpeg;base64,BBBB"}]};
const model={
 identityConfirmed:true,summary:"Only limited observations are supported from stills.",
 findings:[
 {trait:"puck",score:4,confidence:"medium",explanation:"Puck appears near target in both stills.",evidence:[
  {time:2,observation:"Frame one: puck near target stick."},
  {time:8,observation:"Frame two: puck near target stick."}]},
 {trait:"iq",score:5,confidence:"high",explanation:"Cannot prove decision-making from one frame.",evidence:[
  {time:2,observation:"Frame one: skater looks up ice."}]},
 {trait:"skating",score:5,confidence:"high",explanation:"Impossible time.",evidence:[
  {time:500,observation:"No matching frame timestamp."}]}
 ]};
const sandbox={
 Response,Request,AbortSignal,console,
 Deno:{env:{get:k=>settings[k]},serve:fn=>{handler=fn}},
 fetch:async(url,opts)=>{
  calls.push({url,opts});
  if(url.endsWith("/auth/v1/user")){
   assert.equal(opts.headers.apikey,"public-test-key");
   return mode==="unauthorized"?new Response("{}",{status:401}):
       new Response(JSON.stringify({id:"user-123"}),{status:200});
  }
  assert(url.includes("models/gemini-2.5-flash-lite:generateContent"),"free-tier model is pinned");
  assert.equal(opts.headers["x-goog-api-key"],"not-a-real-test-key");
  const request=JSON.parse(opts.body);
  assert.equal(request.generationConfig.responseMimeType,"application/json");
  assert.equal(request.generationConfig.maxOutputTokens,1200);
  assert.equal(request.contents.length,1);
  assert.equal(request.contents[0].parts.filter(x=>x.inline_data).length,2,"two JPEG frames only");
  if(statusGemini===429) return new Response("rate limit",{status:429});
  return new Response(JSON.stringify({candidates:[{content:{parts:[{text:JSON.stringify(model)}]}}]}),{status:200});
 }
};
vm.runInNewContext(code,sandbox,{filename:"analyze-film/index.ts"});
assert.equal(typeof handler,"function");
const makeReq=(payload,origin="https://thickey262-dotcom.github.io",token="user-token")=>
  new Request("https://example.supabase.co/functions/v1/analyze-film",{
   method:"POST",headers:{"Origin":origin,"Authorization":"Bearer "+token,"Content-Type":"application/json"},body:JSON.stringify(payload)
  });
(async()=>{
 const options=await handler(new Request("https://example.supabase.co/functions/v1/analyze-film",{
   method:"OPTIONS",headers:{"Origin":"https://thickey262-dotcom.github.io"}
 }));
 assert.equal(options.status,204,"CORS preflight works without Gemini key");
 const forbidden=await handler(makeReq(sample,"https://untrusted.example"));
 assert.equal(forbidden.status,403,"only the RinkLens origin is allowed");
 mode="unauthorized";
 assert.equal((await handler(makeReq(sample))).status,401,"invalid Supabase session rejected");
 mode="valid";
 calls=[];
 const noKey=await handler(makeReq(sample));
 assert.equal(noKey.status,503,"model requests disabled without configured API key");
 assert((await noKey.json()).error.includes("not configured"));
 assert.equal(calls.filter(x=>x.url.includes("generativelanguage")).length,0,"never calls Gemini without key");
 settings.GEMINI_API_KEY="not-a-real-test-key";
 assert.equal((await handler(makeReq({...sample,consent:false}))).status,400,"explicit consent required server-side");
 assert.equal((await handler(makeReq({...sample,frames:[sample.frames[0]]}))).status,400,"requires two frames");
 assert.equal((await handler(makeReq({...sample,frames:sample.frames.map(f=>({...f,image:"https://example.com/leak.jpg"}))}))).status,400,"blocks URLs");
 statusGemini=429;
 const limited=await handler(makeReq(sample));
 assert.equal(limited.status,429);
 assert((await limited.json()).error.includes("No paid fallback"));
 statusGemini=200;
 const ok=await handler(makeReq(sample));
 assert.equal(ok.status,200,"valid key may return a bounded, mock AI result");
 const body=await ok.json();
 assert.equal(body.findings.find(f=>f.trait==="puck").score,4);
 assert.equal(body.findings.find(f=>f.trait==="iq").score,null,"one-frame rating withheld");
 assert(!body.findings.some(f=>f.trait==="skating"),"invented timestamp removed");
 assert.equal(body.humanReviewRequired,true);
 assert.equal(body.source.includes("Gemini 2.5 Flash-Lite"),true);
 console.log("Gemini mock integration: auth, consent, free-only, rate limits and evidence tests passed.");
})().catch(e=>{console.error(e);process.exitCode=1});
