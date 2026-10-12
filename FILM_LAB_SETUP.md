# RinkLens Film Lab — Free Google Gemini configuration

## Available now without an API key
On https://thickey262-dotcom.github.io/rinklens-nhl/ open Film Lab or Review film from a player profile.
Choose a local MP4 or WebM video (under 300 MB), identify the skater, capture 2–8 frames, then write and export time-stamped notes. The full video never leaves the browser. AI cannot overwrite human scouting grades.

## Enable Gemini 2.5 Flash-Lite using its free tier
The server uses ONLY model gemini-2.5-flash-lite. Current Google pricing lists free image input and text output for eligible free-tier projects, subject to limits. Google may use free-tier prompts and images to improve its products; avoid uploading sensitive/private footage.

1. Create a Gemini API key at https://aistudio.google.com/api-keys in a Google project with NO paid billing attached. Do not enable paid billing. Check your tier and quotas at https://aistudio.google.com/usage .
2. In Supabase open https://supabase.com/dashboard/project/tepultvonkdphiechirx/functions/secrets .
3. Add a private secret named GEMINI_API_KEY with the key from AI Studio. Do not put it into GitHub, ChatGPT messages, or public config.js. No OpenAI key is needed.
4. On RinkLens use Account & Sync to sign in. For magic-link redirects, allow https://thickey262-dotcom.github.io/rinklens-nhl/ under Supabase Authentication URL Configuration.
5. Sign in and open Film Lab. Click **Check Gemini connection** to verify that Google accepts the key and lists the selected model. The check sends no video and generates no AI tokens. Then select permitted footage, identify jersey/team cues, choose 2–8 frames, review the Google privacy notice, and select Review frames with AI.

The check cannot confirm the Google project's billing status or actual image-inference success. Newly created Google projects may lack access to Gemini 2.5 Flash-Lite, even with a valid key.

There is no paid-provider fallback or automatic retry on quota exhaustion. On HTTP 429, the function reports that the free quota is exhausted and declines further processing. This code never enables paid billing. However, if you deliberately use a Gemini key belonging to a billed Google project, Google may charge according to that project's settings—the server cannot determine or override the Google billing tier.

## Authentication and evidence safeguards
- The Supabase gateway uses verify_jwt=false for modern publishable API keys, but every POST is verified against Supabase Auth /auth/v1/user using the signed-in user's bearer token. Anonymous public API keys are never sufficient.
- Server validates explicit consent:true, player ID, jersey/team identifier, 2–8 JPEG frames, body size limits and frame timestamps. The origin is restricted to the RinkLens GitHub Pages host.
- Only selected JPEG stills, not original video, are sent to Gemini. The server validates model JSON, requires observed evidence matching actual timestamps and at least two distinct frames before any tentative rating (1–5) is accepted. Identity must be confirmed and confidence medium/high.
- Hockey motion, skating speed, compete level and decision-making cannot be determined reliably from sparse frames. AI findings require human verification and NEVER overwrite manual eye-test or Auto Scout grades.
- The Gemini key is stored only in a server secret; nothing is included in publicly deployed HTML, JavaScript or GitHub Pages.

## Tests
GitHub Actions runs Python and Node tests. The mock Node integration test tests signed-in authorization, no-key disabled behavior, server-side consent enforcement, Gemini-only request formatting, quota 429, and score evidence checks. The mocked test does NOT demonstrate real model performance; a live AI test requires your private Gemini key.

## Footage rights
Use only footage you have permission to process. NHL game content may have licensing restrictions; do not scrape or redistribute broadcasts.

## Official documentation
Google pricing: https://ai.google.dev/gemini-api/docs/pricing
Google rate limits: https://ai.google.dev/gemini-api/docs/rate-limits
Google Gemini API: https://ai.google.dev/gemini-api/docs/generate-content/text-generation
