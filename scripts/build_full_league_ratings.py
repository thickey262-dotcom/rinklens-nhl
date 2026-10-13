#!/usr/bin/env python3
"""Full-league, statistical-only player evaluation. NOT an eye-test or published scout score.

Uses NHL summary numbers and available attributed MoneyPuck 5v5 values, compared
within position and season. Prior seasons stabilize early-season samples. Scores
for every real skater with at least 1 game, with shrinkage toward neutral 50.
No paywalled text, AI-generated eyewitness claims or human scouting substitutions.
"""
from __future__ import annotations
from collections import defaultdict
from datetime import datetime,timezone
from pathlib import Path
import json, math, sys

ROOT=Path(__file__).resolve().parents[1]
SEASONS=("20242025","20252026","20262027")
# Position-specific measurements. The same inputs remain *descriptive statistics*.
WEIGHTS={
 "F":{"points60":.30,"goals60":.20,"shots60":.16,"toi":.10,"xgfPct":.14,"ixG60":.10},
 "D":{"points60":.25,"goals60":.10,"shots60":.13,"toi":.27,"xgfPct":.15,"ixG60":.10}
}
TIME_WEIGHTS={
 "20242025":{"20242025":1.00},
 "20252026":{"20242025":.30,"20252026":.70},
 "20262027":{"20242025":.20,"20252026":.50,"20262027":.30}
}
def group(p):
 return "D" if p.get("pos")=="D" else "F"
def read_json(name):
 path=ROOT/"data"/name
 return json.loads(path.read_text()) if path.is_file() else None
def metrics(player,advanced=None):
 gp=float(player.get("gp") or 0)
 toi=float(player.get("toi") or 0)
 out={}
 if gp>0 and toi>0:
  minutes=gp*toi
  out={"points60":60*float(player.get("p") or 0)/minutes,
       "goals60":60*float(player.get("g") or 0)/minutes,
       "shots60":60*float(player.get("shots") or 0)/minutes,
       "toi":toi}
 if advanced and float(advanced.get("gp") or 0)>=1:
  for key in ("xgfPct","ixG60"):
   try:
    v=float(advanced.get(key))
    if math.isfinite(v) and 0<=v<=(100 if key=="xgfPct" else 30):
     out[key]=v
   except (TypeError,ValueError):
    pass
 return out
def midpercent(sorted_values,val):
 lo=sum(x<val for x in sorted_values)
 tie=sum(x==val for x in sorted_values)
 return 100*(lo+tie/2)/len(sorted_values)
def prepare(summaries,advanced):
 """Return per-season per-id same-position percentiles and summary coverage."""
 season_data={}
 for season in SEASONS:
  players=summaries.get(season,[])
  adv={str(x["id"]):x for x in advanced.get(season,[]) if x.get("id")}
  raw={str(p["id"]):metrics(p,adv.get(str(p["id"]))) for p in players if p.get("id")}
  pools=defaultdict(list)
  for p in players:
   for key,value in raw.get(str(p["id"]),{}).items():
    if int(p.get("gp") or 0)>0:
     pools[(group(p),key)].append(value)
  season_data[season]={}
  for p in players:
   k=str(p["id"])
   observed=raw.get(k,{})
   ranks={}
   for stat,value in observed.items():
    vals=pools[(group(p),stat)]
    if len(vals)>=10:
     ranks[stat]=midpercent(vals,value)
   weights=WEIGHTS[group(p)]
   present={m:w for m,w in weights.items() if m in ranks}
   if len(present)<4 or not {"points60","goals60","shots60","toi"}.issubset(present):continue
   score=sum(ranks[m]*w for m,w in present.items())/sum(present.values())
   season_data[season][k]={
      "score":score,"games":int(p["gp"]),
      "metrics":list(present.keys()),"metricCount":len(present),
      "position":group(p)
   }
 return season_data
def compute(target,summaries,season_data):
 players=summaries[target]
 results=[]
 for p in players:
  pid=str(p["id"])
  if p.get("gp",0)<1:continue
  components=[];delta=0;observed_games=0;advanced_used=False
  for season,season_weight in TIME_WEIGHTS[target].items():
   entry=season_data.get(season,{}).get(pid)
   if not entry:continue
   reliability=entry["games"]/(entry["games"]+12)
   delta+=season_weight*reliability*(entry["score"]-50)
   observed_games+=entry["games"]
   advanced_used=advanced_used or entry["metricCount"]>4
   components.append({"season":season,"games":entry["games"],"sampleReliability":round(reliability,3),
     "rawPositionPercentile":round(entry["score"],1),"weight":season_weight,
     "metrics":entry["metrics"]})
  if not components:continue
  score=max(0,min(100,round(50+delta)))
  confidence=("Higher sample" if observed_games>=85 else
    "Moderate sample" if observed_games>=35 else
    "Small sample" if observed_games>=10 else "Very small sample")
  results.append({"id":pid,"name":p["name"],"position":group(p),"score":score,
      "confidence":confidence,"gamesAcrossSeasons":observed_games,
      "hasAdvancedData":advanced_used,"seasons":components,
      "kind":"stats-only-model"})
 return {"version":1,"season":target,"generatedAt":datetime.now(timezone.utc).isoformat(timespec="seconds"),
  "source":"NHL regular-season skater summaries; MoneyPuck 5v5 statistics where available",
  "definition":"Statistical performance estimate. Not a human eye test, professional scouting consensus, talent grade or official NHL rating.",
  "method":"Within forward/defense peer groups, weighted percentiles of points, goals, shots per 60, average time on ice, and where available xGF% and individual xG/60; past seasons inform the selected season with game-sample shrinkage toward 50. Missing metrics renormalized.",
  "players":results}
def build_all(root=ROOT):
 summaries={};advanced={}
 for season in SEASONS:
  snap=read_json("nhl-"+season+".json")
  if snap is None:raise ValueError("Missing NHL summary for "+season)
  summaries[season]=snap.get("players",[])
  extra=read_json("advanced-"+season+".json")
  advanced[season]=extra.get("players",[]) if extra else []
 ranks=prepare(summaries,advanced)
 results={}
 for season in SEASONS:
  out=compute(season,summaries,ranks)
  eligible=sum(p.get("gp",0)>0 for p in summaries[season])
  if len(out["players"])!=eligible:
   raise ValueError("Coverage mismatch "+season+": "+str(len(out["players"]))+"/"+str(eligible))
  results[season]=out
 return results
def main():
 out=build_all()
 for season,pack in out.items():
  path=ROOT/"data"/("model-rating-"+season+".json")
  path.write_text(json.dumps(pack,ensure_ascii=False,separators=(",",":"))+"\n")
  print("Model rating",season,len(pack["players"]),"out of",len(pack["players"]),"eligible skaters")
if __name__=="__main__":main()
