# Muna – project status (read this first)

_Last updated: 2026-10-01. Keep this file current: update it at the end of every work session._

## What Muna is
A private "everything app" for **Jared and his wife**, installed on iPhone as a web app (Safari → Share → Add to Home Screen). Mainly a calendar + tasks. **Muna** is the mascot AND an AI assistant (Gemini) that chats, can use voice, and can change things inside the app (add / edit / complete / delete tasks, several at once).

The owner (Jared) does **not** code. Explain steps simply. Claude (you) does all Supabase work through the Supabase connector (migrations, edge functions, SQL). Jared only runs `git push origin main` in his terminal. Always tell him exactly which commands to run.

## Stack and where things live
| Thing | Where |
|---|---|
| Frontend | React 19 + Vite + TypeScript, in `src/` |
| Hosting | GitHub Pages, repo `jaredartt/Muna`, deployed by `.github/workflows/deploy.yml` on push to `main` |
| Backend | Supabase project `muna`, id `vlatdcjwxbflicomkbnr`, region eu-central-1, URL `https://vlatdcjwxbflicomkbnr.supabase.co` |
| AI | Edge Function `muna-chat` (`supabase/functions/muna-chat/index.ts`), model **`gemini-3.1-flash-lite`** (cheapest stable Gemini with function calling as of Oct 2026; override with secret `GEMINI_MODEL`) |
| Secrets | `GEMINI_API_KEY` is a Supabase Edge Function secret (set by Jared in the Supabase dashboard; never in code or chat) |
| Icons | Tabler Icons (`@tabler/icons-react`) – https://tabler.io/icons |
| Font | Quicksand via Google Fonts link in `index.html`. Titles weight **700**, everything else **400** (the owner asked for this) |
| Design | Figma file "Muna", key `6g4NsB4slpWiiEeDXRLZT8` (frame "Main menu" node `2:2`). Figma connector must be signed in as **jaredartt@gmail.com** (the file is in that account). Only the home screen exists in Figma so far |

`vite.config.ts` uses `base: './'` and the app uses **hash routing** (`#/calendar`), so it works under `https://jaredartt.github.io/Muna/` with no server config.

## Design rules (from Figma)
- Light: cream background `#fdf7eb`, white cards radius 20, text `#53535c`, muted `#8e8f9e`.
- Floating coral navigation pill `#e37b58` (home, calendar, chat, profile) with white icons.
- Muna = amber `#ffc57e` rounded-square face with two oval eyes, a smile, and a small speech bubble (`src/components/Muna.tsx`). Drawn by eye from the Figma screenshot; replace if the final artwork differs.
- Pastel task colours: mint, peach, lilac, sky, butter, rose (tokens in `src/styles.css`). Dark mode = same tokens redefined under `:root[data-theme='dark']`.
- Theme choice (light / dark / system) is in Profile, saved in the DB (`profiles.theme_pref`) and in localStorage (`muna-theme`) to avoid a flash on load.
- Dashboard cards in Figma that are NOT built yet because there is no data for them: **Sleep, Calories, Uni**. The home screen currently shows: Today's tasks, This week (tasks per day), Today (progress ring), All tasks (progress ring).

## Database (Supabase, all tables have Row Level Security ON)
Migrations are in `supabase/migrations/` (already applied; keep new ones there too AND apply with the connector).
- `households` – a shared "home" (name, `invite_code`).
- `profiles` – one per user (`id` = auth user id): `household_id`, `display_name`, `avatar`, `theme_pref`, `muna_personality`, `monthly_token_budget`. The app may only edit `display_name, avatar, theme_pref, muna_personality`.
- `tasks` – `household_id, created_by, assigned_to, title, notes, due_date, start_time, end_time, icon, color, completed, completed_at`. Realtime is on.
- `chat_messages` – per-user chat history with Muna.
- `ai_usage` – tokens used per user per month. RPCs: `get_ai_usage()`, `add_ai_usage()`.
- `private.allowed_emails` – **guest list**. Only `jaredartt@gmail.com` and `limisan98@gmail.com` can sign up (trigger `handle_new_user` rejects everyone else) and both automatically share one household. To add/change someone, edit this table with SQL.
- RPC `join_household(code)` is a fallback to join a partner's home by invite code.
- Security advisor note: `join_household`, `add_ai_usage`, `get_ai_usage` are SECURITY DEFINER functions callable by signed-in users on purpose.

## Muna (Gemini) – how it works
1. Chat page calls `supabase.functions.invoke('muna-chat', { message, timezone })` (JWT required).
2. The function checks the user, loads profile + personality + household tasks + last 20 messages, checks the monthly token budget, then loops with Gemini (max 5 tool rounds).
3. Tools (all run with the user's own JWT, so RLS applies): `create_tasks` (many at once), `update_task`, `set_tasks_completed`, `delete_tasks`, `list_tasks`.
4. It saves both chat messages, adds token usage, and returns `{ reply, changed, usage }`. If `changed`, the app reloads tasks.
5. **To teach Muna a new ability** (e.g. recipes): create the table + RLS migration, add UI, then add an entry to the `TOOLS` array in the edge function (declaration + handler) and mention the capability in `buildSystemPrompt`. Redeploy with the Supabase connector (`verify_jwt: true`).
6. `TASK_ICONS` / `TASK_COLORS` exist in BOTH `src/lib/icons.tsx` and the edge function – keep them in sync.
7. Personality: free text in Profile → stored in `profiles.muna_personality` → injected into the system prompt.
8. "Tokens left" in Profile = monthly allowance (default 1,000,000/person, change with SQL on `profiles.monthly_token_budget`) minus tokens counted from Gemini's `usageMetadata`. It is our own counter, not Google's billing balance. Suggest a Google Cloud budget alert for real spend.
9. Voice: Chat page uses the browser Web Speech API (`SpeechRecognition` for listening, `speechSynthesis` for speaking). Works in Safari on iPhone; reliability inside the home-screen (standalone) app varies. A higher-quality voice (e.g. Gemini Live / native audio) is a possible later upgrade.

## Screens (done)
Login (Google) · Home (dashboard like Figma) · Calendar (month grid, dots per day, day list, add task) · Chat with Muna (text + voice) · Profile (name, avatar, light/dark/system, Muna personality, tokens left, invite code, sign out). Task editor sheet (title, date, time, who, notes, colour, icon).

## Known limits / not done yet
- **Google Calendar sync is NOT built.** Profile shows a disabled "Connect (soon)" button. Plan: add the calendar scope to the Google login (or a second consent), store the Google refresh token server-side in an edge function, and sync two ways with the Calendar API. Needs the Google Cloud project (Calendar API enabled) – see setup below.
- The first build could not be test-compiled by Claude (npm was blocked in its workspace). **If the first GitHub Action fails, read the error in the Actions tab and fix it.** After the first successful local `npm install`, commit `package-lock.json` and switch the workflow from `npm install` to `npm ci`.
- No push notifications yet. Recipes, budget, etc. are future modules.
- Muna's mascot artwork is an approximation of Figma's.

## One-time setup checklist (status)
- [x] Supabase project created, schema + RLS + guest list applied
- [x] Edge function `muna-chat` deployed
- [x] Frontend code written
- [ ] Jared adds secret `GEMINI_API_KEY` (Supabase → Edge Functions → Secrets)
- [ ] Google Cloud OAuth client created; Client ID + Secret pasted in Supabase → Authentication → Providers → Google
- [ ] Supabase → Authentication → URL Configuration: Site URL `https://jaredartt.github.io/Muna/`, add the same as a Redirect URL (and `http://localhost:5173/` for local testing)
- [ ] GitHub repo → Settings → Pages → Source = "GitHub Actions"
- [ ] First `git push origin main` and green deploy
- [ ] Both Jared and his wife sign in once; add to iPhone home screen

## Working agreements
- Keep answers simple and step-by-step for Jared; he does not code.
- Don't ask him for secrets in chat (no API keys, no tokens). Gemini key → Supabase secrets dashboard only.
- Update this file after every change.
