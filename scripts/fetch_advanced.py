#!/usr/bin/env python3
"""Download MoneyPuck's publicly listed season skaters CSV and normalize player 5v5.
MoneyPuck permits non-commercial use with prominent attribution. Other uses require permission.
"""
import argparse
import csv
import datetime as dt
import io
import json
import math
import os
from pathlib import Path
import urllib.request

ROOT=Path(__file__).resolve().parent.parent
DATA=ROOT/'data'
BASE='https://moneypuck.com/moneypuck/playerData/seasonSummary'

def finite(row,key):
    raw=row.get(key)
    try:
        if raw is None or str(raw).strip()=='':return None
        n=float(raw)
        return n if math.isfinite(n) else None
    except (TypeError,ValueError):return None

def pct(row,key):
    n=finite(row,key)
    if n is None:return None
    n=n*100 if 0<=n<=1 else n
    return round(n,2) if 0<=n<=100 else None

def normalize(rows):
    best={}
    for row in rows:
        if row.get('situation')!='5on5':continue
        pid=str(row.get('playerId') or '').strip()
        sec=finite(row,'icetime')
        if not pid or sec is None or sec<=0:continue
        if pid in best and finite(best[pid],'icetime')>=sec:continue
        best[pid]=row
    players=[]
    for pid,r in best.items():
        sec=finite(r,'icetime')
        ixg=finite(r,'I_F_xGoals')
        hd_for=finite(r,'OnIce_F_highDangerShots')
        hd_against=finite(r,'OnIce_A_highDangerShots')
        gp=finite(r,'games_played')
        hdc=None
        if hd_for is not None and hd_against is not None and hd_for>=0 and hd_against>=0 and hd_for+hd_against>0:
            hdc=round(100*hd_for/(hd_for+hd_against),2)
        players.append({
            'id':pid,
            'gp':int(gp) if gp is not None and gp>=0 else None,
            'xgfPct':pct(r,'onIce_xGoalsPercentage'),
            'cfPct':pct(r,'onIce_corsiPercentage'),
            'ffPct':pct(r,'onIce_fenwickPercentage'),
            'ixG60':round(ixg*3600/sec,3) if ixg is not None and ixg>=0 else None,
            'hdCfPct':hdc
        })
    return sorted(players,key=lambda p:p['id'])

def fetch(season):
    url=f'{BASE}/{season[:4]}/regular/skaters.csv'
    req=urllib.request.Request(url,headers={'User-Agent':'RinkLens hockey education (noncommercial)', 'Accept':'text/csv'})
    with urllib.request.urlopen(req,timeout=90) as response:
        reader=csv.DictReader(io.TextIOWrapper(response,encoding='utf-8-sig',newline=''))
        required={'playerId','situation','icetime','onIce_xGoalsPercentage','onIce_corsiPercentage'}
        if not reader.fieldnames or not required.issubset(reader.fieldnames):
            raise ValueError('Unexpected CSV headers; old snapshot was preserved')
        players=normalize(reader)
    if len(players)<5:raise ValueError('Too few skaters; old snapshot preserved')
    return {'source':'moneypuck','situation':'5on5','season':season,'updatedAt':dt.datetime.now(dt.timezone.utc).isoformat(),'upstream':url,'license':'noncommercial with attribution','players':players}

def save(snapshot):
    DATA.mkdir(parents=True,exist_ok=True)
    target=DATA/f'advanced-{snapshot["season"]}.json'
    temp=target.with_suffix('.tmp')
    temp.write_text(json.dumps(snapshot,ensure_ascii=False,separators=(',',':'))+'\n',encoding='utf-8')
    os.replace(temp,target)
    print(f'{snapshot["season"]}: saved advanced metrics for {len(snapshot["players"])} 5v5 skaters')

if __name__=='__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('--seasons',nargs='+',default=['20262027','20252026','20242025'])
    args=parser.parse_args()
    successes=0
    for season in args.seasons:
        if not(len(season)==8 and season.isdigit() and int(season[4:])==int(season[:4])+1):
            print('Invalid season:',season)
            continue
        try:save(fetch(season));successes+=1
        except Exception as e:print(f'{season}: advanced data unavailable; existing snapshot kept: {e}')
    if not successes:raise SystemExit('No advanced snapshots refreshed')
