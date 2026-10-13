# RinkLens — MoneyPuck statistics + one Eye Test score

The site displays exactly two kinds of player information:

1. **MoneyPuck statistics**: regular-season all-situations counting totals and 5-on-5 chance/shot metrics. `scripts/fetch_moneypuck.py` refreshes the public dataset daily using MoneyPuck's published season-summary CSV.
2. **Eye Test**: one separate community eyewitness opinion score (20–100) from people who affirm they watched that player in the chosen season. Signed-in viewers rate six traits 1–5. The protected Supabase database computes the single public score. An Eye Test appears only after three distinct signed-in accounts contribute, to reduce identifiability. Otherwise the UI shows **—**. There is no model-estimated substitute.

No auto-scout ratings, official game ratings, "combined score", published-professional consensus column, statistical rating index, or speculative eye-test scores appear.

## Eye Test participation

The Eye Test feature uses the previously configured Supabase backend and its existing `community_eye_votes` (RLS-protected individual ballots) and `community_eye_scores` (aggregated, threshold-gated public values) tables. It does not use the unused `scouting_reports` table and does not publicize private notes. Authentication is via existing email magic link; account sign-in is optional for readers.

Scores are a community opinion and may not reflect professional scouting accuracy. A signed-in account is not proof of reviewer expertise. The frontend never fabricates missing scores or mixes MoneyPuck statistics into the Eye Test.

## Hosting and tests

GitHub Pages publishes only `index.html`, `money.css`, `money.js`, `eye.css`, `eye.js`, the existing `cloud.js` and public `config.js` plus `data/moneypuck-*.json`. No private API keys should ever be committed; the publishable key is client-safe and backed by RLS. Tests run in GitHub Actions on each push. Stored MoneyPuck snapshots are reused when a refresh fails.

MoneyPuck data is credited with source links for non-commercial, attributed use. Commercial use requires permission: https://moneypuck.com/data.htm

To verify locally: `node --check money.js && node --check eye.js && python -m unittest discover -s tests_moneypuck -v`.
