# Kaarya AI

Kaarya AI is a voice-first, human-approved productivity assistant. Phase 1 turns short voice or typed requests into reviewed Google Calendar, Google Tasks, or Gmail actions. External writes require exact approval.

## Current status

- Next.js, TypeScript, Tailwind CSS and shadcn/ui foundation: scaffolded and checked locally.
- Gnani Prisma v3.0 browser recorder, WAV encoder, authenticated transcription route and editable transcript: `indic-auto` detects one of ten supported languages. A synthetic clip returned a real v3.0 transcript and detected language. Browser microphone capture was verified earlier with v2.5; the v3.0 browser path still needs a user microphone check. Typed fallback remains available.
- Gemini structured proposal adapter: strict Zod contract tests and real `gemini-3.6-flash` proposals verified. `gemini-3.5-flash-lite` is now the local default because direct synthetic requests were faster and the 3.6 free-tier quota was exhausted. A configured 3.6 model falls back to Lite on 429/503. Provider latency remains variable; one signed-in request failed after 28 seconds and its retry took 12.4 seconds for chat, plus 1.9 seconds for TTS.
- Drizzle/Postgres schema and checked-in migrations: applied to a Supabase test database.
- Auth.js Google sign-in and encrypted token vault: live sign-in verified; account token columns were empty and connection tokens encrypted at rest.
- Authenticated typed chat route and owned Calendar plan persistence: live typed request and review verified. Recent completed actions remain visible when a newer plan is pending in the same conversation.
- Calendar title and duration gate: a plan cannot proceed when its title is unsupported by the user's words or no duration was stated. A signed-in two-turn synthetic request asked for duration, then produced a 30-minute preview after the answer; no event was created in that test.
- Calendar guest and Meet support: bounded guest emails and a Meet request are part of the validated proposal and exact approval hash. The review shows whether invitations will be sent and whether a Meet link is requested. Google adapter tests verify `sendUpdates=all` and `conferenceDataVersion=1`; a real guest invitation or Meet generation has not been authorized or tested yet.
- Guest and Meet choices must be explicit before a new proposal can reach approval. In a signed-in synthetic dialogue, Kaarya asked both questions and showed a guest-free/no-Meet review only after the user answered. The server checks that proposed choices match the user's words.
- Per-user database request budgets for chat, transcription and synthesis: implemented with a generated migration; live concurrent behavior not yet checked against Postgres.
- Approved Calendar execution route and encrypted credential loading: one user-approved, guest-free synthetic event was created on the connected test account, with a stored Google event ID and the event observed in Google Calendar. Duplicate and foreign-user claims of the same completed plan were rejected in a live database check. Expired previews close in the UI; the server also rejects stale approvals.
- Typed chat and exact Calendar review UI: signed-in desktop and narrow mobile layout inspected; the mobile view showed no horizontal overflow.
- Gnani Timbre v2.5 voice output: an authenticated, bounded WAV route automatically speaks each new assistant reply while showing text. If the browser blocks autoplay, it offers an "Enable sound" control. Synthetic English and Kannada provider requests returned real WAV; signed-in browser UI showed automatic "Speaking…" and no app error. Sound was not independently audible to the agent. Detected speech language is saved and selects a documented voice. Kannada end-to-end browser playback remains open.
- Google Tasks: typed or transcribed requests produce a persisted, exact approval preview. The server validates title and date-only behavior, and targets the authenticated account's default task list. After the user granted the Tasks scope and approved one exact synthetic preview, Kaarya stored a real Google task ID; the task was observed in Google Tasks My Tasks due the next day. The plan/action were succeeded in the database, so no duplicate pending approval remained.
- Gmail send: strict proposal, exact in-app recipient/subject/body review, owned approval path, MIME adapter and receipt handling are implemented. A signed-in synthetic request reached the review and automatic voice reply; **Approve and send was not clicked**. The app requests only `gmail.send` on Google sign-in; Gmail API is Enabled and that scope was saved in Google Auth Platform. User re-consent, real send and provider receipt remain pending.

This is a locally verified Phase 1 slice, not a deployed service. Full cross-user HTTP testing with a second account and deployment remain open.

## Local setup

Use Node.js 22 and npm. In this folder, copy `.env.example` to `.env.local` and fill it locally. Obtain `GNANI_API_KEY` from the Gnani API console, `GEMINI_API_KEY` from Google AI Studio, and `DATABASE_URL` from a Supabase Postgres project's Connect panel. For Google sign-in, create a Google Cloud OAuth Web client, enable Google Calendar, Tasks and Gmail APIs, then add `https://www.googleapis.com/auth/calendar.events`, `https://www.googleapis.com/auth/tasks` and `https://www.googleapis.com/auth/gmail.send` in Google Auth Platform → Data access. Add your test account under Audience and put the client ID/secret in `AUTH_GOOGLE_ID`/`AUTH_GOOGLE_SECRET`. Users must re-consent after a scope is added. Then run:

```powershell
npm install
npm run db:migrate
npm run dev
```

Checks: `npm run lint`, `npm run typecheck`, `npm run test`, `npm run test:e2e`, and `npm run build`. For the browser smoke suite, install Playwright's Chromium once with `npx playwright install chromium`. The current E2E suite uses a fresh anonymous browser context and a configured local app; it does not automate Google consent or create an event.

After adding a Supabase Postgres `DATABASE_URL`, run `npm run db:migrate`. Schema changes use `npm run db:generate` and checked-in SQL migrations; do not use destructive database push against shared data.

`TOKEN_ENCRYPTION_KEY` must be a base64 encoding of 32 random bytes. In PowerShell, run `[Convert]::ToBase64String([Security.Cryptography.RandomNumberGenerator]::GetBytes(32))` twice and use different outputs for `TOKEN_ENCRYPTION_KEY` and `AUTH_SECRET` in `.env.local`. Register the Google OAuth callback `http://localhost:3000/api/auth/callback/google`.

To test Gnani after adding a key, record a **synthetic**, spoken mono 16-bit PCM WAV clip (8–44.1 kHz, 0.1–30 seconds) and run `npm run smoke:gnani -- <path-to-clip.wav>`. The script prints the actual v3.0 response and detected language; do not use private speech or paste the transcript into public logs. Browser recording must also be checked with microphone permission after sign-in.

To check model access with a synthetic Calendar request, run `npm run smoke:gemini` after adding `GEMINI_API_KEY`. This prints a proposal, not a Google write.

If chat reports `GEMINI_RATE_LIMITED`, both the primary and fallback model are unavailable under the connected project's current limits. The unsent message remains editable in the composer. Check the project's **Usage** and **Rate Limit** pages in Google AI Studio, then retry when capacity is available. This error does not create a Calendar event; do not repeatedly run smoke tests while the limit is active.

Never commit `.env.local`, provider keys, OAuth tokens, private messages or real recordings.

For hosting, see [DEPLOYMENT.md](DEPLOYMENT.md). The public URL must be verified with its own HTTPS Google OAuth callback before sharing it as a working demo.
