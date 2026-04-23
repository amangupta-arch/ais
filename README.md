# AIS

A daily AI tutor in your pocket. Ten minutes. Real skill.

Next.js 15 · React 19 · TypeScript · Tailwind · Supabase · Anthropic Claude.

## Running locally

```bash
npm install
npm run dev        # http://localhost:3000
```

## Environment variables

Copy `.env.example` to `.env.local` and fill in:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://dfdocnhhxrnvblbwwium.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_...
SUPABASE_SERVICE_ROLE_KEY=eyJ...                 # server-only — from Supabase Settings → API
ANTHROPIC_API_KEY=sk-ant-...                     # server-only — required for ai_conversation turns
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_APP_NAME=AIS
```

### Where to put the Anthropic API key

The key is needed by the `ai_conversation` turn inside lessons. Without it, the sub-chat falls back to an "offline" message and the lesson still plays — but the real conversation only works with the key.

1. Get a key at **[console.anthropic.com/settings/keys](https://console.anthropic.com/settings/keys)** — create a new key, copy the `sk-ant-…` string (it's only shown once).
2. **Local dev:** paste it into `.env.local` as `ANTHROPIC_API_KEY=sk-ant-...`. Restart `npm run dev`.
3. **Production (Vercel):** go to **[vercel.com/amans-projects-7791d081/ais/settings/environment-variables](https://vercel.com/amans-projects-7791d081/ais/settings/environment-variables)** → *Add New* →
   - Key: `ANTHROPIC_API_KEY`
   - Value: your `sk-ant-…`
   - Environments: check **Production**, **Preview**, **Development**
   - Save, then go to *Deployments* → click the three-dot menu on the latest deploy → *Redeploy* (new env vars only reach already-deployed lambdas on a redeploy).

The key is only ever read inside `app/api/ai/conversation/route.ts` on the server. It never reaches the browser bundle.

## Content authoring

Lessons are authored as YAML files under `supabase/content/<course-slug>/NN-<lesson-slug>.yaml`. See `supabase/content/AUTHORING.md` for the full spec.

Run the loader to push YAML changes to Supabase:

```bash
npm run content:load -- --dry-run    # validate, print the plan
npm run content:load                  # actually upsert
```

## Scripts

- `npm run dev` — dev server
- `npm run build` — production build
- `npm run typecheck` — `tsc --noEmit`
- `npm run lint` — next lint
- `npm run content:load` — push YAML lesson content to Supabase

## Deploying

Vercel project `ais` is linked to this repo. Merges to `main` trigger a production deploy automatically.
