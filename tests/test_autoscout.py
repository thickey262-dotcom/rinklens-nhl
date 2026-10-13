"""Auto Scout data rules, page integration and workflow tests."""
import shutil
import subprocess
import unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
class AutoScoutTests(unittest.TestCase):
    def test_assets_and_integration(self):
        html=(ROOT/'index.html').read_text()
        app=(ROOT/'app.js').read_text()
        adv=(ROOT/'advanced.js').read_text()
        reports=(ROOT/'reportcards.js').read_text()
        flow=(ROOT/'.github/workflows/rinklens.yml').read_text()
        self.assertIn('href="autoscout.css"',html)
        self.assertLess(html.index('src="reportcards.js"'),html.index('src="autoscout.js"'))
        self.assertLess(html.index('src="autoscout.js"'),html.index('src="app.js"'))
        self.assertIn('RinkAuto.estimate(p)',app)
        self.assertIn('RinkAuto.panel(p)',reports)
        self.assertIn('RinkAuto.invalidate()',adv)
        self.assertIn('autoscout.css',flow)
        self.assertIn('autoscout.js',flow)
        self.assertIn('const comparisonEye=p=>eye(p)??eaEye(p);',app)
        self.assertIn('const combined=p=>comparisonEye(p)===null?null',app)
    @unittest.skipUnless(shutil.which('node'),'Node unavailable')
    def test_automatic_estimate_calculation(self):
        subprocess.run(['node',str(ROOT/'tests/test_autoscout.js')],check=True,capture_output=True)
if __name__=='__main__':unittest.main()
