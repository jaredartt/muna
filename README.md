# Muna

Our little everything app (calendar + tasks + Google Calendar sync + Muna, the Gemini-powered assistant with voice notes). React + Vite + Supabase, hosted on GitHub Pages.

- Live app: https://jaredartt.github.io/Muna/
- Supabase project: `muna` (`vlatdcjwxbflicomkbnr`, eu-central-1)
- For everything a new developer (or a new Claude chat) needs, read **project_status.md**.

## Run it on your Mac (optional)

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # same build GitHub runs
npm run typecheck  # TypeScript check
```

## Deploy

`git push origin main` – GitHub Actions builds the app and publishes it to GitHub Pages.
