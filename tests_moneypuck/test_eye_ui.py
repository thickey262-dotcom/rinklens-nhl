import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

class EyeTestUI(unittest.TestCase):
    def test_one_rating_only(self):
        html = (ROOT/"index.html").read_text(encoding="utf-8")
        js = (ROOT/"money.js").read_text(encoding="utf-8")
        eye = (ROOT/"eye.js").read_text(encoding="utf-8")
        for forbidden in ["model-ratings.js", "scouting-consensus.js", "autoscout.js", "community-eye.js", "Combined score", "Computer estimate", "Stats score"]:
            self.assertNotIn(forbidden,html)
        self.assertIn("Eye Test",html)
        self.assertIn("RinkEye?.display",js)
        self.assertIn("Your Rating (Private)",eye)
        self.assertIn("personalScore",eye)
        self.assertIn("community_eye_scores",eye)
        self.assertIn("community_eye_votes",eye)
        self.assertIn("Number(row.reviewer_count) < 3",eye)
        self.assertIn("get(id)",eye)
        self.assertIn("data/moneypuck-",js)

if __name__=="__main__":
    unittest.main()
