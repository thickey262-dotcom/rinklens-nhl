"""Published scouting consensus: evidence, independence, conflict and no fabrication."""
import copy, json, sys, unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'scripts'))
from build_scouting_consensus import build, summarize_player, valid_source, LEVELS
class ScoutingConsensusTests(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  cls.catalog=json.loads((ROOT/'scouting/source_catalog.json').read_text())
  cls.nhl=json.loads((ROOT/'data/nhl-20262027.json').read_text())
 def test_evidence_gating_and_current_skater_ids(self):
  data=build(self.catalog,self.nhl)
  self.assertGreaterEqual(len(data['players']),3)
  player_ids={str(p['id']) for p in self.nhl['players']}
  self.assertTrue(all(p['id'] in player_ids for p in data['players']))
  misa=next(p for p in data['players'] if p['name']=='Michael Misa')
  self.assertIsNotNone(misa['score'])
  self.assertGreaterEqual(misa['scoredTraits'],3)
  self.assertGreaterEqual(misa['publisherCount'],2)
 def test_conflicts_withheld(self):
  p=next(p for p in self.catalog['players'] if p['name']=='Gavin McKenna')
  out=summarize_player(p)
  self.assertEqual(out['traits']['compete']['agreement'],'conflicting')
  self.assertIsNone(out['traits']['compete']['score'])
 def test_no_single_source_score(self):
  p=copy.deepcopy(self.catalog['players'][0])
  p['reports']=p['reports'][:1]
  out=summarize_player(p)
  self.assertIsNone(out['score'])
  self.assertEqual(out['traits'],{})
 def test_invalid_source_rejected(self):
  s=copy.deepcopy(self.catalog['players'][0]['reports'][0])
  s['url']='https://attacker.example/other'
  self.assertFalse(valid_source(s))
  s['url']='https://www.nhl.com/news/something'
  s['notes'][0]['level']='99'
  self.assertFalse(valid_source(s))
 def test_no_faked_zero(self):
  d=build({'players':[]},self.nhl)
  self.assertEqual(d['players'],[])
 def test_web_assets(self):
  html=(ROOT/'index.html').read_text()
  app=(ROOT/'app.js').read_text()
  workflow=(ROOT/'.github/workflows/rinklens.yml').read_text()
  self.assertIn('src="scouting-consensus.js"',html)
  self.assertIn('id="advancedColumnsToggle"',html)
  self.assertIn('RinkConsensus.panel(p)',(ROOT/'reportcards.js').read_text())
  self.assertIn('RinkConsensus.score(p)',app)
  self.assertIn('build_scouting_consensus.py',workflow)
  self.assertIn('data/scouting-consensus.json',workflow)
if __name__=='__main__':unittest.main()
