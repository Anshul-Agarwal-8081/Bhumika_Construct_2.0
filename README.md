# Bhūmikā

Bhūmikā is a role-based career-readiness demo that connects **Discover → Learn → Practice → Compete → Apply → Track**. It is built as a working local prototype rather than a chatbot or a static landing page.

## Run locally

Requirements: Node.js 20.19+ and npm.

```bash
npm install
npm run dev
```

Vite prints the local URL. The frontend demo needs no API keys.

## Backend and Learn Anything

Learn Anything uses an Express/TypeScript API, Supabase authentication and persistence, Tavily web search, YouTube video search, and Gemini roadmap generation. Other Bhūmikā paths remain local prototype flows.

1. Copy `.env.example` to `backend/.env`. Set `PORT`, `FRONTEND_ORIGIN`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and the Gemini, Tavily, and YouTube keys. Keep the service-role and provider keys on the backend; never put them in `VITE_*` variables.
2. Apply the migrations in order with Supabase SQL Editor: `202611030001_initial_schema.sql`, `202611030002_backend_integrity.sql`, `202611030003_learning_resource_dedup.sql`, then `202611030004_learning_roadmap_metadata.sql`. Migration 003 stops if it finds duplicate saved URLs for one user; it does not delete data. Review that report and resolve duplicates before retrying it.
3. Start the API from the project root with `npm run server`. Start Vite separately with `npm run dev`. Vite reads the backend port from `backend/.env` for local API calls. Set a public `VITE_API_BASE_URL` when the frontend and API use a different deployment origin.

Learn Anything endpoints include public resource search, protected saved-resource and roadmap operations, progress updates, registration, login, refresh-token exchange, password recovery, logout, and session validation at `/api/auth/me`. The health route is `/api/health`; it reports configuration and does not probe provider availability.

In Supabase Auth, enable the Email provider and set the Site URL and allowed redirect URLs to the frontend origins you use (for example, local Vite and production). Keep email confirmation enabled for production. Configure custom SMTP before sending confirmation or password-recovery email to real users; Supabase's default sender is restricted and rate-limited.

Run mocked and unit coverage with `npm test`. The real two-account Supabase/provider flow is opt-in: create two accounts through **Learn → Create account**, confirm each email if the project requires it, then provide `LEARNING_TEST_USER_A_EMAIL`, `LEARNING_TEST_USER_A_PASSWORD`, `LEARNING_TEST_USER_B_EMAIL`, and `LEARNING_TEST_USER_B_PASSWORD` in the shell environment and run `npm run test:integration`. The test creates and removes its own saved resource and roadmap. It does not create accounts or write credentials to files.

Provider variables for OpenAI and Jobs remain optional and are not required by Learn Anything. The current OpenAI WebRTC flow requires a trusted backend to create calls using `OPENAI_API_KEY`; no Realtime client or key exposure path has been added. See [OpenAI's WebRTC documentation](https://developers.openai.com/api/docs/guides/voice-webrtc).

## Build

```bash
npm run build
npm run preview
```

The production build is written to `dist/`.

## Demo flow

1. On the dashboard, continue the **Frontend Developer** path or open **Explore roles** and choose **Data Analyst**.
2. Review the role skills, roadmap, and curated resource links.
3. Open a lesson and complete its multiple-choice or scenario practice.
4. Review the score, rubric rationale, strengths, gaps, sample answer, and next practice recommendation.
5. Return to the dashboard to see XP, completed modules, and practice-based skill estimates.
6. Open **Arena**, create a local friend invite link, attempt the shared prompt, and use the local friend-result preview.
7. Open an **Example listing**, then choose **Prepare an application**.
8. Enter profile facts in **Resume Studio**, build and edit the grounded draft, copy or export/print it, then save it to **Application tracker**.
9. Change an application status. Moving it to **Applied** requires manual confirmation; the prototype never sends an email or submits an application.

## What is included

- Two complete learning paths: Frontend Developer and Data Analyst.
- Curated demo resource cards with provider, type, level, duration/price where available, and direct links.
- Short lessons, a fixed-answer quiz, and realistic text scenarios.
- Deterministic local evaluation with score rationale, rubric, strengths, gaps, sample answer, and next task.
- Local progress persistence for attempts, XP, module completion, streak, arena challenges, profile facts, and applications.
- Example opportunities and clearly labelled seeded leaderboard participants.
- Resume and application drafts generated only from fields entered in the profile. Missing evidence is surfaced as a question.
- Responsive navigation and layouts for laptop, tablet, and mobile widths.

## Architecture

- `src/data.ts` — typed demo roles, skills, modules, challenges, resources, and opportunities.
- `src/arenaData.ts` — Arena category metadata, topic labels, and first-attempt XP reward.
- `src/types.ts` — shared product entities and state types.
- `src/services/evaluate.ts` — deterministic demo scoring adapter. Replace this boundary with a server-side LLM adapter when a provider is configured; validate structured responses before rendering them.
- `src/services/storage.ts` — localStorage load/save/reset with malformed-data recovery.
- `backend/src` — Express API, Supabase auth middleware, Learn Anything provider search, Gemini roadmap generation, owner-scoped persistence, health, CORS, rate limiting, and centralized errors.
- `backend/migrations` — Supabase schema, row-level security policies, saved-resource URL deduplication, and roadmap metadata.
- `src/App.tsx` — feature screens and local demo flows.
- `src/index.css` — responsive design system and screen styling; Tailwind CSS is also configured through the Vite plugin.

## Demo limitations

- AI evaluation is a deterministic local heuristic, not a model judgment. The fixed-answer quiz uses an objective answer key.
- Curated resource cards in the role paths are illustrative; Learn Anything search uses live Tavily and YouTube results when configured.
- Opportunities are example listings, not verified or live job postings.
- Arena participants and rankings are seeded. Friend challenges are asynchronous local demos; there is no account system, server, or cross-device result sync.
- Demo role progress and profile facts stay in the current browser's localStorage. Learn Anything saved resources, roadmaps, and stage progress are stored in Supabase for signed-in users.
- Resume Studio does not verify claims or send email. It uses only the facts entered by the learner; review every draft before using it.
- No secrets are stored in the browser. A real model, search, or jobs integration should be called through a server-side endpoint.

## Arena implementation notes

- The Arena includes a local question bank across eight categories, challenge search and difficulty filters, timed text/quiz practice, attempt history, deterministic rubric feedback, XP-on-first-attempt, derived achievements, and attempt-based skill estimates.
- The countdown runs in the browser and is for practice only. It is not tamper-proof. Attempts and XP are stored in localStorage, so they are not authoritative or protected against editing.
- There is no backend, database, login, AI provider, secure code runner, global ranking service, or cross-device friend synchronization in this repository. The Arena does not execute submitted code. The leaderboard's other learners are illustrative demo participants.
- Friend links open the same prompt, but results cannot be synchronized or privately compared between accounts. No global/friends/college leaderboard or weekly competition service is connected.
- Category and overall scores are estimates from the local deterministic evaluator, not certified interview scores. Practice-time tracking is not implemented.

## Frontend environment variables

`VITE_API_BASE_URL` is an optional public API URL. For local development, Vite derives it from `PORT` in `backend/.env`; do not put provider credentials in Vite variables. Backend placeholders are listed in `.env.example`.
