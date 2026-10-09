import sys
from pathlib import Path
import unittest
sys.path.insert(0,str(Path(__file__).resolve().parents[1] / 'scripts'))
from fetch_nhl import normalize, toi_minutes

class NHLRefreshTests(unittest.TestCase):
    def test_minutes_conversion(self):
        self.assertAlmostEqual(toi_minutes('19:30'),19.5)
        self.assertAlmostEqual(toi_minutes(1170),19.5)
        self.assertAlmostEqual(toi_minutes(None),0)
    def test_normalization_filters_goalies_missing_games_and_duplicates(self):
        rows=[{'playerId':8471,'skaterFullName':'Example One','teamAbbrevs':'BUF','positionCode':'C','gamesPlayed':10,'goals':4,'assists':5,'points':9,'shots':28,'timeOnIcePerGame':'18:00'},
              {'playerId':8471,'skaterFullName':'Example One','positionCode':'C','gamesPlayed':10},
              {'playerId':8472,'positionCode':'G','gamesPlayed':10},
              {'playerId':8473,'positionCode':'D','gamesPlayed':0}]
        result=normalize(rows)
        self.assertEqual(len(result),1)
        self.assertEqual(result[0]['p'],9)
        self.assertEqual(result[0]['toi'],18)
        self.assertEqual(result[0]['id'],'8471')

if __name__=='__main__':unittest.main()