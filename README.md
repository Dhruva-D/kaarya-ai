# Kaarya AI

Kaarya AI is a voice-first, human-approved productivity assistant. Phase 1 takes a short voice or typed request, proposes a Google Calendar event, and creates it only after the user reviews and approves the exact details.

## Current status

- Next.js, TypeScript, Tailwind CSS and shadcn/ui foundation: scaffolded and checked locally.
- Gnani Prisma v2.5 browser recorder, WAV encoder, authenticated transcription route and editable transcript: a short synthetic WAV produced a real provider transcript, and a browser microphone recording returned HTTP 200 with editable transcript text. Typed fallback remains available.
- Gemini Calendar proposal adapter: strict Zod contract tests and real `gemini-3.6-flash` structured proposals verified. When that model reaches its project quota, a real `gemini-3.5-flash-lite` structured proposal is used as the bounded fallback; this was verified in the signed-in UI.
- Drizzle/Postgres schema and checked-in migrations: applied to a Supabase test database.
- Auth.js Google sign-in and encrypted token vault: live sign-in verified; account token columns were empty and connection tokens encrypted at rest.
- Authenticated typed chat route and owned Calendar plan persistence: live typed request and review verified. Recent completed actions remain visible when a newer plan is pending in the same conversation.
- Per-user database request budgets for chat and transcription: implemented with a generated migration; live concurrent behavior not yet checked against Postgres.
- Approved Calendar execution route and encrypted credential loading: one user-approved, guest-free synthetic event was created on the connected test account, with a stored Google event ID and the event observed in Google Calendar. Duplicate and foreign-user claims of the same completed plan were rejected in a live database check. Expired previews close in the UI; the server also rejects stale approvals.
- Typed chat and exact Calendar review UI: signed-in desktop and narrow mobile layout inspected; the mobile view showed no horizontal overflow.
- Tasks, Gmail and voice output: planned after the first verified Calendar journey.

This is a locally verified Phase 1 slice, not a deployed service. Full cross-user HTTP testing with a second account and deployment remain open.

## Local setup

Use Node.js 22 and npm. In this folder, copy `.env.example` to `.env.local` and fill it locally. Obtain `GNANI_API_KEY` from the Gnani API console, `GEMINI_API_KEY` from Google AI Studio, and `DATABASE_URL` from a Supabase Postgres project's Connect panel. For Google sign-in, create a Google Cloud OAuth Web client, enable the Google Calendar API, add `https://www.googleapis.com/auth/calendar.events` in Google Auth Platform → Data access, add your test account under Audience, and put the client ID/secret in `AUTH_GOOGLE_ID`/`AUTH_GOOGLE_SECRET`. Then run:

```powershell
npm install
npm run db:migrate
npm run dev
```

Checks: `npm run lint`, `npm run typecheck`, `npm run test`, `npm run test:e2e`, and `npm run build`. For the browser smoke suite, install Playwright's Chromium once with `npx playwright install chromium`. The current E2E suite uses a fresh anonymous browser context and a configured local app; it does not automate Google consent or create an event.

After adding a Supabase Postgres `DATABASE_URL`, run `npm run db:migrate`. Schema changes use `npm run db:generate` and checked-in SQL migrations; do not use destructive database push against shared data.

`TOKEN_ENCRYPTION_KEY` must be a base64 encoding of 32 random bytes. In PowerShell, run `[Convert]::ToBase64String([Security.Cryptography.RandomNumberGenerator]::GetBytes(32))` twice and use different outputs for `TOKEN_ENCRYPTION_KEY` and `AUTH_SECRET` in `.env.local`. Register the Google OAuth callback `http://localhost:3000/api/auth/callback/google`.

To test Gnani after adding a key, record a **synthetic**, spoken mono 16-bit PCM WAV clip (8–44.1 kHz, 0.1–30 seconds) and run `npm run smoke:gnani -- <path-to-clip.wav> hi-IN`. The script prints the actual response; do not use private speech or paste the transcript into public logs. Browser recording must also be checked with microphone permission after sign-in.

To check model access with a synthetic Calendar request, run `npm run smoke:gemini` after adding `GEMINI_API_KEY`. This prints a proposal, not a Google write.

If chat reports `GEMINI_RATE_LIMITED`, both the primary and fallback model are unavailable under the connected project's current limits. The unsent message remains editable in the composer. Check the project's **Usage** and **Rate Limit** pages in Google AI Studio, then retry when capacity is available. This error does not create a Calendar event; do not repeatedly run smoke tests while the limit is active.

Never commit `.env.local`, provider keys, OAuth tokens, private messages or real recordings.

For hosting, see [DEPLOYMENT.md](DEPLOYMENT.md). The public URL must be verified with its own HTTPS Google OAuth callback before sharing it as a working demo.
