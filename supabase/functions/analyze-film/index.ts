// Optional private RinkLens vision reviewer; full video stays in browser.
import { createClient } from "npm:@supabase/supabase-js@2";
const origin="https://thickey262-dotcom.github.io";
const cors={"Access-Control-Allow-Origin":origin,"Access-Control-Allow-Methods":"POST, OPTIONS","Access-Control-Allow-Headers":"authorization,apikey,x-client-info,content-type","Vary":"Origin"};
const json=(v:unknown,s=200)=>new Response(JSON.stringify(v),{status:s,headers:{"content-type":"application/json","cache-control":"no-store",...cors}});
const traits=new Set(["skating","puck","iq","defense","compete","transition"]);
function valid(b:any){
 return b&&/^[0-9]{6,10}$/.test(String(b.playerId||""))&&/^20[0-9]{6}$/.test(String(b.season||""))&&
 typeof b.playerName==="string"&&b.playerName.length>0&&b.playerName.length<=100&&
 typeof b.identifier==="string"&&b.identifier.length>0&&b.identifier.length<=20&&
 Array.isArray(b.frames)&&b.frames.length>=2&&b.frames.length<=8&&
 b.frames.every((f:any)=>f&&typeof f.time==="number"&&Number.isFinite(f.time)&&f.time>=0&&f.time<=7200&&
 typeof f.image==="string"&&f.image.length<=380000&&/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(f.image));
}
Deno.serve(async(req:Request)=>{
 if(req.method==="OPTIONS")return new Response(null,{status:204,headers:cors});
 if(req.headers.get("origin")!==origin)return json({error:"Origin not allowed"},403);
 if(req.method!=="POST")return json({error:"POST required"},405);
 const bearer=req.headers.get("authorization")||"";
 if(!/^Bearer [A-Za-z0-9._~-]+$/.test(bearer))return json({error:"Sign-in required"},401);
 const supaUrl=Deno.env.get("SUPABASE_URL");
 const anon=Deno.env.get("SUPABASE_ANON_KEY")||Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
 const key=Deno.env.get("OPENAI_API_KEY");
 if(!supaUrl||!anon||!key)return json({error:"Film AI not configured"},503);
 const client=createClient(supaUrl,anon,{auth:{persistSession:false,autoRefreshToken:false}});
 const user=(await client.auth.getUser(bearer.slice(7))).data?.user;
 if(!user?.id)return json({error:"Invalid user session"},401);
 if(Number(req.headers.get("content-length")||0)>3100000)return json({error:"Request too large"},413);
 let b:any;try{b=await req.json()}catch{return json({error:"Malformed JSON"},400)}
 if(!valid(b))return json({error:"Provide a player, jersey identifier and 2–8 JPEG frames"},400);
 const times=b.frames.map((f:any)=>f.time);
 const instructions="You are a conservative hockey film assistant. You see 2–8 time-stamped STILL FRAMES, NOT continuous video. Do not infer skating speed, skating technique, puck possession, decisions, positioning, or compete level unless directly supported. Never invent identities, motion or game events. Only review the named player if identifiable using jersey/team cues. Output one JSON object with identityConfirmed boolean, summary string, findings array. Each finding: trait (skating|puck|iq|defense|compete|transition), score (integer 1–5 or null), confidence (low|medium|high), explanation string, evidence array of {time:number, observation:string}. Evidence timestamps must match exact supplied frames. Only include observed traits. Unless player identity is clearly confirmed AND two distinct frames visibly support the SAME trait AND confidence is medium/high, set score null. For still images most traits will be unscored. No 100-point eye-test scores. Return JSON ONLY.";
 const content:any[]=[{type:"input_text",text:"User-selected target "+b.playerName.slice(0,100)+" (ID "+b.playerId+"), identifier (jersey/team): "+b.identifier.slice(0,20)+". This identity is not verified."}];
 for(const f of b.frames){content.push({type:"input_text",text:"Still frame at "+f.time.toFixed(1)+" seconds"});content.push({type:"input_image",image_url:f.image,detail:"low"});}
 let response:Response;
 try{response=await fetch("https://api.openai.com/v1/responses",{method:"POST",signal:AbortSignal.timeout(55000),
 headers:{"authorization":"Bearer "+key,"content-type":"application/json"},
 body:JSON.stringify({model:"gpt-4.1-mini",store:false,max_output_tokens:1100,
 input:[{role:"system",content:[{type:"input_text",text:instructions}]},{role:"user",content}]})})}
 catch{return json({error:"Vision service unavailable"},502)}
 if(!response.ok)return json({error:"Vision API returned HTTP "+response.status},502);
 let parsed:any;
 try{const x=await response.json();const t=(x.output||[]).flatMap((o:any)=>o.content||[]).filter((o:any)=>o.type==="output_text").map((o:any)=>o.text).join("\n");parsed=JSON.parse(t.trim().replace(/^```json\s*/,"").replace(/```$/,""))}
 catch{return json({error:"Model returned unparseable output"},502)}
 const findings=[];
 for(const item of Array.isArray(parsed.findings)?parsed.findings:[]){
  if(!traits.has(item?.trait)||!Array.isArray(item.evidence))continue;
  const evidence=item.evidence.filter((e:any)=>typeof e.time==="number"&&times.some((t:number)=>Math.abs(t-e.time)<0.12)&&typeof e.observation==="string"&&e.observation.length>3)
   .slice(0,3).map((e:any)=>({time:e.time,observation:e.observation.slice(0,240)}));
  if(!evidence.length)continue;
  const confidence=["low","medium","high"].includes(item.confidence)?item.confidence:"low";
  const validScore=parsed.identityConfirmed===true&&confidence!=="low"&&new Set(evidence.map((e:any)=>e.time)).size>=2&&Number.isInteger(item.score)&&item.score>=1&&item.score<=5;
  findings.push({trait:item.trait,score:validScore?item.score:null,confidence,explanation:String(item.explanation||"").slice(0,280),evidence});
 }
 return json({identityConfirmed:parsed.identityConfirmed===true,summary:String(parsed.summary||"").slice(0,500),
 findings:findings.slice(0,6),frameTimes:times,source:"AI review of still frames; not continuous tracking",humanReviewRequired:true});
});
