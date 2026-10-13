"""Check the easy-to-read interface is connected without changing scouting data."""
import shutil
import subprocess
import unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
class EasyReadTests(unittest.TestCase):
    def test_html_has_navigation_and_explanations(self):
        html=(ROOT/'index.html').read_text()
        app=(ROOT/'app.js').read_text()
        workflow=(ROOT/'.github/workflows/rinklens.yml').read_text()
        for fragment in ['id="startHereHeading"','id="textSizeToggle"','id="advancedColumnsToggle"','id="playerTable"','class="stats-help"','class="skip-link"','href="easy-read.css"','src="easy-read.js?v=1"']:
            self.assertIn(fragment,html)
        self.assertIn('data-go="players"',html)
        self.assertIn('Stats score',app)
        self.assertIn('class="advanced-column"',app)
        self.assertIn('role="button" tabindex="0"',app)
        self.assertIn('easy-read.js',workflow)
        self.assertIn('easy-read.css',workflow)
        self.assertNotIn('view-film',html)
    @unittest.skipUnless(shutil.which('node'),'Node unavailable')
    def test_readability_toggle(self):
        subprocess.run(['node','--check',str(ROOT/'app.js')],check=True,capture_output=True)
        subprocess.run(['node','--check',str(ROOT/'easy-read.js')],check=True,capture_output=True)
        test=subprocess.run(['node',str(ROOT/'tests/test_easy_read.js')],capture_output=True,text=True)
        self.assertEqual(test.returncode,0,test.stdout+'\n'+test.stderr)
if __name__=='__main__':unittest.main()
