# Muna – project status (read this first)

_Last updated: 2026-10-01 (Google Calendar, voice notes, filled icons, profile colour/icon added). Keep this file current: update it at the end of every work session._

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
| Secrets | Supabase Edge Function secrets (set by Jared in the dashboard; never in code or chat): `GEMINI_API_KEY`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` (same Google OAuth client used for login) |
| Icons | Tabler Icons (`@tabler/icons-react`), **Filled** variants wherever one exists (names like `IconHomeFilled`); symbol-like icons (plus, check, x, chevrons, send, copy, logout, volume) have no filled version so the outline is used. https://tabler.io/icons |
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
- `households` – a shared "home" (name, `invite_code`, `muna_personality` = the shared personality text).
- `profiles` – one per user (`id` = auth user id): `household_id`, `display_name`, `avatar` (a Tabler filled icon name, e.g. `IconPawFilled`), `avatar_color` (mint/peach/lilac/sky/butter/rose), `theme_pref`, `monthly_token_budget`, and the legacy unused `muna_personality`. The app may only edit `display_name, avatar, avatar_color, theme_pref`.
- `tasks` – `household_id, created_by, assigned_to, title, notes, due_date, start_time, end_time, icon, color, completed, completed_at, sync_google` plus server-only `google_event_id, google_owner` (the app cannot write those; column-level grants).
- `tasks.repeat` (jsonb, null = once) holds the repeat rule; `task_completions(task_id, occ_date, household_id, completed_by, completed_at)` = one row per ticked day of a repeating task (RLS by household, realtime on). Migration 6.
- `google_connections` – `user_id, refresh_token`. RLS on, NO policies: only the edge functions (service role) can read it. RPCs: `save_google_connection(token)`, `disconnect_google()`, `get_google_status()` (who in the home is connected; never exposes tokens). Realtime is on for `tasks`.
- `chat_messages` – per-user chat history with Muna.
- `ai_usage` – tokens used per user per month. RPCs: `get_ai_usage()`, `add_ai_usage()`.
- `private.allowed_emails` – **guest list**. Only `jaredartt@gmail.com` and `limisan98@gmail.com` can sign up (trigger `handle_new_user` rejects everyone else) and both automatically share one household. To add/change someone, edit this table with SQL.
- RPC `join_household(code)` is a fallback to join a partner's home by invite code.
- Security advisor note: `join_household`, `add_ai_usage`, `get_ai_usage`, `get_google_status`, `save_google_connection`, `disconnect_google` are SECURITY DEFINER functions callable by signed-in users on purpose; `google_connections` showing "RLS enabled, no policy" is also on purpose. Migrations 1-7 are in `supabase/migrations/` (3 = Google Calendar, 4 = profile colour + filled avatar icons, 5 = shared personality, 6 = repeating tasks, 7 = custom_icons).

## Muna (Gemini) – how it works
1. Chat page calls `supabase.functions.invoke('muna-chat', { message, timezone })` (JWT required).
2. The function checks the user, loads profile + personality + household tasks + last 12 messages, checks the monthly token budget, then loops with Gemini (max 5 tool rounds).
3. Tools (all run with the user's own JWT, so RLS applies): `create_tasks` (many at once), `update_task`, `set_tasks_completed`, `delete_tasks`, `list_tasks`, `list_calendar_events` (reads both people's Google Calendars via the `google-calendar` function).
4. After tools run, changed tasks are mirrored to Google Calendar server-side. It saves both chat messages, adds token usage, and returns `{ reply, transcript?, changed, usage }`. If `changed`, the app reloads tasks.
5. **To teach Muna a new ability** (e.g. recipes): create the table + RLS migration, add UI, then add an entry to the `TOOLS` array in the edge function (declaration + handler) and mention the capability in `buildSystemPrompt`. Redeploy with the Supabase connector (`verify_jwt: true`).
6. `TASK_ICONS` / `TASK_COLORS` exist in BOTH `src/lib/icons.tsx` and the edge function – keep them in sync.
7. Personality: ONE shared free text for the whole home (Jared's decision, 2 Oct 2026): stored in `households.muna_personality`, edited in Profile through RPC `set_household_personality(text)`, injected into the system prompt, and pushed live to the partner's phone via Supabase realtime on `households` (plus a refresh when the app regains focus). The old per-person column `profiles.muna_personality` is unused (migration 5 copied the existing text into the household).
8. Tokens: **counted, NOT limited** (Jared's decision, 2 Oct 2026: he is on the free Gemini tier, so a monthly cap is pointless). Profile shows tokens used this month, counted exactly from Gemini's `usageMetadata` (prompt + output + thinking tokens), stored per user per month in `ai_usage`. The edge function no longer blocks when a budget is reached; the column `profiles.monthly_token_budget` (still 1,000,000) and the `budget` field of `get_ai_usage()` are unused leftovers kept in case he moves to a paid plan (then re-add a check in `muna-chat`, and ask Jared for the number first). Google's free tier has no published monthly token cap: it limits requests/minute, tokens/minute and requests/day (daily quota resets at midnight Pacific; exact numbers are only shown in Jared's AI Studio dashboard). Paid price for gemini-3.1-flash-lite: $0.25 / 1M input tokens ($0.50 audio), $1.50 / 1M output (https://ai.google.dev/gemini-api/docs/pricing). Never invent or change token numbers without asking.
   When Google answers 429 with a per-DAY quota message (`edge function: isDailyQuota`), Muna replies as a normal chat bubble: "Uhm... I feel tired, can we continue tomorrow? :(" (`TIRED_REPLY`). Per-minute 429s still show "overwhelmed, try again in a minute". The daily detection looks for "PerDay/per day/daily" in Google's error body and has NOT been tested against a real daily-quota error yet.
9. **Voice = voice notes, not live speech recognition** (live recognition kept cutting off on iPhone). Tap the mic in Chat → `src/lib/recorder.ts` records, downsamples to 16 kHz mono WAV, base64 → edge function `muna-chat` sends it to Gemini only to transcribe (`inlineData` audio/wav), then runs the normal chat with that text. Audio is **never stored**; the transcript is saved as the chat message. Max ~60 s (client cap) / 4.5 MB base64 (server). Optional spoken replies use `speechSynthesis` (unlocked on a tap). Untested on a real iPhone as of writing: check mic permission and the home-screen app.

## Google Calendar (two-way, both people see each other's events)
- Connect button in Profile. `AuthContext.connectGoogle()` runs `signInWithOAuth` again with scope `https://www.googleapis.com/auth/calendar.events`, `access_type=offline`, `prompt=consent`; on return the app captures `session.provider_refresh_token` ONCE (sessionStorage flag `muna-connecting-google`) and saves it via RPC `save_google_connection`. Tokens live in `google_connections` and are only used by edge functions.
- Edge function `google-calendar` (`supabase/functions/google-calendar/index.ts`, `verify_jwt: true`): action `list` returns events of every connected household member's **primary** calendar (Muna-created events are filtered out to avoid duplicates; flags `reconnect` / `api_disabled`); action `sync` creates / patches / deletes Google events for tasks. Owner of the event = assignee, else creator, else the acting user. Muna events carry `extendedProperties.private.muna_task_id`; completed tasks get a "✓ " title prefix.
- Frontend: `src/lib/google.ts`, `src/hooks/useGoogleEvents.ts` (60 s cache, refetch on `TASKS_CHANGED`), `EventRow`, events shown in Calendar (blue ring dots) and Home's Today card. The task sheet has an "Add to Google Calendar" checkbox (`sync_google`).
- Limits: only the primary calendar; edits made inside Google to Muna-created events are **not** read back (Google → Muna is only the read-only list); refresh token is stored as plain text in a locked table; while the Google Cloud app is in "Testing" refresh tokens expire after 7 days, so the app must be **published to production** (unverified-app warning is normal: Advanced → Go to Muna).

## Repeating tasks
- ONE task row = the whole series. Rule shape (`Repeat` in `src/lib/recurrence.ts`): `freq` day/week/month/year, `every`, `weekdays` (0=Mon..6=Sun), `monthDays` (1..31, -1=last), `nth` ({n:1-4|-1, weekday}), `exceptWeekdays`, `exceptWeeks` (week of month 1-4, -1=last), `until` or `count`. "Twice a week" = two weekdays, "twice a month" = two dates. Times per DAY ("twice a day") is NOT supported.
- `due_date` of a repeating task = its first real occurrence (normalised on save, also by Muna). `useTasks` exposes `occurrencesOn(date)` / `occurrenceMap(from,to)` which expand repeats into `Occurrence` objects (`series` = the real task, `completed` = ticked that day). `toggleTask` on an occurrence writes `task_completions`; `openEditor(occurrence)` opens the whole series; Delete = "Delete all". Home's "All tasks" ring counts one-time tasks only.
- `recurrence.ts` exists in THREE identical copies: `src/lib/` and `supabase/functions/{google-calendar,muna-chat}/` (edge functions can't import from src). Change all three together; the server copies have trimmed comments.
- Google: `google-calendar` turns the rule into RRULE (+ EXDATE for skipped days, up to 2 years ahead, max 150) and converts "after N times" into an UNTIL date. Muna (`muna-chat`) has a `repeat` object in create_tasks/update_task and `set_tasks_completed(date)` for one day.

## Small UX details
- Chat opens at the newest message: history is cached in memory (`historyCache` in `Chat.tsx`) and scrolled with `useLayoutEffect` before paint; the message list is `visibility:hidden` until loaded. The chat header is `position: sticky`. Every other route scrolls to top (`App.tsx`).
- Update-log entries have an optional `time` (Berlin, HH:MM); entries from before Oct 2 09:00 have none because it was not recorded.
- Chat draft: the unsent message is kept in the browser's `localStorage` (`muna-chat-draft:<user id>`, `src/lib/draft.ts`) so it survives tab switches AND closing the app. It is per phone, not synced, and uses no Supabase storage. If sending fails, the text is put back in the box.
- Bottom nav: the active tab shows a white dot and its icon glides up 5px (and back down when you leave), animated in CSS in `src/styles.css` (`.nav-btn svg`, `.nav-dot`).

## Profile colour + icon
Each person picks a colour (`avatar_color`) and any Tabler **filled** icon (`avatar`) with a search bar (`src/components/IconPicker.tsx`; the full icon library is loaded lazily with `import('@tabler/icons-react')`). The same picker is used for task icons (Muna's own `icon` enum stays the 32 curated keys in `TASK_ICONS`). The partner's events in the calendar are tinted with their colour.

## Editing Google events + custom icons (Oct 2)
- **Google events are editable** (both people can edit each other's): `google-calendar` actions `update_event` / `delete_event` (merge with the existing event, so Muna can send only what changed). `EventSheet.tsx` is opened with `openEvent(ev)` from `TasksContext` (tap an event in Calendar or Home). A repeating event changes EVERY repeat by default (scope `all`: the series event is patched, title/times only, days follow the repeat rule); `scope: 'one'` changes/deletes only that day (the date can move). The sheet has an All repeats / Only this day switch; deleting asks which. Muna tools: `update_calendar_event`, `delete_calendar_event` (use the `ref` from `list_calendar_events`). Muna's own task events stay edited as tasks.
- **Icon keys:** curated (`pizza`), Tabler (`IconBeerFilled`), Phosphor Fill (`ph:pizza`, from `src/data/phosphor-fill.json`) and uploaded (`custom:<uuid>`). `AppIcon` renders all four; `IconPicker` searches custom + Phosphor + Tabler together.
- **Uploaded icons:** table `custom_icons` (migration 7, per household, RLS, realtime). `src/lib/svgIcons.tsx` cleans an SVG into a list of whitelisted shapes (no scripts, every colour becomes currentColor, max 30 KB); `src/lib/customIcons.ts` is the live store (cached in localStorage); `MyIcons.tsx` is the Profile card; `IconSync.tsx` starts the sync. Storage is Supabase (a few KB per icon).
- **Phosphor Fill:** MIT, github.com/phosphor-icons/core. This workspace and the Mac shell cannot reach npm, so the file is made once from the GitHub ZIP: download "Code > Download ZIP", put it in the Muna folder, run `python3 tools/import_phosphor.py core-main.zip` (writes `src/data/phosphor-fill.json`, ~1500 icons incl. food, searchable by tags). DONE Oct 2: 1,512 icons imported (661 KB JSON, loaded lazily; only ~40 are food: there is no tomato, banana, milk etc., so Jared uploads those himself). The picker ranks uploads + Phosphor + Tabler in ONE list (`IconPicker.tsx`). The app also works if the file is missing. `*.zip` is git-ignored.
- **Project map:** `PROJECT_MAP.md` (made by `python3 tools/make_map.py`) lists every file, exports, imports, tables and server functions. Read it first instead of opening many files; regenerate after structural changes. (This replaces trying Graphify, which Claude cannot install here.)

## Task sheet notes
Google sync is always on for dated tasks (`sync_google` forced true; no checkbox). Date/Who and Starts/Ends use `minmax(0,1fr)` grid columns so iOS date inputs can't overflow; the sheet and page block sideways scrolling (`overflow-x: hidden`, `touch-action: pan-y`). Checkboxes are custom (rounded coral box, animated tick) in `styles.css`.

## Screens (done)
Login (Google) · Home (dashboard like Figma) · Calendar (month grid, dots per day, Google events, day list, add task) · Chat with Muna (text + voice notes) · Profile (name, colour, filled icon with search, light/dark/system, Muna personality, tokens used, Google Calendar connect, invite code, sign out). Task editor sheet (title, date, time, who, repeat, notes, colour, icon).

## Known limits / not done yet
- Google Calendar: see limits above. Sleep / Calories / Uni dashboard cards are still not built.
- The first build could not be test-compiled by Claude (npm was blocked in its workspace). **If the first GitHub Action fails, read the error in the Actions tab and fix it.** After the first successful local `npm install`, commit `package-lock.json` and switch the workflow from `npm install` to `npm ci`.
- No push notifications yet. Recipes, budget, etc. are future modules.
- Muna's mascot artwork is an approximation of Figma's.

## One-time setup checklist (status)
- [x] Supabase project created, schema + RLS + guest list applied
- [x] Edge function `muna-chat` deployed
- [x] Frontend code written
- [x] Jared added `GEMINI_API_KEY`; Google login works; Pages deploy set up (verify with Jared if unsure)
- [x] Edge functions deployed: `muna-chat` (v4, with voice transcription), `google-calendar` (v1)
- [ ] Google Cloud: enable **Google Calendar API**; add scope `.../auth/calendar.events` (Data Access); **Publish app** (Audience → Publish) so refresh tokens do not expire
- [ ] Supabase → Edge Functions → Secrets: add `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`
- [ ] `git add . && git commit && git push origin main`; green run in the Actions tab
- [ ] Each person: Profile → Connect Google Calendar
- [ ] Test a voice note on the iPhone (mic permission)

## Working agreements
- Keep answers simple and step-by-step for Jared; he does not code.
- Don't ask him for secrets in chat (no API keys, no tokens). Gemini key → Supabase secrets dashboard only.
- Update this file after every change. Read `PROJECT_MAP.md` first and rerun `python3 tools/make_map.py` after adding/removing files.
- Delivering files to the Mac folder: after copying files into the staging folder, wait a few seconds before `device_commit_files`, then verify with `md5sum` on the Mac (`device_bash`) that they match. Twice a commit reported "written" but the Mac kept the OLD file, which broke the GitHub build (run #4/#5: missing export). Always run a build-style check (all local imports resolve) before telling Jared to push.
- **Update log:** for EVERY change we make, add one entry at the top of `src/lib/updates.tsx` (date, short title, one or two simple sentences, a Tabler filled icon, a pastel colour). Jared reads it in Profile → Update log (`src/pages/Updates.tsx`, route `/updates`). Keep it very short and in simple words.
- Icon picker: the search covers ALL Tabler icons, filled and outline mixed together (Tabler has no filled cat/dog; Lidia asked for a cat). The suggestion grid before searching is filled-only. Own SVG icons are built (Profile > My icons, Supabase).

### Personality blank bug - real cause (Oct 2)
In `Profile.tsx` the sync effect read `lastSaved.current` INSIDE the `setPersonality(fn)` updater; React runs that later, after `lastSaved.current` was already overwritten, so the textarea stayed empty (only sometimes, which is why it came back). Fix: copy the old value into a local `before` first. The DB text was never lost. Also: Gemini 503 retry (`geminiFetch`, muna-chat v15).

### Google events = same features as tasks (Oct 2, rule from Jared: always keep them equal)
- Tables `event_styles(household_id, event_key, icon, color)` and `event_done(household_id, event_key, day)` (migrations 8 and 9, RLS by household, realtime). `event_key` = `<owner id>:<Google event id>`; for repeating events the `_<date>` ending is cut off so all repeats share one look (`eventStyleKey` in `src/lib/eventStyles.ts`).
- `EventRow`: tap icon to edit, tick to mark done (per day). `EventSheet`: colour, icon (same unified IconPicker), notes (= Google description, sent only when changed), reset-to-default button. `IconSync` starts the live sync.
- google-calendar v9: `list` returns `notes`, `update_event` accepts `notes`.
- RULE: whenever Muna tasks get a new feature, Google events should get it too.
- Not yet: Muna (the chat) cannot change an event's icon/colour/tick.

### Scroll leaking out of sheets (Oct 2)
Sheets (`.sheet`) and the icon grid had no `overscroll-behavior`, so at the end of their scroll the page behind scrolled (iOS). Fix in `styles.css`: `overscroll-behavior: contain` on `.sheet` and `.icon-grid`, and `html/body:has(.sheet-backdrop){overflow:hidden}`. Untested on a real iPhone.

### Home intro + no height jumps (Oct 2)
`Home.tsx`: the hero and 4 cards stay invisible (`.reveal.pre`) until tasks, the Google status (`googleReady` in AuthContext) and today's Google events (`loaded` in `useGoogleEvents`) have arrived, or 2.5 s passed; then `.reveal.in` fades them in with 130 ms steps (hero, Today's tasks, This week, Today, All tasks). Plays once per app start (module flag `introPlayed`), not on every tab change. Reduced-motion users get no animation. Home's event rows now use the event's icon, colour and tick.

### New calendar: day / week / month (Oct 2)
- `CalendarPage.tsx` has 3 views, switched by the Day/Week/Month control in the header (default Day). It builds `DayItem`s (`src/lib/dayItems.ts`) from tasks (incl. repeat days) and Google events; the views know nothing else.
- `DayView.tsx`: hour grid (56 px/hour, 15-min snap), sticky all-day strip (items without a time), press-and-hold (touch, 320 ms) or drag (mouse) to move, drop on an hour = gets a time (1 h long, or keeps its length), drop on the strip = all-day. Page auto-scrolls near the screen edges; `touchmove` is blocked only while dragging. Overlapping blocks sit side by side (`layoutLanes`). A repeating task keeps ONE time for all repeats (moving changes the series). A Google event moved by hand changes only that day (scope 'one'); multi-day events can be opened but not dragged.
- `WeekView.tsx`: 7 columns, tap a day or block (no dragging yet). Month: tap a day to open it in the Day view.
- Look is a first cosy version; Jared will hand over the Figma design later and Claude must then replicate it exactly (keep logic and styling separate, styles are in the last section of styles.css).
- Untested on a real iPhone: the long-press drag, auto-scroll and the sticky strip.

### Faster start (Oct 2)
Home intro started late because it waited for 3 network answers (tasks, who connected Google, today's Google events). Now each is remembered on the phone and shown at once, then refreshed: `useTasks` (localStorage `muna.tasksCache.v1`, keyed by household), `useGoogleEvents` (`muna.googleEvents.v1`, shown as stale, refetched when older than 60 s), AuthContext (`muna.googleStatus.v1`). `loadProfile` no longer waits for members/household before the app shows. Fallback timeout for the intro is 1.2 s, steps 110 ms. First-ever open (no cache) still waits for the network.

### Calendar hours 06:00-00:00 (Oct 2)
`DAY_START = 360`, `DAY_END = 1440` in `src/lib/dayItems.ts` (change there to show other hours). Day and week grids show 18 hours; items before 06:00 are drawn at the top edge, dragging cannot drop before 06:00.

### Visual project graph (Oct 2)
`python3 tools/make_graph.py` builds `PROJECT_GRAPH.html` (open in a browser): every file, imports, database tables, database functions and the 2 server functions, with search, drag, zoom, tap-to-see details. Template: `tools/graph_template.html`. Regenerate after big changes (with `tools/make_map.py` for the text map).

### Bug: 'ghost' class clash (Oct 2)
The DayView drag pill used the CSS class `.ghost`, which `.btn.ghost` (Sign out, Disconnect) already uses, so those buttons became `position: fixed` at the top of the screen. Renamed the pill to `.drag-ghost`. Found by running JS in the in-app browser on the live Profile page (listing elements with a shadow near the top). RULE: before adding a generic CSS class name, grep styles.css for it.
Same clash with `.chip` (Chat suggestion buttons vs the calendar's all-day pills): calendar pills are now `.ad-pill` (not `.day-chip`, which the repeat editor uses). A script check found no other class defined both before and after the calendar section of styles.css.

The first (06:00) and last (00:00) hour labels are hidden in day and week views because they were half covered (the lines stay).

A small gap (`TOP_PAD` = 16 px in `src/lib/dayItems.ts`, `WPAD` = 12 px in WeekView) sits above the first hour line, mirroring the gap below the last one. In DayView it offsets the hour lines, the `.slots` layer, the now-line and the drag maths (`compute` subtracts it).

Drag auto-scroll up: zone is the 130 px under the sticky all-day strip (was 50 px, too small to hit because the drag pill floats above the finger); speed grows nearer the strip. Down zone is the last 150 px of the screen.

The 06:00 and 00:00 labels are visible again (now that TOP_PAD / WPAD keep them clear of the edges). This replaces the earlier 'hidden first/last labels' note.

### Bug: app could not scroll on iPhone (Oct 2)
Cause (most likely, not reproducible on desktop): `html:has(.sheet-backdrop), body:has(.sheet-backdrop) { overflow: hidden }` in styles.css. iOS Safari can stay stuck after overflow:hidden on html/body is toggled. Replaced by `src/hooks/useSheetScrollGuard.ts` (touchmove guard on the sheet backdrop, used by TaskSheet and EventSheet). RULE: never lock scrolling by setting overflow on html/body.

### Bug: no wheel/trackpad scrolling (Oct 2) - REAL cause
`body { overscroll-behavior-y: none }` combined with `html, body { overflow-x: hidden }`: body became a scroll container with overscroll-behavior none, so wheel/touch scrolling never chained up to the page (keyboard still worked). Found by testing in the in-app browser: injecting `body{overscroll-behavior-y:auto}` made wheel scrolling work. Fix: moved `overscroll-behavior-y: none` to `html`. RULE: never put overscroll-behavior on body.

### Products + barcode scanner (Oct 2)
- Table `products` (migration `20261002000010_products.sql`, applied through the connector): per household, barcode (unique per household), name, brand, pack_size, unit g/ml, kcal/protein/carbs/sugar/fat/sat fat/fibre/salt per 100, gluten + lactose (free / contains / unknown), image_url, source (openfoodfacts / manual), notes. RLS like the other tables, realtime on.
- `src/lib/products.ts`: live store (`useProducts`, `startProductSync` started in IconSync), `lookupBarcode` (Open Food Facts API v2, CORS works from the browser, nothing saved until the person checks it), `saveProduct`, `deleteProduct`.
- `src/components/BarcodeScanner.tsx`: uses the browser's BarcodeDetector when present (Chrome, Android). iPhone Safari has none, so it loads ZXing once from jsDelivr (`@zxing/library@0.21.3`, no npm dependency added). If the camera fails the person can type the barcode.
- `src/pages/Products.tsx` (route `/products`, link card on Profile) and `src/components/ProductSheet.tsx` (check and edit).
- Gluten/lactose come from Open Food Facts tags (allergens and labels). 'unknown' is common: always check the pack.
- NOT verified on a real iPhone: camera permission inside the installed PWA and ZXing decoding. Next: pantry (stock per product), food log, restock prediction (see the nutrition document).
