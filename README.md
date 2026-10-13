# RinkLens — MoneyPuck-only NHL statistics

The published website now displays **only source data from MoneyPuck**. It has no manual or automated eye-test scores, no scouting consensus, no combined ratings, no community voting, and no Supabase sign-in.

## Published sections

Overview, searchable player table, two-player comparisons, metric definitions, and source attribution. All-situations counting totals (GP, G, A, PTS, P/60) are distinct from 5-on-5 advanced metrics (xGF%, CF%, FF%, ixG/60, HDCF%).

## Data and updating

`scripts/fetch_moneypuck.py` retrieves public MoneyPuck season summary skater CSVs and creates `data/moneypuck-SEASON.json`. The GitHub Pages workflow fetches data on pushes, every day, and on manual dispatch. If MoneyPuck is unavailable, existing verified snapshots remain in place; on a fresh site without any snapshot the build fails instead of showing fake numbers.

No other data sources or scoring models appear on the published site. Old, unused source files remain in Git history for reversibility, but the deployment intentionally publishes only `index.html`, `money.css`, `money.js`, and the MoneyPuck snapshots.

## License

Use MoneyPuck data for non-commercial purposes and display prominent source attribution. For commercial licensing, seek MoneyPuck permission: https://moneypuck.com/data.htm

Run tests: `python -m unittest discover -s tests_moneypuck -v`.
