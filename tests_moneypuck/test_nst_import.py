import csv
import json
import tempfile
import unittest
from pathlib import Path
from scripts.import_nst_csv import convert, import_csv, normalize_percent


class NSTImportTests(unittest.TestCase):
    def test_percent_validation(self):
        self.assertEqual(normalize_percent("51.25%"), 51.25)
        self.assertEqual(normalize_percent("48.1"), 48.1)
        self.assertIsNone(normalize_percent("-"))
        self.assertIsNone(normalize_percent("not available"))
        self.assertIsNone(normalize_percent("110"))
        self.assertIsNone(normalize_percent("-3"))
        self.assertIsNone(normalize_percent("inf"))

    def test_import_manual_export_and_preserve_manifest(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            source = root / "manual.csv"
            destination = root / "data"
            with source.open("w", newline="", encoding="utf-8") as f:
                writer = csv.DictWriter(f, fieldnames=[
                    "Player", "Team", "Position", "xGF%", "CF%", "FF%", "HDCF%"
                ])
                writer.writeheader()
                writer.writerow({"Player": "Player A", "Team": "BUF", "Position": "D",
                                 "xGF%": "52.9", "CF%": "50.0",
                                 "FF%": "48.7", "HDCF%": "55.0"})
                writer.writerow({"Player": "Player B", "Team": "NYR", "Position": "C",
                                 "xGF%": "46.2", "CF%": "49.3",
                                 "FF%": "—", "HDCF%": ""})
            count = import_csv(source, "20262027", destination)
            self.assertEqual(count, 2)
            data = json.loads((destination / "nst-20262027.json").read_text())
            self.assertEqual(data["source"], "naturalstattrick")
            self.assertEqual(data["situation"], "5v5")
            self.assertEqual(data["seasonType"], "regular")
            self.assertEqual(data["adjustment"], "raw")
            self.assertEqual(data["players"][0]["xgfPct"], 52.9)
            self.assertIsNone(data["players"][1]["ffPct"])
            self.assertEqual(json.loads((destination / "nst-index.json").read_text())["seasons"], ["20262027"])
            import_csv(source, "20252026", destination)
            index = json.loads((destination / "nst-index.json").read_text())
            self.assertEqual(index["seasons"], ["20252026", "20262027"])

    def test_refuse_bad_headers_or_season(self):
        with self.assertRaisesRegex(ValueError, "player name"):
            convert([{"CF%": "52.1"}], ["CF%"], "20262027")
        with tempfile.TemporaryDirectory() as tmp:
            inp = Path(tmp) / "bad.csv"
            inp.write_text("Player,Team,Position,CF%\nTester,BUF,D,52\n")
            with self.assertRaisesRegex(ValueError, "At least two"):
                import_csv(inp, "20262027", Path(tmp) / "data")
            with self.assertRaisesRegex(ValueError, "Season must"):
                import_csv(inp, "20262028", Path(tmp) / "data")
            self.assertFalse((Path(tmp) / "data" / "nst-20262027.json").exists())


if __name__ == "__main__":
    unittest.main()
