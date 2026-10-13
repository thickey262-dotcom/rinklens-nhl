"""Smoke checks for the interactive Stats School shipped on GitHub Pages."""
from pathlib import Path
import shutil
import subprocess
import unittest

ROOT = Path(__file__).resolve().parents[1]


class StatsSchoolTests(unittest.TestCase):
    def test_page_references_lessons_and_assets_exist(self):
        html = (ROOT / 'index.html').read_text(encoding='utf-8')
        for anchor in ('id="view-learn"', 'data-view="learn"', 'src="learn.js"', 'href="learn.css"'):
            self.assertIn(anchor, html)
        for file in ('learn.js', 'learn.css'):
            self.assertTrue((ROOT / file).is_file(), f'Missing asset: {file}')

    def test_eight_lessons_and_hypothetical_disclaimer(self):
        js = (ROOT / 'learn.js').read_text(encoding='utf-8')
        for metric in ('corsi', 'fenwick', 'xg', 'xgf', 'hdcf', 'p60', 'pdo', 'gsax'):
            self.assertIn("id:'" + metric + "'", js)
        self.assertIn('const questions = [', js)
        self.assertIn('HYPOTHETICAL EXAMPLE', js)

    def test_deploy_includes_new_assets(self):
        workflow = (ROOT / '.github/workflows/rinklens.yml').read_text(encoding='utf-8')
        self.assertIn('ea-ratings.css app.js learn.js advanced.js reportcards.js autoscout.js ea-ratings.js', workflow)

    @unittest.skipUnless(shutil.which('node'), 'Node.js unavailable')
    def test_lesson_javascript_parses(self):
        subprocess.run(['node', '--check', str(ROOT / 'learn.js')], check=True, capture_output=True)


if __name__ == '__main__':
    unittest.main()
