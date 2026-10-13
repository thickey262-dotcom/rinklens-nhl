import sys
from pathlib import Path
import unittest
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
import fetch_ea_nhl27 as ea

class EANHL27Tests(unittest.TestCase):
 def test_official_table_parse(self):
  html='''<table><tr><th>RANK</th><th>PLAYER</th><th>OVR</th></tr><tr><td>1</td><td><a>#1 Connor McDavid</a></td><td>OVR 99</td><td>ACL 98</td><td>SPD 98</td><td>DEK 98</td><td>PAS 99</td><td>SLP 92</td><td>WSP 92</td></tr><tr><td>2</td><td>#2 Nathan MacKinnon</td><td>OVR 97</td><td>ACL 96</td><td>SPD 95</td><td>DEK 94</td><td>PAS 95</td><td>SLP 91</td><td>WSP 92</td></tr></table>'''
  rows=ea.parse_html(html,'C')
  self.assertEqual([x['ovr'] for x in rows],[99,97])
  self.assertEqual(rows[0]['name'],'Connor McDavid')
  self.assertEqual(rows[0]['spd'],98)
 def test_invalid_ratings_rejected(self):
  rows=ea.parse_html('<tr><td>1</td><td>#1 Fictional Name</td><td>OVR 999</td></tr>','C')
  self.assertEqual(rows,[])
 def test_name_normalization(self):
  self.assertEqual(ea.name_key('Tim Stützle'),ea.name_key('Tim Stutzle'))
 def test_never_generate_when_missing(self):
  with self.assertRaises(ValueError):ea.collect(fetcher=lambda url:'<html></html>')
if __name__=='__main__':unittest.main()
