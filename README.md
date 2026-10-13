# RinkLens — MoneyPuck statistics + Advanced Stats Score + Eye Test

The site displays MoneyPuck player statistics alongside two **distinct** 0–100 scores:

1. **MoneyPuck statistics**: regular-season all-situations counting totals and 5-on-5 chance/shot metrics. `scripts/fetch_moneypuck.py` refreshes the public dataset daily using MoneyPuck's published season-summary CSV.
2. **Advanced Stats Score**: one transparent RinkLens index derived exclusively from MoneyPuck's **five-on-five** expected-goal and shot metrics, never scouting or Eye Test input. Percentiles compare qualified same-season forwards to forwards and defensemen to defensemen. Position-specific weights:

   | MoneyPuck five-on-five metric | Forwards | Defensemen |
   | --- | ---: | ---: |
   | xGF% (expected-goal share) | 40% | 45% |
   | ixG/60 (individual expected goals per 60) | 30% | 10% |
   | CF% (shot attempts) | 10% | 15% |
   | FF% (unblocked shot attempts) | 5% | 10% |
   | HDCF% (high-danger shots) | 15% | 20% |

   Shot attempt shares are correlated, so they are intentionally downweighted versus expected-goal quality. More of the forward score comes from individual chance creation; more of the defense score comes from on-ice performance. The formula remains descriptive and does not isolate a player's impact from teammates, opponents or deployment.

   **Minimum five-on-five exposure:** `fiveGp >= 10` and `fiveToiMinutes >= 100` for an established season. Early seasons (highest all-situations GP under 15): minimum `fiveGp >= 3` and `fiveToiMinutes >= 30`. Player and peer values must be present in the original MoneyPuck CSV, not inferred from all-situations totals. Minimum 30 qualified same-position peers must have the metric. Four of the five metrics are required including xGF% and ixG/60. Renormalize weights only if one of the three optional metrics is unavailable. Missing mandatory inputs or missing 5v5 exposure yields a dash, never an invented score.

   **Score:** weighted average of same-position metric percentiles, using midranks for ties, then adjusted toward a neutral 50: `round(50 + (average - 50) * effectiveGames / (effectiveGames + 10))`. Here `effectiveGames = min(fiveGp, fiveToiMinutes / 12)`. This reduces early or low-ice-time extremes while preserving the relative ranking of qualified peers. The reliability label is **Small sample** (<20 five-on-five GP OR <300 five-on-five minutes), **Moderate sample** (<45 GP OR <750 minutes), or **Larger sample** otherwise. Those labels concern sample size, not a certified level of statistical certainty.

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
