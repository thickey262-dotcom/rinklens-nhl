import unittest
from pathlib import Path
import importlib.util
spec=importlib.util.spec_from_file_location("mp",Path(__file__).resolve().parents[1]/"scripts/fetch_moneypuck.py")
mp=importlib.util.module_from_spec(spec)
spec.loader.exec_module(mp)
class MoneyPuckTests(unittest.TestCase):
    def test_all_situations_and_five_on_five_not_mixed(self):
        common={"playerId":"123","name":"Sample Player","team":"BUF","position":"C","games_played":"10","I_F_goals":"4","I_F_primaryAssists":"2","I_F_secondaryAssists":"1","I_F_points":"7","I_F_shotsOnGoal":"30"}
        a=dict(common,situation="all",icetime="12000",onIce_xGoalsPercentage="0.40",onIce_corsiPercentage="0.35")
        b=dict(common,situation="5on5",icetime="9000",onIce_xGoalsPercentage="0.55",onIce_corsiPercentage="0.52",onIce_fenwickPercentage="0.51",I_F_xGoals="2.5",OnIce_F_highDangerShots="12",OnIce_A_highDangerShots="8")
        result=mp.normalize([a,b])
        self.assertEqual(len(result),1)
        self.assertEqual(result[0]["p"],7)
        self.assertEqual(result[0]["xgfPct"],55)
        self.assertEqual(result[0]["cfPct"],52)
        self.assertEqual(result[0]["hdCfPct"],60)
        self.assertAlmostEqual(result[0]["ixG60"],1)
        self.assertEqual(result[0]["fiveGp"],10)
        self.assertEqual(result[0]["fiveToiMinutes"],150)
        self.assertAlmostEqual(result[0]["toi"],20)
        self.assertNotEqual(result[0]["fiveToiMinutes"],result[0]["toi"] * result[0]["gp"])
    def test_no_invented_missing_metrics(self):
        row={"playerId":"5","name":"Missing","team":"CAR","position":"D","situation":"all","icetime":"1000","games_played":"2","I_F_points":"0"}
        result=mp.normalize([row])
        self.assertIsNone(result[0]["xgfPct"])
        self.assertIsNone(result[0]["a"])
        self.assertIsNone(result[0]["fiveGp"])
        self.assertIsNone(result[0]["fiveToiMinutes"])
    def test_no_fake_five_on_five_time_from_all_situations(self):
        all_row={"playerId":"1010101","name":"No Five","team":"BUF","position":"C",
                 "situation":"all","icetime":"7200","games_played":"12","I_F_points":"2"}
        five_row={"playerId":"1010101","name":"No Five","team":"BUF","position":"C",
                  "situation":"5on5","icetime":"0","games_played":"0"}
        result=mp.normalize([all_row,five_row])
        self.assertEqual(len(result),1)
        self.assertIsNone(result[0]["fiveToiMinutes"])
        self.assertIsNone(result[0]["fiveGp"])

    def test_fractional_minutes_derived_from_five_on_five_seconds(self):
        common={"playerId":"5555555","name":"Time Test","team":"NYR","position":"D",
                "games_played":"5","I_F_points":"1"}
        all_row=dict(common,situation="all",icetime="5000")
        five_row=dict(common,situation="5on5",icetime="2447",I_F_xGoals="0.2")
        result=mp.normalize([all_row,five_row])
        self.assertAlmostEqual(result[0]["fiveToiMinutes"],40.783,places=3)
        self.assertNotAlmostEqual(result[0]["fiveToiMinutes"],5000/60)

    def test_goalies_excluded(self):
        r={"playerId":"5","name":"Goalie","team":"CAR","position":"G","situation":"all","icetime":"1000","games_played":"2"}
        self.assertEqual(mp.normalize([r]),[])
if __name__=="__main__":unittest.main()
