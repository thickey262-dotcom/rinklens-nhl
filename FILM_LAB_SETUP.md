# RinkLens Film Lab — setup and limits

## Works immediately on GitHub Pages
Open Film Lab or Review film on an NHL player. Choose a local video (MP4/WebM, under 300 MB), identify your skater, manually capture moments or automatically sample six frames from a 2–120 second segment. Add time-stamped observations and optional human grades, saved only in the browser. Export JSON for backup. Full video and selected images are not automatically uploaded, and the original video is never stored on the site.

## Optional AI vision connection
Film-AI still-frame reviews require configuring your own Supabase project and private OpenAI API key. Without this setup, the AI button explains that the service is unavailable.

1. Create a Supabase project at https://supabase.com and enable email sign-in. Set the RinkLens Pages domain as an allowed authentication redirect.
2. Add the project URL and only its client-safe publishable key to the repository's config.js. Never put a service-role key or any model API key there.
3. Install the Supabase CLI from https://supabase.com/docs/guides/local-development/cli/getting-started. Link the project and deploy the function using the command: supabase functions deploy analyze-film
4. Add the OpenAI API key privately in the Supabase Edge Functions secrets, for example using: supabase secrets set OPENAI_API_KEY=YOUR_PRIVATE_VALUE
5. Sign in from RinkLens Account & Sync, open Film Lab, supply jersey/team identifier, choose 2–8 frames, confirm permission to process them, and press Review frames with AI.

The function requires Supabase JWT authentication, uses the OpenAI Responses API with store:false, and enforces a limited number of JPEG still frames. API usage may incur charges. Set spending limits and restrict site access if needed.

## What film AI can and cannot do

Only chosen stills are submitted to the model after explicit consent. No full video analysis, puck tracking, automated jersey recognition, movement trajectory, speed measurement, or shift-by-shift scouting is performed. Results are tentative, evidence-linked observations and optional provisional 1–5 trait suggestions, only if the target can be visually identified and enough frames support an observation. Unobserved traits remain ungraded, and no automatic overall eye-test score is inserted into player profiles.

Use only videos you own or have permission to process. NHL content and highlight footage may carry separate licensing restrictions; see https://www.nhl.com/info/terms-of-service.

## Validation

On pushes to the main branch, GitHub Actions runs Python and Node checks before shipping the Film Lab assets to GitHub Pages. Locally run: python -m unittest discover -s tests -v
