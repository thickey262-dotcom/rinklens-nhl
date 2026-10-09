# Put RinkLens online with GitHub

GitHub account confirmed in ChatGPT: **thickey262-dotcom**. Proposed repository: **rinklens-nhl**.

## 1. Create the repository

Open https://github.com/new, choose owner `thickey262-dotcom`, name it `rinklens-nhl`, select **Public** (needed for GitHub Pages on GitHub Free), and click **Create repository**. Do not upload any secrets or Supabase service-role keys. You can leave README/.gitignore initialization unchecked; they are included in this package.

**Important:** This ZIP file must be *extracted* first. Uploading the ZIP itself will not publish the website.

## 2. Upload files

Once created, let ChatGPT know: **"I created thickey262-dotcom/rinklens-nhl"**. The connected GitHub plugin can then attempt to upload the project's text files directly if it has write access to the new repository. If ChatGPT cannot see it, open your GitHub App installation settings and give the integration access to `rinklens-nhl`.

Alternatively, open the repository → **Add file → Upload files**, then drag the **contents** of the extracted folder, including `.github/workflows/rinklens.yml`, into GitHub. Commit to `main`. Keep `index.html` at the repository root.

## 3. Turn on hosting

Repository → **Settings → Pages → Build and deployment → Source: GitHub Actions**.

Then go to **Actions → RinkLens — NHL stats and website → Run workflow**. The manual run downloads real current and historical NHL statistics and deploys the site. If the NHL statistics endpoint is down, the workflow will fail rather than displaying fictional statistics as real.

Expected website URL after the successful deployment (not live until these steps complete):

https://thickey262-dotcom.github.io/rinklens-nhl/

The workflow runs **daily at 06:17 UTC** and republishes the site in the *same run* after committing newly fetched data. This avoids the GitHub Pages limitation that a commit made using `GITHUB_TOKEN` does not itself start a new Pages build.

## 4. Private scouting notes (optional)

Site visitors can explore NHL stats without any cloud account. To make scouting notes sync between devices, create a Supabase project, run `supabase.sql` in its SQL editor, and put only its *public project URL* and *publishable/anon key* in `config.js` (never your service-role key). Configure the deployed Pages URL as an allowed authentication redirect. Full instructions are in `README.md`.

## Security and permissions

- The static site is public; do not put private scouting notes or API secrets in this repository.
- The `data/` snapshots contain public NHL numbers, not users' private scouting notes.
- Cloud scouting is disabled until Supabase is configured and a user signs in.
- The workflow needs repository Actions permissions to write contents, Pages deployments and id tokens. Depending on account defaults, Settings → Actions → General → Workflow permissions may also need to allow read and write.