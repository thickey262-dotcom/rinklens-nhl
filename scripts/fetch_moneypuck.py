#!/usr/bin/env python3
"""Fetch season-level skater statistics exclusively from MoneyPuck's public CSV.

Non-commercial use only; display prominent MoneyPuck.com attribution.
No NHL API calls, estimated scout ratings, or fabricated player records.
"""
import argparse
import csv
import datetime as dt
import io
import json
import math
import os
from pathlib import Path
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
BASE = "https://moneypuck.com/moneypuck/playerData/seasonSummary"


def number(row, key):
    try:
        raw = row.get(key)
        if raw is None or str(raw).strip() == "":
            return None
        value = float(raw)
        return value if math.isfinite(value) else None
    except (ValueError, TypeError):
        return None


def percent(row, key):
    value = number(row, key)
    if value is None:
        return None
    value = value * 100 if 0 <= value <= 1 else value
    return round(value, 2) if 0 <= value <= 100 else None


def nonnegative(row, key):
    value = number(row, key)
    return value if value is not None and value >= 0 else None


def high_danger_share(row):
    for_count = nonnegative(row, "OnIce_F_highDangerShots")
    against = nonnegative(row, "OnIce_A_highDangerShots")
    if for_count is None or against is None or for_count + against == 0:
        return None
    return round(100 * for_count / (for_count + against), 2)


def _best_by_player(rows, situation):
    selected = {}
    for row in rows:
        if row.get("situation") != situation:
            continue
        player_id = str(row.get("playerId", "")).strip()
        seconds = nonnegative(row, "icetime")
        if not player_id or not seconds:
            continue
        if player_id not in selected or seconds > (nonnegative(selected[player_id], "icetime") or 0):
            selected[player_id] = row
    return selected


def normalize(rows):
    """Keep all-situations counting stats distinct from five-on-five rates."""
    rows = list(rows)
    all_rows = _best_by_player(rows, "all")
    five_rows = _best_by_player(rows, "5on5")
    result = []
    for player_id, row in all_rows.items():
        position = str(row.get("position") or "").upper()
        games = nonnegative(row, "games_played")
        minutes = (nonnegative(row, "icetime") or 0) / 60
        name = str(row.get("name") or "").strip()
        if not name or position not in {"C", "L", "R", "D", "LW", "RW"} or games is None or games < 1:
            continue
        five = five_rows.get(player_id, {})
        five_seconds = nonnegative(five, "icetime")
        ixg = nonnegative(five, "I_F_xGoals")
        goals = nonnegative(row, "I_F_goals")
        primary = nonnegative(row, "I_F_primaryAssists")
        secondary = nonnegative(row, "I_F_secondaryAssists")
        assists = round(primary + secondary) if primary is not None and secondary is not None else None
        points = nonnegative(row, "I_F_points")
        if points is None and goals is not None and assists is not None:
            points = goals + assists
        result.append({
            "id": player_id,
            "name": name,
            "team": str(row.get("team") or "—").strip(),
            "pos": position,
            "gp": round(games),
            "g": round(goals) if goals is not None else None,
            "a": assists,
            "p": round(points) if points is not None else None,
            "shots": round(nonnegative(row, "I_F_shotsOnGoal")) if nonnegative(row, "I_F_shotsOnGoal") is not None else None,
            "toi": round(minutes / games, 3) if games and minutes else None,
            "p60": round(points * 60 / minutes, 3) if points is not None and minutes else None,
            "xgfPct": percent(five, "onIce_xGoalsPercentage"),
            "cfPct": percent(five, "onIce_corsiPercentage"),
            "ffPct": percent(five, "onIce_fenwickPercentage"),
            "ixG60": round(ixg * 3600 / five_seconds, 3) if ixg is not None and five_seconds else None,
            "hdCfPct": high_danger_share(five),
            "fiveGp": round(nonnegative(five, "games_played")) if nonnegative(five, "games_played") is not None else None,
            # MoneyPuck reports "icetime" in seconds. Never substitute all-situations TOI.
            "fiveToiMinutes": round(five_seconds / 60, 3) if five_seconds is not None and five_seconds > 0 else None,
        })
    return sorted(result, key=lambda p: (-(p["p"] if p["p"] is not None else -1), p["name"]))


def fetch(season):
    url = f"{BASE}/{season[:4]}/regular/skaters.csv"
    request = Request(url, headers={
        "User-Agent": "RinkLens/1.0 (non-commercial hockey statistics with MoneyPuck attribution)",
        "Accept": "text/csv",
    })
    with urlopen(request, timeout=90) as response:
        reader = csv.DictReader(io.TextIOWrapper(response, encoding="utf-8-sig", newline=""))
        required = {"playerId", "name", "team", "position", "situation", "icetime",
                    "games_played", "I_F_goals", "I_F_points",
                    "onIce_xGoalsPercentage", "onIce_corsiPercentage"}
        if not reader.fieldnames or not required.issubset(reader.fieldnames):
            raise ValueError("Unexpected MoneyPuck CSV columns; preserving last known snapshot")
        players = normalize(reader)
    if len(players) < 5:
        raise ValueError("MoneyPuck returned fewer than five skaters; preserving last known snapshot")
    return {
        "source": "moneypuck",
        "season": season,
        "updatedAt": dt.datetime.now(dt.timezone.utc).isoformat(),
        "upstream": url,
        "situation": "all counting stats / 5on5 advanced stats",
        "players": players,
    }


def save(snapshot):
    DATA.mkdir(parents=True, exist_ok=True)
    target = DATA / f"moneypuck-{snapshot['season']}.json"
    temp = target.with_suffix(".tmp")
    temp.write_text(json.dumps(snapshot, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    os.replace(temp, target)
    print(f"{snapshot['season']}: saved {len(snapshot['players'])} MoneyPuck skaters")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--seasons", nargs="+", default=["20262027", "20252026", "20242025"])
    args = parser.parse_args()
    refreshed = 0
    for season in args.seasons:
        if len(season) != 8 or not season.isdigit() or int(season[4:]) != int(season[:4]) + 1:
            print("Invalid season:", season)
            continue
        try:
            save(fetch(season))
            refreshed += 1
        except Exception as exc:
            print(f"{season}: MoneyPuck refresh unavailable; existing snapshot preserved: {exc}")
    if not refreshed and not any(DATA.glob("moneypuck-*.json")):
        raise SystemExit("No MoneyPuck data available and no prior snapshots to publish")


if __name__ == "__main__":
    main()
