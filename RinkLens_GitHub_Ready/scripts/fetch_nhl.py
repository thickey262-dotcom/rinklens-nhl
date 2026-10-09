#!/usr/bin/env python3
"""Refresh normalized NHL skater data snapshots. No packages or API keys required.
Run: python scripts/fetch_nhl.py --seasons 20262027 20252026 20242025
The snapshots contain ONLY fetched NHL stats, never demonstration records.
"""
import argparse
import datetime as dt
import json
import os
from pathlib import Path
import time
import urllib.parse
import urllib.request

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / 'data'
API = 'https://api.nhle.com/stats/rest/en/skater/summary'

def toi_minutes(value):
    if isinstance(value, str) and ':' in value:
        m, s = value.split(':', 1)
        return int(m) + int(s) / 60
    try:
        x = float(value or 0)
    except (TypeError, ValueError):
        return 0
    # NHL Stats REST usually returns time on ice per game in seconds.
    return x / 60 if x > 100 else x

def number(value):
    try:
        return float(value or 0)
    except (TypeError, ValueError):
        return 0

def normalize(rows):
    out = []
    seen = set()
    for r in rows:
        pid = str(r.get('playerId') or '')
        if not pid or pid in seen or not number(r.get('gamesPlayed')) or r.get('positionCode') == 'G':
            continue
        seen.add(pid)
        out.append({
            'id':pid, 'name':r.get('skaterFullName') or 'Unknown',
            'team':r.get('teamAbbrevs') or '—', 'pos':r.get('positionCode') or 'C',
            'gp':int(number(r.get('gamesPlayed'))),
            'g':int(number(r.get('goals'))), 'a':int(number(r.get('assists'))),
            'p':int(number(r.get('points'))), 'shots':int(number(r.get('shots'))),
            'toi':round(toi_minutes(r.get('timeOnIcePerGame')), 4)
        })
    return sorted(out, key=lambda x: (-x['p'], x['name']))

def download(season, timeout=25, attempts=3):
    query = urllib.parse.urlencode({'cayenneExp':f'seasonId={season} and gameTypeId=2', 'limit':'-1', 'start':'0'})
    url = f'{API}?{query}'
    error = None
    for attempt in range(attempts):
        try:
            req = urllib.request.Request(url, headers={'Accept':'application/json', 'User-Agent':'RinkLens-Statistics-Refresh/1.0'})
            with urllib.request.urlopen(req, timeout=timeout) as response:
                raw = json.load(response)
            if not isinstance(raw.get('data'), list):
                raise ValueError('API did not return a data array')
            players = normalize(raw['data'])
            if len(players) < 5:
                raise ValueError(f'Only {len(players)} skaters returned; will not replace existing snapshot')
            return {'source':'nhl', 'season':season, 'updatedAt':dt.datetime.now(dt.timezone.utc).isoformat(),
                    'upstream':url, 'players':players}
        except (OSError, ValueError, json.JSONDecodeError) as exc:
            error = exc
            if attempt < attempts - 1:
                time.sleep(2 * (attempt + 1))
    raise RuntimeError(f'Could not fetch {season}: {error}')

def save(snapshot):
    DATA.mkdir(parents=True, exist_ok=True)
    season = snapshot['season']
    target = DATA / f'nhl-{season}.json'
    temp = target.with_suffix('.tmp')
    temp.write_text(json.dumps(snapshot, ensure_ascii=False, separators=(',', ':')) + '\n', encoding='utf-8')
    os.replace(temp, target)
    print(f'{season}: saved {len(snapshot["players"])} real skaters to {target.relative_to(ROOT)}')

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--seasons', nargs='+', default=['20262027','20252026','20242025'])
    args = parser.parse_args()
    failures = []
    successes = 0
    for season in args.seasons:
        if not (len(season)==8 and season.isdigit() and int(season[4:]) == int(season[:4]) + 1):
            failures.append(season)
            print(f'{season}: invalid season ID')
            continue
        try:
            save(download(season))
            successes += 1
        except RuntimeError as e:
            failures.append(season)
            print(e)
    if failures:
        print('Warning: these seasons were not refreshed; existing snapshots were preserved: ' + ', '.join(failures))
    if not successes:
        raise SystemExit('No NHL seasons could be refreshed')
