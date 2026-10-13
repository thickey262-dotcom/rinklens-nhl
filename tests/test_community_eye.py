"""Community Eyewitness rating integration and browser behavior checks."""
import shutil,subprocess,unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
class CommunityEyeTests(unittest.TestCase):
 def test_assets_and_human_first_formula(self):
  html=(ROOT/'index.html').read_text()
  app=(ROOT/'app.js').read_text()
  flow=(ROOT/'.github/workflows/rinklens.yml').read_text()
  for needle in ['src="community-eye.js"','href="community-eye.css"','Best community rating','Best eyewitness score','Eye Test']:
   self.assertIn(needle,html)
  self.assertIn("eye(p)??RinkCommunity.eyeTest(p)?.score??null",app)
  self.assertIn("RinkCommunity.panel(p)",app)
  self.assertIn("RinkCommunity.reload",app)
  self.assertIn("community-eye.css",flow)
  self.assertIn("community-eye.js",flow)
  self.assertNotIn('view-film',html)
 @unittest.skipUnless(shutil.which('node'),'Node unavailable')
 def test_browser_and_privacy_gates(self):
  for file in ['app.js','community-eye.js']:
   subprocess.run(['node','--check',str(ROOT/file)],capture_output=True,text=True,check=True)
  r=subprocess.run(['node',str(ROOT/'tests/test_community_eye.js')],capture_output=True,text=True)
  self.assertEqual(r.returncode,0,r.stdout+' '+r.stderr)
if __name__=='__main__':unittest.main()
