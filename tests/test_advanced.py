import sys
import unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'scripts'))
from fetch_advanced import normalize, percentage, high_danger_share

class AdvancedStatsTests(unittest.TestCase):
    def test_normalize_five_on_five_only_and_percentages(self):
        rows=[{'playerId':'8471','situation':'all','icetime':'2000','onIce_xGoalsPercentage':'0.95'},
            {'playerId':'8471','situation':'5on5','icetime':'900','games_played':'8','onIce_xGoalsPercentage':'0.584','onIce_corsiPercentage':'0.532',
            'onIce_fenwickPercentage':'0.54','I_F_xGoals':'1.25', 'OnIce_F_highDangerShots':'18','OnIce_A_highDangerShots':'12'},
            {'playerId':'8471','situation':'5on5','icetime':'200','onIce_xGoalsPercentage':'0.23'},
            {'playerId':'8472','situation':'5on5','icetime':'500','onIce_xGoalsPercentage':'','onIce_corsiPercentage':'0.501'}]
        out=normalize(rows)
        self.assertEqual(len(out),2)
        one=out[0]
        self.assertEqual(one['xgfPct'],58.4)
        self.assertEqual(one['cfPct'],53.2)
        self.assertEqual(one['ffPct'],54.0)
        self.assertEqual(one['hdCfPct'],60.0)
        self.assertEqual(one['ixG60'],5.0)
        self.assertIsNone(out[1]['xgfPct'])
        self.assertIsNone(out[1]['hdCfPct'])
    def test_invalid_inputs_are_not_fabricated(self):
        self.assertIsNone(percentage({'x':'NaN'},'x'))
        self.assertIsNone(high_danger_share({'OnIce_F_highDangerShots':'0','OnIce_A_highDangerShots':'0'}))
    def test_site_and_workflow_have_new_assets(self):
        html=(ROOT/'index.html').read_text()
        app=(ROOT/'app.js').read_text()
        flow=(ROOT/'.github/workflows/rinklens.yml').read_text()
        self.assertIn('<script src="advanced.js"></script>\n  <script src="reportcards.js"></script>\n  <script src="autoscout.js"></script>\n  <script src="app.js"></script>',html)
        self.assertIn('RinkReports.profile(p)',app)
        self.assertIn('RinkAdvanced.load(season)',app)
        self.assertIn('fetch_advanced.py',flow)
        self.assertIn('advanced.css reportcards.css autoscout.css app.js',flow)

if __name__=='__main__':unittest.main()
