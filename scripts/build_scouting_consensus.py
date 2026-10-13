#!/usr/bin/env python3
"""Generate a conservative, attributed scoring CONSENSUS from independently published scouting assessments.
No source text scraped or reproduced. Source notes are short original paraphrases, reviewed in the source catalog.
No rating is invented for an uncovered skater. This is not film analysis and does not call a generative model.
"""
from __future__ import annotations
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
import json, re, statistics, sys
from urllib.parse import urlsplit

ROOT=Path(__file__).resolve().parents[1]
VALID_TRAITS=("skating","puck","iq","defense","compete","transition")
LEVELS={"weak":1,"limited":2,"average":3,"strong":4,"elite":5}
ALLOWED_PUBLISHERS={
  "NHL.com / Central Scouting":"nhl.com",
  "NHL.com / Central Scouting":"nhl.com",
  "Elite Prospects":"eliteprospects.com",
  "The Hockey Writers":"thehockeywriters.com",
}
def valid_source(s):
  publisher=s.get("publisher","")
  host=urlsplit(s.get("url","")).hostname or ""
  expected=ALLOWED_PUBLISHERS.get(publisher)
  return bool(expected and host in (expected,"www."+expected) and
    s.get("author") and isinstance(s.get("notes"),list) and s["notes"] and
    len(s["notes"])<=8 and len(s["url"])<400 and
    all(x.get("trait") in VALID_TRAITS and x.get("level") in LEVELS and
      isinstance(x.get("evidence"),str) and 12<=len(x["evidence"])<=240
      and not any(t in x["evidence"].lower() for t in ("<script", "javascript:")) for x in s["notes"]))
def summarize_player(p):
  report_sources=[];groups=defaultdict(list);source_seen=set();publishers=set()
  for report in p.get("reports",[]):
    if not valid_source(report):continue
    if report["url"] in source_seen:continue
    source_seen.add(report["url"])
    publishers.add(report["publisher"])
    index=len(report_sources)
    report_sources.append({"publisher":report["publisher"],"author":report["author"],
       "url":report["url"],"date":report.get("date")})
    for observation in report["notes"]:
      groups[observation["trait"]].append((report["publisher"],LEVELS[observation["level"]],
                                          observation["evidence"],index))
  results={}
  for trait in VALID_TRAITS:
    entries=groups.get(trait,[])
    # One vote per publisher, not per article. Same-outlet stories cannot manufacture consensus.
    outlet={}
    for publisher,score,evidence,index in entries:
      if publisher not in outlet:outlet[publisher]=(score,evidence,index)
    values=[v[0] for v in outlet.values()]
    if len(outlet)<2:continue
    # Opposing published evaluations trigger a withheld trait, not a numerical compromise.
    if max(values)-min(values)>1:
      results[trait]={"score":None,"agreement":"conflicting","sourceCount":len(outlet),
        "evidence":[{"text":e,"sourceIndex":idx} for _,e,idx in list(outlet.values())[:3]]}
      continue
    results[trait]={"score":int(round(statistics.mean(values))),"agreement":"supported",
      "sourceCount":len(outlet),
      "evidence":[{"text":e,"sourceIndex":idx} for _,e,idx in list(outlet.values())[:3]]}
  scored=[(k,v["score"]) for k,v in results.items() if v["score"] is not None]
  # >=3 supported aspects incl. one two-way/compete/transition trait; otherwise do not invent an overall.
  adequate=len(publishers)>=2 and len(scored)>=3 and any(t in {"defense","compete","transition"} for t,_ in scored)
  overall=round(sum(v for _,v in scored)/len(scored)*20) if adequate else None
  return {"id":p["id"],"name":p["name"],"score":overall,
     "confidence":("moderate" if overall is not None and len(scored)>=4 and len(publishers)>=3 else
        "limited" if overall is not None else "insufficient"),
     "sourceCount":len(report_sources),"publisherCount":len(publishers),
     "scoredTraits":len(scored),"traits":results,"sources":report_sources,
     "note":"Historical published prospect scouting observations, not a current NHL performance evaluation"}
def build(catalog,nhl):
  ids={str(q["id"]):q for q in nhl.get("players",[]) if q.get("id")}
  rows=[]
  for player in catalog["players"]:
    pid=str(player.get("id",""))
    if pid not in ids:continue
    if re.sub(r"[^a-z]","",player["name"].lower())!=re.sub(r"[^a-z]","",ids[pid]["name"].lower()):
      continue
    rows.append(summarize_player(player))
  return {"version":1,"generatedAt":datetime.now(timezone.utc).isoformat(timespec="seconds"),
   "scope":"Published analyst scouting assessments, often from draft years; NOT current game film, and NOT NHL EDGE tracking",
   "methodology":"Two different publishers must agree within one of five defined qualitative levels per trait. An overall 0–100 is only issued with 3 supported traits including defense, compete or transition. Conflicts/missing scores are withheld. Editorial paraphrases reviewed against linked sources.",
   "players":sorted(rows,key=lambda r:r["name"])}
def main():
  catalog=json.loads((ROOT/"scouting/source_catalog.json").read_text())
  nhl=json.loads((ROOT/"data/nhl-20262027.json").read_text())
  snapshot=build(catalog,nhl)
  path=ROOT/"data/scouting-consensus.json"
  # Stable last good file on failures; published evidence must never be empty.
  if len(snapshot["players"])<2:
    raise ValueError("Insufficient verified players; refusing to overwrite")
  path.write_text(json.dumps(snapshot,ensure_ascii=False,separators=(",",":"))+"\n",encoding="utf-8")
  print("Compiled",len(snapshot["players"]),"scout profiles,",
    sum(1 for x in snapshot["players"] if x["score"] is not None),"fully evidenced scores")
if __name__=="__main__":main()
