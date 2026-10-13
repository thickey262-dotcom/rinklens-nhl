# RinkLens v2 — NHL analytics + eye-test scouting

An NHL statistics and independent scouting website. This is a deployable static web application with **automatic NHL data loading**, an optional **scheduled NHL data refresh workflow**, and an **optional Supabase database for private, cross-device scouting reports**.


## Community Eye Test — opt-in eyewitness voting

RinkLens now accepts **separate, voluntary six-trait community votes** from signed-in users who affirm they have actually watched the player. Voters choose 1–5 for skating, puck skills, hockey IQ, defensive play, compete level and transition. **Private scouting reports are NEVER published as votes automatically.** A vote can be edited or withdrawn, and it is stored in the linked Supabase database rather than browser storage. Voting is one account per player per season (not one person: determined abusers could create more accounts, and no independent expertise check is performed).

The public `community_eye_scores` table contains aggregate scores and trait averages **only after three distinct authenticated accounts** submit ratings. `community_eye_votes` has row-level security, so viewers can read only their own ballots. Individual voters' names, account IDs and raw scores are never in the public aggregate. Server triggers recompute aggregates on inserts, updates and deletions. The data model enforces six numeric scores from 1 to 5, unique account/player/season voting, non-anonymous Supabase accounts, and a short edit cooldown. Moderation, CAPTCHA, and verified-reviewer tiers are future enhancements, not currently claimed as active.

The **Eye Test Score** is 70% attributed professional scouting consensus and 30% community eyewitness scores when both qualify. If only one source qualifies, that source is shown explicitly, not relabeled as a complete consensus. Players with neither have **no eye-test score**. The personal scouting grade takes precedence in the existing 60% stats / 40% observational Combined score; if personal scouting is absent, the qualified Eye Test Score is used. **Statistical model ratings are never substituted for missing eyewitness evaluations.**

The community voter interface is located inside any real player's profile. Signed-in accounts use the existing secure email-link sign-in process. Ratings are season-specific; published prospect reports are only shown as a professional consensus for their relevant supported season. A minimum sample size is a privacy and reliability gate, not proof of rating quality. This is fan-submitted material, not a representation of professional expertise.

## Complete NHL player model coverage (2024–2027)

Every qualifying skater in the three NHL datasets receives an independently calculated **stats-only model rating**, not an eyewitness grade or professional scouting consensus: 920/920 in 2024–25, 940/940 in 2025–26 and 661/661 in 2026–27, as verified by the GitHub Actions build and coverage tests.

The model uses NHL public regular-season player summaries (points, goals, and shots per 60 minutes plus average time on ice), with MoneyPuck five-on-five expected-goal share and individual expected goals/60 where source data are available. Each input is percentile-ranked against same-season forwards or defensemen. Forward weights: points 30%, goals 20%, shots 16%, ice time 10%, expected-goal share 14%, individual expected goals 10%. Defensemen: points 25%, goals 10%, shots 13%, ice time 27%, expected-goal share 15%, individual expected goals 10%. Missing advanced inputs are excluded and the remaining metric weights renormalized. Data are smoothed toward a neutral score of 50 according to games played, and older seasons are included where available so very early seasons do not produce misleadingly extreme model ratings. The selected season never uses future seasons.

In the website, Model rating is clearly marked as **STATS ONLY** and has its own confidence statement, data-source links, and season-by-season method in each player profile. A missing or weak scouting report is not turned into a fabricated expert quote or source-backed score. The independent Scout consensus column still only shows ratings that meet the existing two-independent-publisher requirement. The existing private personal scouting scores have priority in the Combined score; model rating is intentionally NOT blended into that combined score to prevent double-counting the same stats.

Rebuild: python scripts/build_full_league_ratings.py. GitHub Actions runs that script during deployment and automatically publishes data/model-rating-SEASON.json for each season after NHL and available MoneyPuck data snapshots have been loaded. Tests assert full coverage, source data isolation, historical bounds and player identity matching. This is a descriptive statistical model, not a calibrated talent or scouting grade.

## Published Scouting Consensus — an automated, evidence-limited eye-test proxy

RinkLens can now display independent **published scouting assessments** alongside its existing NHL stats, Stats-Only Auto Scout Estimate, and your private manual grades. **This does not watch footage and should not be mistaken for an independently observed eye test.** Reports are often **historical draft/prospect assessments**, not evaluations of 2026–27 NHL performance.

**How it works:** The attributed, rights-conscious `scouting/source_catalog.json` contains original short paraphrases of vetted editorial scouting observations with source, byline, date (if known), and original source link. `scripts/build_scouting_consensus.py` scores the six skill dimensions using a fixed transparent five-level vocabulary. For a skill to receive a number, at least **two different publishers** must make compatible assessments. Conflicting evaluations (>1 level apart) suppress that skill entirely. A 0–100 overall score appears only when at least **three skills** have agreed evidence, including a defensive, competitive, or transition skill. Lack of coverage does **not** imply a bad player and is shown as a dash.

The user-facing **Scout consensus** column is separate from **Your grade**. Only qualified published consensus is allowed as a fallback for the existing Combined score; the owner's completed six-skill rating always wins. **No data is written to personal scouting reports or cloud accounts.** The profile shows the original linked reports and paraphrased evidence, including withheld/disputed traits. RinkLens is independent of all cited scouting publishers.

**Current scope is deliberately narrow:** Initial source registry includes five recent prospects for whom multiple public analyst reports were reviewed. Four currently satisfy the overall scoring threshold. Other NHL players remain unscored until sufficiently vetted, independent reports become available. Do not extend ratings by guessing, scraping paywalled text, or converting statistics to a human eye-test grade.

The public site automatically rebuilds these scores on GitHub Pages deployments, including scheduled refreshes. **Rebuilding is not the same as discovering new source reports:** new verified, attributed evaluations must be added to the registry. The current scorer is a **deterministic text-evidence rubric**, not a Gemini AI model; the Supabase Gemini key used for the retired Film Lab is **not** read by this pipeline. NHL EDGE skating measures and MoneyPuck data remain separately labeled statistics and are not silently turned into scouting opinions. Automated report discovery may be added through a separate supervised update workflow.

## Easy-to-read interface (2026-10-12)

The homepage has a three-step guide. The player table initially shows the essential columns; visitors may toggle advanced metrics on. Visible definitions explain every major score, and larger high-contrast text is the default. Use **A+ Larger text** in the top toolbar for an additional size increase that stays saved on that device. Player links work with Enter or Space, and site controls show a visible keyboard focus. No scoring formulas, private reports, or source data are changed.

## Player Report Cards (2026-10-12)

Click a skater in Player Database to view six numerical metrics, position-specific season percentiles, plain-English explanations and your own six-trait eye-test grades. Positions are compared separately (C, LW, RW, D). 5v5 metrics include xGF%, CF%, FF%, ixG/60 and HDCF%; points/60 is all situations. Percentiles use midranks for ties and require at least 15 eligible same-position players. The games-played minimum is 3 during early-season play (league maximum <15 GP), and 10 afterward. No fabricated scouting grades or missing-value percentiles are shown.

Metrics are descriptive, not isolated impact or predictive rankings, and early-season comparisons are volatile. MoneyPuck advanced data is credited for non-commercial use; contact the provider for commercial permission.

The GitHub Pages workflow runs Python integration tests plus a Node.js percentile test before deploying the report card assets.

## Website mission statement

> This website is for us eye-test dummies who don’t understand advanced stats. Here’s where you can learn what the numbers actually mean, so you can sound smarter in front of your friends.

This statement is displayed prominently on the homepage below the hero banner.

## Quick start (no accounts necessary)

From the folder containing `index.html`:

```sh
python -m http.server 8000
```

Open **http://localhost:8000**. The site starts in clearly labelled fictional **DEMO** mode, and immediately attempts to load **real NHL skater statistics** for the selected season. It tries a local verified daily snapshot first (`data/nhl-SEASON.json`), then the NHL Stats REST endpoint, then an explicitly labelled previously fetched real-data cache. If none is accessible, it stays in demo mode (it does NOT pass fictional data off as real).

The `Refresh NHL stats` button attempts the direct public endpoint before falling back to the snapshot/cache. Select a season to load that season. NHL website/API access, cross-origin settings, rate-limits and API schema may change; this is an independently developed project, not officially supported or endorsed by the NHL.

## GitHub repository and automatic deployment

The included **`.github/workflows/rinklens.yml`** workflow publishes the website through GitHub Pages. On push to `main`, it deploys the existing source and real-data snapshots. Each day at **06:17 UTC**, and whenever you manually run the workflow, it also fetches/validates current and historical NHL skater stats, commits any changed snapshots, and publishes them in **the same run**. GitHub cron scheduling is best-effort, not an exact alarm. The NHL public endpoint needs to be reachable for data refreshes. No NHL API key is required for this fetcher.

For step-by-step setup with the connected GitHub account, see **`GITHUB_SETUP.md`**.

**Why deployment shares a workflow with refresh:** A commit created with GitHub Actions' built-in `GITHUB_TOKEN` does not trigger another Pages build. Combining data refresh and deploy means scheduled updates are actually published.

To refresh locally (requires internet):

```sh
python scripts/fetch_nhl.py --seasons 20262027 20252026 20242025
```

The script validates season IDs, ignores duplicate/goalie/no-game entries, retries transient errors, timestamps provenance, and atomically replaces each snapshot *only after* a valid fetch. It does not auto-refresh on a local computer unless you schedule it yourself.

**Important:** The scheduled workflow starts only after this project's files are in a GitHub repository, GitHub Actions is permitted to run, and GitHub Pages is configured for **GitHub Actions** deployments. A standalone ZIP is not a running hosted website.

## Add permanent account-based scouting storage (Supabase)

Cloud sync is **optional** and requires your own Supabase project. Until configured, reports and watchlists remain in this browser, and no scouting notes are sent to any cloud database.

1. Create a new project at https://supabase.com.
2. In its SQL Editor, execute the included **`supabase.sql`** file. This creates `scouting_reports` and `watchlist` tables with **row-level security**. Each authenticated user can access only their own rows. Both tables block anonymous access.
3. In Supabase → Authentication → Providers, enable email sign-in. Configure email/OTP sign-in; a production application should set up an appropriate SMTP provider, abuse/rate limiting and email templates.
4. In Authentication → URL Configuration, set the **Site URL** and allowed **Redirect URLs** to the deployed website's exact `https://...` URL. For local testing, also allow `http://localhost:8000/` if desired.
5. Find the Supabase **Project URL** and **publishable key (or legacy anon key)** in your project's API settings. Open **`config.js`**, and fill `supabaseUrl` and `supabasePublishableKey` with those public client values. Both values are intended to be visible to a browser. **Never paste a service-role/secret key, database password or private token into website files.**
6. Publish the changed `config.js` with the site. Open **Account & sync**, request a secure sign-in link, and click the email link. The browser then loads your private scouting reports and watchlist. Use the same email on another device to see them there.
7. Existing guest/browser-only reports are NOT uploaded automatically. After signing in and loading real NHL stats, use **Import this browser's guest reports** to copy valid local reports for the currently selected season to the account.

When signed in, newly saved reports and watchlist edits are cached locally in the signed-in user's namespaced storage, queued, and synced to Supabase. If the network fails, they remain locally queued and can be retried from **Sync reports now**. Pending offline changes are held **on that device**, not visible on other devices until synced. When signed out, only guest data is shown on that device. This is a simple last-write-wins model and not yet a multi-scout collaboration or version history system.

**Security**: Database row-level security limits each user to their own data; authentication is handled through Supabase Auth. RLS policies and table permissions are in `supabase.sql`. Before a public launch, verify the database policies with access-control tests, configure a permitted origin/redirect list, and review data retention and privacy policy.

## Advanced (5-on-5) numbers

The site retains manual import of a MoneyPuck season-summary skaters CSV file. Advanced views include on-ice xGoals share (45%), Corsi share (20%), individual 5v5 xGoals/60 (20%), and points/60 (15%), as *position-relative* percentiles. NHL box-score data and advanced CSV imports are displayed with different source descriptions; the model is provisional and **not** an official player-value statistic.

MoneyPuck's published data page (https://moneypuck.com/data.htm) permits noncommercial uses and certain journalism with attribution and asks for permission for other uses. **This site does not automatically scrape, download, redistribute or commercially republish MoneyPuck data.** Obtain permission for the use and any hosting or automation you intend. For a production advanced-data sync, supply a data source with the required rights and adapt a licensed ingestion job.

## Scout assessment and evaluation methodology

- Production index: position-relative rank of NHL total-season points/60 × 55%, shots/60 × 30%, goals/60 × 15%.
- Advanced index (import only): 5v5 xGoals share × 45%, Corsi share × 20%, individual xGoals/60 × 20%, points/60 × 15%.
- Eye-test score: manually scored 1–5 for skating, puck skills, hockey IQ, defensive play, compete level and transition; average times 20.
- Combined score: 60% production/advanced index + 40% independent scouting score by default; change weighting in Compare. Missing scouting grades remain **unscored**.
- Scores are experimental descriptive tools, not validated forecasts, WAR-style isolated player impacts or recommendations about roster value.

## Running checks

```sh
node --check app.js
node --check cloud.js
python -m unittest discover -s tests -v
```

## Files

- `index.html`, `styles.css`, `app.js` — interface, scouting and source displays
- `config.js`, `cloud.js` — optional browser-to-Supabase authentication/sync
- `supabase.sql` — protected cloud database schema and per-user policies
- `scripts/fetch_nhl.py` — NHL data downloader and validator
- `.github/workflows/rinklens.yml` — tests, daily NHL data refresh, and GitHub Pages publication
- `tests/test_fetch_nhl.py` — data normalization tests
- `data/` — generated real NHL snapshots; not fabricated demo statistics
- `GITHUB_SETUP.md` — first-time repository setup and publishing instructions

## Next production improvements

Add a properly licensed automated advanced statistics provider, real data-source monitoring, scout permissions/team collaboration and immutable observation history, player/team detail pages, stronger statistical models, better goalie coverage, additional seasons, automatic tests for authenticated database operations and legal/privacy policies before inviting public accounts.

## 5v5 advanced metrics on every NHL player profile

The player database now shows **xGF% and CF%** where available, and opening a skater shows **xGF%, CF%, FF%, individual expected goals per 60, and high-danger shot share**, each linking directly to an interactive Stats School explanation. If a player or season has no source record, the UI shows **—**, not made-up advanced values. NHL boxscore totals are all-situations; the advanced measures are explicitly **5v5**.

`python scripts/fetch_advanced.py --seasons 20262027 20252026 20242025` downloads the publicly listed [MoneyPuck season skater CSVs](https://moneypuck.com/data.htm) and writes the compact per-player snapshot as `data/advanced-YYYYYYYY.json`. The GitHub Action now requests them daily or on a manual run, preserves existing snapshots on failures, and publishes them next to NHL files.

**Licensing:** MoneyPuck's downloads are free for **non-commercial** purposes and journalists' ad-hoc use, with **credit to MoneyPuck.com** wherever their information appears. Other uses require permission at the email on their download page. This website must remain non-commercial unless permission is obtained. Never scrape other site pages.

`xGF%`, `CF%`, `FF%` and `HDCF%` are *on-ice* shares, not isolation-adjusted impact measures. `ixG/60` is *individual* 5v5 expected goals per 60 minutes. Different providers may define high-danger differently.
