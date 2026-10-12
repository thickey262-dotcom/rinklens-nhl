"""Film Lab deployment and evidence integrity smoke tests."""
from pathlib import Path
import shutil
import subprocess
import unittest
ROOT=Path(__file__).resolve().parents[1]
class FilmLabTests(unittest.TestCase):
    def test_film_lab_deployed_without_secrets(self):
        html=(ROOT/'index.html').read_text()
        workflow=(ROOT/'.github/workflows/rinklens.yml').read_text()
        app=(ROOT/'app.js').read_text()
        src=(ROOT/'film.js').read_text()
        core=(ROOT/'film-core.js').read_text()
        server=(ROOT/'supabase/functions/analyze-film/index.ts').read_text()
        for s in ['id="view-film"','data-view="film"','id="filmFile"','id="filmConsent"','id="filmCheckGemini"','src="film-core.js"','src="film.js"','href="film.css"']:
            self.assertIn(s,html)
        self.assertIn('data-film-player=',app)
        self.assertIn('film-core.js film.js cloud.js',workflow)
        self.assertIn('new Blob(',src)
        self.assertIn('RinkFilmCore.scrubAnalysis',src)
        self.assertIn('validSelection',core)
        self.assertIn('GEMINI_API_KEY',server)
        self.assertIn('connection-test',server)
        self.assertIn('models/"+MODEL',server)
        self.assertIn('checkGemini',src)
        self.assertIn('gemini-2.5-flash-lite',server)
        self.assertNotIn('OPENAI_API_KEY',server)
        self.assertIn('/auth/v1/user',server)
        self.assertIn('consent !== true',server)
        self.assertIn('responseMimeType:"application/json"',server)
        self.assertIn('No paid fallback',server)
        self.assertIn('verify_jwt = false',(ROOT/'supabase/config.toml').read_text())
        self.assertIn('authorization',server)
        self.assertIn('account.id',server)
        self.assertNotIn('GEMINI_API_KEY',(ROOT/'config.js').read_text())
        self.assertNotIn('x-goog-api-key',(ROOT/'film.js').read_text())
    @unittest.skipUnless(shutil.which('node'),'Node is not installed')
    def test_js_logic_and_syntax(self):
        for script in ['film-core.js','film.js']:
            subprocess.run(['node','--check',str(ROOT/script)],check=True,capture_output=True)
        subprocess.run(['node',str(ROOT/'tests/test_film.js')],check=True,capture_output=True)
        result=subprocess.run(['node',str(ROOT/'tests/test_gemini.js')],capture_output=True,text=True)
        self.assertEqual(result.returncode,0,result.stdout+'\n'+result.stderr)
if __name__=='__main__':unittest.main()
