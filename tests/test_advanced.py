import sys
import unittest
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'scripts'))
from fetch_advanced import normalize,pct

class AdvancedMetricsTests(unittest.TestCase):
    def test_five_on_five_metrics_join_by_player_id(self):
        rows=[
          {'playerId':'8471','situation':'all','icetime':'1100','onIce_xGoalsPercentage':'0.95'},
          {'playerId':'8471','situation':'5on5','icetime':'900','games_played':'8',
           'onIce_xGoalsPercentage':'0.584','onIce_corsiPercentage':'0.532',
           'onIce_fenwickPercentage':'0.54','I_F_xGoals':'1.25',
           'OnIce_F_highDangerShots':'18','OnIce_A_highDangerShots':'12'},
          {'playerId':'8472','situation':'5on5','icetime':'200',
           'onIce_xGoalsPercentage':'','onIce_corsiPercentage':'0.5'},
        ]
        out=normalize(rows)
        self.assertEqual(len(out),2)
        self.assertEqual(out[0]['id'],'8471')
        self.assertEqual(out[0]['xgfPct'],58.4)
        self.assertEqual(out[0]['cfPct'],53.2)
        self.assertEqual(out[0]['ffPct'],54)
        self.assertEqual(out[0]['hdCfPct'],60)
        self.assertEqual(out[0]['ixG60'],5)
        self.assertIsNone(out[1]['xgfPct'])
        self.assertIsNone(out[1]['hdCfPct'])

    def test_invalid_stats_are_never_guessed(self):
        self.assertIsNone(pct({'val':'NaN'},'val'))
        self.assertIsNone(pct({'val':'-1'},'val'))

    def test_deployment_has_player_analytics(self):
        html=(ROOT/'index.html').read_text()
        app=(ROOT/'app.js').read_text()
        flow=(ROOT/'.github/workflows/rinklens.yml').read_text()
        self.assertIn('<script src="advanced.js"></script>',html)
        self.assertLess(html.index('<script src="advanced.js"></script>'),html.index('<script src="app.js"></script>'))
        self.assertIn('RinkAdvanced.profile(p)',app)
        self.assertIn('RinkAdvanced.load(season)',app)
        self.assertIn('fetch_advanced.py',flow)
        self.assertIn('advanced.css app.js',flow)

if __name__=='__main__':
    unittest.main()
