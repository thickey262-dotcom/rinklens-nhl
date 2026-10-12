"""Verify report-card integration and JavaScript calculation behavior."""
from pathlib import Path
import shutil
import subprocess
import unittest

ROOT = Path(__file__).resolve().parents[1]

class ReportCardTests(unittest.TestCase):
    def test_reportcards_wired_into_site_and_pages(self):
        html=(ROOT/'index.html').read_text()
        app=(ROOT/'app.js').read_text()
        advanced=(ROOT/'advanced.js').read_text()
        workflow=(ROOT/'.github/workflows/rinklens.yml').read_text()
        self.assertIn('href="reportcards.css"',html)
        self.assertLess(html.index('src="reportcards.js"'),html.index('src="app.js"'))
        self.assertIn('RinkReports.profile(p)',app)
        self.assertIn('RinkReports.profile(player)',advanced)
        self.assertIn('reportcards.css',workflow)
        self.assertIn('reportcards.js',workflow)
        self.assertTrue((ROOT/'reportcards.css').exists())
    @unittest.skipUnless(shutil.which('node'),'Node unavailable')
    def test_js_calculations(self):
        subprocess.run(['node',str(ROOT/'tests/test_reportcards.js')],check=True,capture_output=True)

if __name__=='__main__':unittest.main()
