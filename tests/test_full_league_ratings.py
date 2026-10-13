"""Test complete position-adjusted statistical scores without pretending they're eye tests."""
import json,sys,unittest,shutil,subprocess
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'scripts'))
from build_full_league_ratings import SEASONS,build_all,midpercent,metrics

class FullLeagueModelTests(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  cls.snapshots=build_all()
 def test_every_skater_receives_model_score(self):
  for season in SEASONS:
   raw=json.loads((ROOT/'data'/('nhl-'+season+'.json')).read_text())
   result=self.snapshots[season]
   expected={str(p['id']) for p in raw['players'] if p['gp']>0}
   actual={p['id'] for p in result['players']}
   self.assertEqual(expected,actual,season)
   self.assertEqual(len(result['players']),len(expected))
   for p in result['players']:
    self.assertIsInstance(p['score'],int)
    self.assertTrue(0<=p['score']<=100)
    self.assertEqual(p['kind'],'stats-only-model')
    self.assertGreaterEqual(p['gamesAcrossSeasons'],1)
 def test_no_future_season_lookahead(self):
  for season in SEASONS:
   for p in self.snapshots[season]['players']:
    self.assertTrue(all(s['season']<=season for s in p['seasons']),p['name'])
 def test_rookie_short_samples_have_neutral_shrinkage(self):
  current=self.snapshots['20262027']
  previous=json.loads((ROOT/'data/nhl-20252026.json').read_text())['players']
  previous+=json.loads((ROOT/'data/nhl-20242025.json').read_text())['players']
  prior_ids={str(p['id']) for p in previous}
  rookies=[p for p in current['players'] if p['id'] not in prior_ids]
  for p in rookies:self.assertLessEqual(abs(p['score']-50),15)
 def test_no_guessing_missing_advanced_metrics(self):
  self.assertAlmostEqual(midpercent([2,2,4,6],2),25)
  summary={'gp':1,'toi':12,'p':1,'g':0,'shots':1}
  self.assertNotIn('xgfPct',metrics(summary,None))
  self.assertIn('points60',metrics(summary,None))
 def test_website_and_build_wiring(self):
  html=(ROOT/'index.html').read_text()
  app=(ROOT/'app.js').read_text()
  report=(ROOT/'reportcards.js').read_text()
  flow=(ROOT/'.github/workflows/rinklens.yml').read_text()
  self.assertIn('src="model-ratings.js"',html)
  self.assertIn('id="modelCoverage"',html)
  self.assertIn('RinkModel.load(season)',app)
  self.assertIn('RinkModel.panel(p)',report)
  self.assertIn('data/model-rating-*.json',flow)
  self.assertIn('build_full_league_ratings.py',flow)
 @unittest.skipUnless(shutil.which('node'),'Node unavailable')
 def test_model_javascript(self):
  for name in ['model-ratings.js','app.js']:
   subprocess.run(['node','--check',str(ROOT/name)],check=True,capture_output=True)
  test=subprocess.run(['node',str(ROOT/'tests/test_full_league_ratings.js')],capture_output=True,text=True)
  self.assertEqual(test.returncode,0,test.stdout+test.stderr)

if __name__=='__main__':unittest.main()
