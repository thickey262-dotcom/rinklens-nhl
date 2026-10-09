# RinkLens v2 — NHL analytics + eye-test scouting

An NHL statistics and independent scouting website. This is a deployable static web application with **automatic NHL data loading**, an optional **scheduled NHL data refresh workflow**, and an **optional Supabase database for private, cross-device scouting reports**.

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