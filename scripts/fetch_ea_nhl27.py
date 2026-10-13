#!/usr/bin/env python3
"""Download source-backed NHL 27 ratings. Missing ratings stay missing."""
import datetime as dt
from html.parser import HTMLParser
from http.client import IncompleteRead
import json,os,re,unicodedata
from pathlib import Path
from urllib.request import Request,urlopen
ROOT=Path(__file__).resolve().parents[1]
URL='https://careers.ea.com/games/nhl/ratings/positions-ratings'
POSITIONS={'center/Center':'C','left-wing/Left%20Wing':'LW','right-wing/Right%20Wing':'RW',
  'left-defense/Left%20Defense':'D','right-defense/Right%20Defense':'D','goalie/Goalie':'G'}
FIELDS=['ovr','acl','spd','dek','pas','slp','wsp']
class Rows(HTMLParser):
 def __init__(self):
  super().__init__(convert_charrefs=True);self.rows=[];self.tr=0;self.td=0;self.row=None;self.cell=None
 def handle_starttag(self,tag,attrs):
  if tag=='tr':
   self.tr+=1
   if self.tr==1:self.row=[]
  if self.tr and tag in ('td','th'):
   self.td+=1
   if self.td==1:self.cell=[]
 def handle_data(self,data):
  if self.cell is not None:self.cell.append(data)
 def handle_endtag(self,tag):
  if tag in ('td','th') and self.td:
   self.td-=1
   if self.td==0 and self.row is not None:
    self.row.append(re.sub(r'\s+',' ',' '.join(self.cell or [])).strip());self.cell=None
  if tag=='tr' and self.tr:
   self.tr-=1
   if self.tr==0 and self.row:self.rows.append(self.row);self.row=None

def parse_html(source,pos):
 parser=Rows();parser.feed(source);found=[]
 for cells in parser.rows:
  raw=' | '.join(cells)
  if not re.search(r'\bOVR\s*\d{2}\b',raw,re.I):continue
  rank=re.search(r'^\s*(\d{1,3})\b',cells[0]) if cells else None
  name=re.sub(r'^#?\d{1,3}\s*','',cells[1] if len(cells)>1 else '').strip()
  if not re.fullmatch(r"[A-Za-zÀ-ÿĀ-ž .’'\-]{3,80}",name):continue
  rec={'name':name,'pos':pos}
  if rank:rec['rank']=int(rank.group(1))
  for field in FIELDS:
   m=re.search(r'\b'+field+r'\s*(\d{1,3})\b',raw,re.I)
   if m:rec[field]=int(m.group(1))
  if not 40<=rec.get('ovr',0)<=99:continue
  if not all(0<=rec.get(k,0)<=99 for k in FIELDS):continue
  found.append(rec)
 return found

def fetch_page(url):
 req=Request(url,headers={'User-Agent':'Mozilla/5.0 (compatible; RinkLens/1.0; educational ratings display)',
   'Accept':'text/html,application/xhtml+xml','Accept-Language':'en-US,en;q=0.8'})
 try:
  with urlopen(req,timeout=25) as r:payload=r.read(4500000)
 except IncompleteRead as ex:
  # EA's CDN can truncate large SSR HTML after the useful player table.
  # Keep the partial only when a complete HTML row table was received.
  payload=ex.partial
  if payload.count(b'</tr>')<15:raise
 return payload.decode('utf-8','replace')

def name_key(value):
 s=unicodedata.normalize('NFKD',str(value)).casefold().replace('ø','o').replace('đ','d')
 return re.sub(r'[^a-z0-9]','', ''.join(c for c in s if not unicodedata.combining(c)))
def collect(fetcher=fetch_page):
 players=[];errors=[];covered=set()
 for slug,pos in POSITIONS.items():
  # EA's top-300 list paginates centers and left-defense across two pages.
  pages=(1,2) if slug in ('center/Center','left-defense/Left%20Defense') else (1,)
  for page in pages:
   url=URL+'/'+slug+('?page='+str(page) if page>1 else '')
   try:
    html=fetcher(url);rows=parse_html(html,pos)
    print(f'EA NHL27 {slug} page {page}: HTML chars {len(html)}, table rows {len(rows)}')
    if len(rows)<8:errors.append(f'{slug} page {page}: too few rows (tr={html.lower().count("<tr")}; OVR={html.count("OVR")})')
    else:covered.add((slug,page));players.extend(rows)
   except Exception as e:errors.append(f'{slug} page {page}: {str(e)[:130]}')
 print('EA import notices:',errors)
 unique={};ambiguous=set()
 for p in players:
  k=name_key(p['name'])
  if k in unique and (p['ovr']!=unique[k]['ovr'] or p['pos']!=unique[k]['pos']):ambiguous.add(k)
  else:unique[k]=p
 for k in ambiguous:unique.pop(k,None)
 # Do not overwrite a prior good snapshot with a partial CDN response.
 expected={(slug,page) for slug in POSITIONS for page in ((1,2) if slug in ('center/Center','left-defense/Left%20Defense') else (1,))}
 if covered!=expected or len(unique)<250:
  raise ValueError(f'Only {len(unique)} unique ratings retrieved from {len(covered)}/{len(expected)} pages; previous snapshot preserved.')
 return {'source':'EA SPORTS NHL 27 public player ratings','game':'NHL 27',
  'updatedAt':dt.datetime.now(dt.timezone.utc).isoformat(),
  'sourceUrl':'https://www.ea.com/games/nhl/ratings',
  'scope':'Official EA top 300 player ratings, not complete NHL game roster',
  'players':sorted(unique.values(),key=lambda p:(p.get('rank',999),p['name']))}
def save(data):
 target=ROOT/'data'/'ea-nhl27.json';target.parent.mkdir(parents=True,exist_ok=True)
 tmp=target.with_suffix('.tmp');tmp.write_text(json.dumps(data,ensure_ascii=False,separators=(',',':'))+'\n')
 os.replace(tmp,target)
 print(f'Saved {len(data["players"])} official NHL 27 ratings')
if __name__=='__main__':
 try:save(collect())
 except Exception as e:print('EA NHL 27 source unavailable:',e);raise SystemExit(1)
