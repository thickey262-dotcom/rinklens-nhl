#!/usr/bin/env python3
"""Import a user-provided, authorized Natural Stat Trick skater CSV export.

NO automated requests to naturalstattrick.com are performed. Run on a 5-on-5,
regular season, unadjusted skater export only, with approval to republish it.
CSV should include Player, Team, Position, and at least one of xGF%, CF%, FF%, HDCF%.
"""
import argparse
import csv
import datetime as dt
import json
import math
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
METRICS = {"xGF%": "xgfPct", "CF%": "cfPct", "FF%": "ffPct", "HDCF%": "hdCfPct"}


def key(header):
    return str(header or "").strip().lower().replace(" ", "").replace("_", "")


def field(columns, *aliases):
    lookup = {key(x): x for x in columns if x}
    for name in aliases:
        if key(name) in lookup:
            return lookup[key(name)]
    return None


def normalize_percent(value):
    if value is None or not str(value).strip() or str(value).strip() in {"-", "—"}:
        return None
    raw = str(value).strip().replace(",", "").rstrip("%")
    try:
        number = float(raw)
    except ValueError:
        return None
    if math.isfinite(number) and 0 <= number <= 100:
        return round(number, 2)
    return None


def convert(rows, columns, season):
    namecol = field(columns, "Player", "Player Name", "Name")
    teamcol = field(columns, "Team")
    poscol = field(columns, "Position", "Pos")
    idcol = field(columns, "Player ID", "playerId", "NHL ID")
    metriccols = {key_out: field(columns, key_in) for key_in, key_out in METRICS.items()}
    if not (namecol and poscol and teamcol):
        raise ValueError("The CSV must include player name, team and position columns.")
    if sum(bool(col) for col in metriccols.values()) < 2:
        raise ValueError("At least two of xGF%, CF%, FF%, HDCF% must be exported.")
    players = []
    for row in rows:
        name = str(row.get(namecol, "") or "").strip()
        pos = str(row.get(poscol, "") or "").strip().upper()
        team = str(row.get(teamcol, "") or "").strip().upper()
        if pos in {"LD", "RD"}:
            pos = "D"
        if pos not in {"C", "L", "R", "LW", "RW", "D", "F"}:
            continue
        if pos == "F":
            pos = "C"  # Forward group only; not an assertion about a real center's role.
        if not name or not team:
            continue
        player = {"name": name, "team": team, "pos": pos}
        if idcol:
            pid = str(row.get(idcol, "") or "").strip()
            if pid:
                if not pid.isdigit() or not 6 <= len(pid) <= 10:
                    continue
                player["id"] = pid
        for metric, col in metriccols.items():
            player[metric] = normalize_percent(row.get(col)) if col else None
        if any(player[m] is not None for m in metriccols):
            players.append(player)
    if not players:
        raise ValueError("No valid skater rows with named metrics; no export written.")
    return {
        "source": "naturalstattrick", "season": season, "seasonType": "regular",
        "situation": "5v5", "adjustment": "raw",
        "updatedAt": dt.datetime.now(dt.timezone.utc).isoformat(),
        "origin": "operator-supplied CSV export, not a live API",
        "players": players
    }


def import_csv(source, season, destination=DATA):
    if len(season) != 8 or not season.isdigit() or int(season[4:]) != int(season[:4]) + 1:
        raise ValueError("Season must be an eight-digit NHL season such as 20262027.")
    with open(source, newline="", encoding="utf-8-sig") as file:
        reader = csv.DictReader(file)
        if not reader.fieldnames:
            raise ValueError("CSV file has no headings.")
        snapshot = convert(reader, reader.fieldnames, season)
    destination.mkdir(parents=True, exist_ok=True)
    index_path = destination / "nst-index.json"
    if index_path.exists():
        index = json.loads(index_path.read_text(encoding="utf-8"))
        if index.get("source") != "naturalstattrick" or not isinstance(index.get("seasons"), list):
            raise ValueError("Existing Natural Stat Trick manifest is malformed.")
        seasons = index["seasons"]
    else:
        seasons = []
    file_path = destination / f"nst-{season}.json"
    data = json.dumps(snapshot, ensure_ascii=False, separators=(",", ":")) + "\n"
    temp = file_path.with_suffix(".tmp")
    temp.write_text(data, encoding="utf-8")
    os.replace(temp, file_path)
    index_out = {
        "source": "naturalstattrick",
        "seasons": sorted(set(seasons + [season])),
        "note": "Only authorized operator-provided, regular-season, unadjusted 5v5 CSV exports."
    }
    temp_index = index_path.with_suffix(".tmp")
    temp_index.write_text(json.dumps(index_out, indent=2) + "\n", encoding="utf-8")
    os.replace(temp_index, index_path)
    return len(snapshot["players"])


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--season", required=True)
    parser.add_argument("--csv", required=True, type=Path)
    parser.add_argument("--confirm-5v5-regular-unadjusted", action="store_true",
                        help="I exported a 5v5 regular-season unadjusted skater table.")
    parser.add_argument("--confirm-usage-permitted", action="store_true",
                        help="I have authorization to use and republish this export.")
    args = parser.parse_args()
    if not args.confirm_5v5_regular_unadjusted or not args.confirm_usage_permitted:
        parser.error("You must confirm the exact 5v5 context and permission to republish.")
    count = import_csv(args.csv, args.season)
    print(f"Imported {count} Natural Stat Trick skater rows for {args.season}. "
          "Commit data/nst-*.json and nst-index.json to publish.")


if __name__ == "__main__":
    main()
