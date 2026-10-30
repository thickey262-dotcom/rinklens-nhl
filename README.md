# RinkLens — MoneyPuck stats, NHL ranking-formula baseline, and fan Eye Test

The homepage has a short **What is RinkLens for?** introduction explaining that this is an approachable guide to advanced stats for everyday hockey fans: plain-English explanations, season-only comparisons, clear statistical ratings, and optional real fan Eye Test grades. It appears directly below the home hero so new visitors understand the site's purpose before reaching the data.

The site displays MoneyPuck player statistics alongside an Advanced Stats Score and a separate Eye Test system with a labeled statistical starting baseline:

1. **MoneyPuck statistics**: regular-season all-situations counting totals and 5-on-5 chance/shot metrics. `scripts/fetch_moneypuck.py` refreshes the public dataset daily using MoneyPuck's published season-summary CSV.
2. **Advanced Stats Score**: one transparent RinkLens 0–100 index derived from MoneyPuck's **five-on-five** metrics and total five-on-five minutes played. It is not a MoneyPuck-published score, Eye Test, or predictor of overall talent. Percentiles are calculated against qualified players at the same position (forwards and defensemen separately), within the selected season.

   | MoneyPuck five-on-five component | Forwards | Defensemen |
   | --- | ---: | ---: |
   | xGF% (expected goals share) | 35% | 40% |
   | ixG/60 (individual expected goals per 60) | 25% | 10% |
   | CF% (shot attempt share) | 10% | 15% |
   | FF% (unblocked attempt share) | 5% | 10% |
   | HDCF% (high-danger shot share) | 15% | 15% |
   | **Total five-on-five minutes played** | **10%** | **10%** |
   | **Total** | **100%** | **100%** |

   **Why total 5v5 minutes are weighted:** Total five-on-five ice time recognizes usage and availability, rather than only games dressed or shot/chance rates. It is converted to a same-position, same-season percentile and contributes 10% of the weighted index but **does not substitute for missing advanced metrics**. Four of the five advanced metrics are still required, including xGF% and ixG/60. Other missing metrics are not guessed: if exactly one optional advanced metric is missing, available weights are renormalized.

   **Eligibility:** A player must have at least 10 five-on-five games (`fiveGp`) and 100 five-on-five minutes (`fiveToiMinutes`). Early in a season (when the league's maximum all-situations GP is under 15), thresholds are 3 games and 30 minutes. An included component must have at least 30 same-position qualified peers. Only original MoneyPuck five-on-five values count; do not infer missing data from all-situations ice time.

   **Formula and reliability:** Convert all six components to same-position percentiles using midranks for ties; compute their weighted average; then apply `round(50 + (weighted average - 50) * effectiveGames / (effectiveGames + 10))`, where `effectiveGames = min(fiveGp, fiveToiMinutes / 12)`. Only total 5v5 minutes carry the explicit **10% usage/availability weight**. Games played is no longer directly weighted; 5v5 games and minutes still determine eligibility and the small-sample reliability adjustment. With identical underlying advanced statistics and games played, greater total 5v5 minutes increases the weighted score. **Small sample** means fewer than 20 five-on-five games or 300 five-on-five minutes; **Moderate sample** means fewer than 45 games or 750 minutes; **Larger sample** otherwise. These reflect sample size, not a scientific confidence interval. On-ice stats depend on teammates, opposition and deployment.

3. **Eye Test**: one separate, viewer-submitted opinion score (10–100) using **eight 1–10 traits** with different definitions for forwards and defensemen. Averages are not published until **three distinct signed-in accounts** have submitted valid ratings for the player and season. The player table still offers a one-click **Rate** button with an optional 1–10 quick-fill that explicitly fills all eight grades, followed by individual adjustments. One vote per user/player/season; updates or withdrawals require authentication.

   | Underlying trait | Forwards | Defensemen |
   | --- | --- | --- |
   | skating | Skating & speed | Skating & mobility |
   | shooting | Shooting & finishing | Point shots & offense |
   | puck | Puck skills & playmaking | Passing & puck movement |
   | iq | Offensive hockey IQ | Defensive reads & hockey IQ |
   | positioning | Offensive positioning | Gap control & positioning |
   | defense | Two-way defensive play | Defensive coverage |
   | compete | Compete level & physicality | Board battles & physicality |
   | transition | Transition offense | Breakouts & transition |

   Each account assigns eight whole-number ratings between 1 and 10. The protected aggregate computes `round(avg((sum of eight grades) / 8 * 10))` to produce a score out of 100, and publishes eight per-trait averages rounded to one decimal in the interface. No user vote is inferred from MoneyPuck numbers and nobody is presented as a professional scout by default. The Supabase migration is tracked at `supabase/migrations/20261013_eye_test_eight_traits_10_scale.sql`; it refuses to convert prior 1–5 votes silently. There were zero votes when the migration was applied.


The Advanced Stats Score is distinct from the formula-based starting Eye Test estimate. The combined Eye Test incorporates human submissions when available. The statistical starting value is explicitly disclosed and must never be presented as a scout's observation; no unsupported professional scouting or AI claims are made.

## Eye Test participation

The Eye Test feature uses the previously configured Supabase backend and its existing `community_eye_votes` (RLS-protected individual ballots) and `community_eye_scores` (aggregated, threshold-gated public values) tables. It does not use the unused `scouting_reports` table and does not publicize private notes. Authentication is via existing email magic link; account sign-in is optional for readers.

Eye Test scores are community opinions and may not reflect professional scouting accuracy. A signed-in account is not proof of reviewer expertise. The frontend never fabricates viewer grades. The combined score transparently combines a MoneyPuck-derived statistical baseline with actual saved viewer opinions; the Advanced Stats Score remains a separate rating.

## Statistical starting Eye Test baseline (NHL Career Ranking formula adaptation)

RinkLens calculates a 0–100 **Formula Baseline**, using the final position-specific weights from the user's separate NHL Player Ranking project. **Forwards:** games played 35%, average time on ice per game 20%, points per game 45%. **Defensemen:** games played 35%, average time on ice per game 25%, points per game 40%. The input data come exclusively from MoneyPuck's selected **season**, not an imported career database. Each component is converted to a same-season, same-position midrank percentile and combined by its weight. The weighted percentile is pulled toward a neutral 50 by GP/(GP+10) to limit one-game outliers. Eligible skaters must have positive GP and valid MoneyPuck TOI/points; there must be at least 20 same-position peers. Skaters missing inputs show a dash. The original career formula's 100-career-game threshold cannot be applied to a single season. Goalie ratings are not supported by the skater-only MoneyPuck feed.

**Blending with viewers:** until a public human grade exists, the **Combined Eye Test** equals the Formula Baseline and is labeled accordingly. A signed-in viewer who personally submits an Eye Test grade sees an **own-account private preview** weighted 70% formula baseline / 30% that viewer's eight-grade average; this does not expose the voter's private ballot to other accounts. After three different accounts have contributed a publishable aggregate, the **public Combined Eye Test** uses 50% formula baseline / 50% community grade. Four reviewers = 40% baseline / 60% community grade; five or more = 30% baseline / 70% community grade. The unblended community average and unblended baseline are visible separately in the player profile. Missing baseline falls back to actual available human rating; lack of both yields a dash. A formula-only score is **not** a real scouting observation and does not pretend to grade skating, compete, IQ, etc.

The existing MoneyPuck **Advanced Stats Score** is untouched and remains separate from the baseline and blended Eye Test. The existing Supabase RLS minimum-three-reviewer public threshold is not loosened; a private preview appears after the first viewer's own saved vote. Formula source: `eye-base.js`; coverage/weighting tests: `tests_moneypuck/test_eye_base.js`.

## Faster Eye Test rating

A successful Eye Test vote immediately shows **Your Rating (Private)**, calculated directly from the eight 1–10 values submitted by that signed-in account. It appears in the player row, detail panel, and head-to-head comparison even when there are fewer than three reviewers. The **Community Eye Test** continues to require at least three distinct signed-in accounts and is entirely separate from the private display. The frontend never inserts private scores into the public aggregate. Account switching or sign-out hides another account's scores; saved votes remain in the RLS-protected database and reappear after sign-in.\n\nThe player table includes a **Rate** button in each Eye Test cell. Clicking it opens the player's details with Eye Test first; the MoneyPuck statistical breakdown is still available in a collapsed section. After email sign-in, viewers tap large **1–10** radio choices across eight position-specific skills. The optional **Quick fill** buttons explicitly assign the selected grade to *all eight* skills; the viewer can revise any trait individually before confirming they watched the player and saving. This shortcut does not invent separate scouting evidence or alter the scoring method. Once rated, a player shows an **Edit rating** option, and signed-in viewers may update or withdraw their own vote.

The upgraded eight-grade database schema preserves per-account/player/season uniqueness, server validation, vote privacy, and the minimum three-reviewer threshold. The Eye Test module is now exposed to the player table so it can show existing public scores and add/edit actions. Advanced Stats Score is not affected.

## Selected-season reminders

The site displays plain-language reminders that every NHL statistic, comparison, and formula-based rating refers **only to the currently selected regular season**, not a career or all-time total. The top overview, Players table, comparison section, player-detail dialog and page status all identify the exact selected season (e.g., 2026–27). The reminders automatically update when the season selector changes, including during loading. Counting stats (GP, G, A, PTS) are all-situations totals **within that season**; advanced metrics and the Advanced Stats Score use that season's five-on-five values. Season-specific Eye Test votes and the statistical baseline are also scoped to the selected year. No scoring weights or source data are changed by these labels.

## Player table pagination

The player database displays **25 players per page** with Previous/Next navigation, an exact shown-range counter and page total. Results are filtered and sorted across the entire season **before** taking the 25-player slice. Searching, changing team or position, changing sorting, or loading another season resets to page 1. Eye Test updates and comparison selections preserve the current page. Zero-result searches hide pagination without disrupting the underlying statistics or ratings.

## Hosting and tests

GitHub Pages publishes only `index.html`, `money.css`, `money.js`, `stats-score.js`, `eye.css`, `eye.js`, the existing `cloud.js` and public `config.js` plus `data/moneypuck-*.json`. No private API keys should ever be committed; the publishable key is client-safe and backed by RLS. Tests run in GitHub Actions on each push, including real snapshot completeness checks. Published advanced ratings need verified MoneyPuck 5v5 ice-time values. An unavailable or outdated source never leads to backfilled or guessed exposure. Stored MoneyPuck snapshots are retained when a refresh fails, although deployment fails its completeness check if they predate the ice-time field.

MoneyPuck data is credited with source links for non-commercial, attributed use. Commercial use requires permission: https://moneypuck.com/data.htm

To verify locally: `node --check stats-score.js && node --check money.js && node --check eye.js && node tests_moneypuck/test_stats_score.js && node tests_moneypuck/test_moneypuck_snapshots.js && python -m unittest discover -s tests_moneypuck -v`.
