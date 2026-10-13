"""Film Lab removal regression test: no video/AI film UI is shipped."""
from pathlib import Path
import unittest
ROOT=Path(__file__).resolve().parents[1]
class FilmRemovalTests(unittest.TestCase):
    def test_no_film_lab_in_public_website(self):
        page=(ROOT/'index.html').read_text()
        app=(ROOT/'app.js').read_text()
        workflow=(ROOT/'.github/workflows/rinklens.yml').read_text()
        for forbidden in ['view-film','data-view="film"','filmCheckGemini','filmAnalyze','src="film.js"','src="film-core.js"','href="film.css"']:
            self.assertNotIn(forbidden,page)
        self.assertNotIn('data-film-player=',app)
        self.assertNotIn("film-core.js film.js",workflow)
        self.assertIn('RinkReports.profile(p)',app)
        self.assertIn('src="reportcards.js"',page)
if __name__=='__main__':unittest.main()
