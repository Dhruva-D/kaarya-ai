# Kaarya AI

Kaarya AI is a voice-first, human-approved productivity assistant. This repository is under active Phase 1 development. No external provider integration is claimed to work until a real account smoke test has produced a receipt.

## Current status

- Next.js, TypeScript, Tailwind CSS and shadcn/ui foundation: scaffolded and checked locally.
- Gnani Prisma v2.5 browser recorder, WAV encoder, authenticated transcription route and editable transcript: implemented with contract tests; real account response and browser microphone check not yet verified.
- Gemini Calendar proposal adapter: implemented with strict Zod contract tests; real account response not yet verified.
- Drizzle/Postgres schema and checked-in migrations: generated and checked locally; no database connection verified.
- Auth.js Google sign-in and encrypted token vault: implemented with local tests; live OAuth not yet verified.
- Authenticated typed chat route and owned Calendar plan persistence: implemented; live database/Gemini flow not yet verified.
- Per-user database request budgets for chat and transcription: implemented with a generated migration; live concurrent behavior not yet checked against Postgres.
- Approved Calendar execution route and encrypted credential loading: implemented with local contract/security tests; no live Google receipt yet.
- Typed chat and exact Calendar review UI: built; authenticated browser review is pending live OAuth/database setup.
- Tasks, Gmail and voice output: planned after the first verified Calendar journey.

## Local setup

Use Node.js 22 and npm. In this folder, copy `.env.example` to `.env.local` and fill it locally. Obtain `GNANI_API_KEY` from the Gnani API console, `GEMINI_API_KEY` from Google AI Studio, and `DATABASE_URL` from a new Supabase Postgres project's Connect panel. For Google sign-in, create a Google Cloud OAuth Web client, enable Calendar API, add your test account to the OAuth consent screen, and put its client ID/secret in `AUTH_GOOGLE_ID`/`AUTH_GOOGLE_SECRET`. Then run:

```powershell
npm install
npm run dev
```

Checks: `npm run lint`, `npm run typecheck`, `npm run test`, and `npm run build`.

After adding a Supabase Postgres `DATABASE_URL`, run `npm run db:migrate`. Schema changes use `npm run db:generate` and checked-in SQL migrations; do not use destructive database push against shared data.

`TOKEN_ENCRYPTION_KEY` must be a base64 encoding of 32 random bytes. In PowerShell, run `[Convert]::ToBase64String([Security.Cryptography.RandomNumberGenerator]::GetBytes(32))` twice and use different outputs for `TOKEN_ENCRYPTION_KEY` and `AUTH_SECRET` in `.env.local`. Register the Google OAuth callback `http://localhost:3000/api/auth/callback/google`.

To test Gnani after adding a key, record a **synthetic**, spoken mono 16-bit PCM WAV clip (8–44.1 kHz, 0.1–30 seconds) and run `npm run smoke:gnani -- <path-to-clip.wav> hi-IN`. The script prints the actual response; do not use private speech or paste the transcript into public logs. Browser recording must also be checked with microphone permission after sign-in.

To check model access with a synthetic Calendar request, run `npm run smoke:gemini` after adding `GEMINI_API_KEY`. This prints a proposal, not a Google write.

Never commit `.env.local`, provider keys, OAuth tokens, private messages or real recordings.
