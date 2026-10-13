# RinkLens — MoneyPuck statistics + Advanced Stats Score + Eye Test

The site displays MoneyPuck player statistics alongside two **distinct** 0–100 scores:

1. **MoneyPuck statistics**: regular-season all-situations counting totals and 5-on-5 chance/shot metrics. `scripts/fetch_moneypuck.py` refreshes the public dataset daily using MoneyPuck's published season-summary CSV.
2. **Advanced Stats Score**: one transparent RinkLens 0–100 index derived from MoneyPuck's **five-on-five** metrics and five-on-five games played (GP). It is not a MoneyPuck-published score, Eye Test, or predictor of overall talent. Percentiles are calculated against qualified players at the same position (forwards and defensemen separately), within the selected season.

   | MoneyPuck five-on-five component | Forwards | Defensemen |
   | --- | ---: | ---: |
   | xGF% (expected goals share) | 35% | 40% |
   | ixG/60 (individual expected goals per 60) | 25% | 10% |
   | CF% (shot attempt share) | 10% | 15% |
   | FF% (unblocked attempt share) | 5% | 10% |
   | HDCF% (high-danger shot share) | 15% | 15% |
   | **Five-on-five games played (GP)** | **10%** | **10%** |
   | **Total** | **100%** | **100%** |

   **Why GP is weighted:** It recognizes availability and durability rather than just chance/shot rates. Games played is converted to a same-position percentile. It supplies 10% of the weighted index but **does not substitute for missing advanced metrics**. Four of the five advanced metrics are still required, including xGF% and ixG/60. Other missing metrics are not guessed: if exactly one optional advanced metric is missing, available weights are renormalized.

   **Eligibility:** A player must have at least 10 five-on-five games (`fiveGp`) and 100 five-on-five minutes (`fiveToiMinutes`). Early in a season (when the league's maximum all-situations GP is under 15), thresholds are 3 games and 30 minutes. An included component must have at least 30 same-position qualified peers. Only original MoneyPuck five-on-five values count; do not infer missing data from all-situations ice time.

   **Formula and reliability:** Convert all six components to same-position percentiles using midranks for ties; compute their weighted average; then apply `round(50 + (weighted average - 50) * effectiveGames / (effectiveGames + 10))`, where `effectiveGames = min(fiveGp, fiveToiMinutes / 12)`. GP thus influences the index in **two explicitly different ways**: 10% durability/availability and a conservative sample-size reliability adjustment. With equal on-ice rates, playing more games can improve the rating. **Small sample** means fewer than 20 five-on-five games or 300 five-on-five minutes; **Moderate sample** means fewer than 45 games or 750 minutes; **Larger sample** otherwise. These reflect sample size, not a scientific confidence interval. On-ice stats depend on teammates, opposition and deployment.

3. **Eye Test**: one separate community eyewitness opinion score (20–100) from people who affirm they watched that player in the chosen season. Signed-in viewers rate six traits 1–5. The protected Supabase database computes the single public score. An Eye Test appears only after three distinct signed-in accounts contribute, to reduce identifiability. Otherwise the UI shows **—**. There is no model-estimated substitute.

No auto-scout ratings, official game ratings, "combined score", published-professional consensus column, additional statistical models, or speculative eye-test scores appear. The two available scores are never blended.

## Eye Test participation

The Eye Test feature uses the previously configured Supabase backend and its existing `community_eye_votes` (RLS-protected individual ballots) and `community_eye_scores` (aggregated, threshold-gated public values) tables. It does not use the unused `scouting_reports` table and does not publicize private notes. Authentication is via existing email magic link; account sign-in is optional for readers.

Eye Test scores are community opinions and may not reflect professional scouting accuracy. A signed-in account is not proof of reviewer expertise. The frontend never fabricates missing scores or mixes MoneyPuck statistics into the Eye Test.

## Player table pagination

The player database displays **25 players per page** with Previous/Next navigation, an exact shown-range counter and page total. Results are filtered and sorted across the entire season **before** taking the 25-player slice. Searching, changing team or position, changing sorting, or loading another season resets to page 1. Eye Test updates and comparison selections preserve the current page. Zero-result searches hide pagination without disrupting the underlying statistics or ratings.

## Hosting and tests

GitHub Pages publishes only `index.html`, `money.css`, `money.js`, `stats-score.js`, `eye.css`, `eye.js`, the existing `cloud.js` and public `config.js` plus `data/moneypuck-*.json`. No private API keys should ever be committed; the publishable key is client-safe and backed by RLS. Tests run in GitHub Actions on each push, including real snapshot completeness checks. Published advanced ratings need verified MoneyPuck 5v5 ice-time values. An unavailable or outdated source never leads to backfilled or guessed exposure. Stored MoneyPuck snapshots are retained when a refresh fails, although deployment fails its completeness check if they predate the ice-time field.

MoneyPuck data is credited with source links for non-commercial, attributed use. Commercial use requires permission: https://moneypuck.com/data.htm

To verify locally: `node --check stats-score.js && node --check money.js && node --check eye.js && node tests_moneypuck/test_stats_score.js && node tests_moneypuck/test_moneypuck_snapshots.js && python -m unittest discover -s tests_moneypuck -v`.
