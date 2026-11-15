# Kaarya AI

Kaarya AI is a voice-first, human-approved productivity assistant. Phase 1 turns short voice or typed requests into reviewed Google Calendar, Google Tasks, or Gmail actions. External writes require exact approval.

## Current status

- Next.js, TypeScript, Tailwind CSS and shadcn/ui foundation: scaffolded and checked locally.
- Refreshed landing and sign-in pages, shared light/dark colors, custom Kaarya mark, account menu, authenticated profile/settings page, and compact microphone composer. Desktop/mobile landing and sign-in were visually inspected; signed-in workspace review remains for the user.
- Gnani Prisma v3.0 browser recorder, WAV encoder, authenticated transcription route and editable transcript: `indic-auto` detects one of ten supported languages. A synthetic clip returned a real v3.0 transcript and detected language; the user also reported an editable Kannada browser transcript. Typed fallback remains available.
- Reasoning: local Codex CLI uses `gpt-5.6-luna` with medium effort and requests the Fast service tier. A direct synthetic CLI call and a Zod-valid structured task proposal through Kaarya's adapter succeeded. Chat uses Codex only; there is no Gemini fallback. Provider speed varies, and the Fast tier was requested rather than independently measured.
- Drizzle/Postgres schema and checked-in migrations: applied to a Supabase test database.
- Auth.js Google sign-in and encrypted token vault: live sign-in verified; account token columns were empty and connection tokens encrypted at rest.
- Authenticated typed chat route and owned Calendar plan persistence: live typed request and review verified. Recent completed actions remain visible when a newer plan is pending in the same conversation.
- Calendar title and duration gate: a plan cannot proceed when its title is unsupported by the user's words or no duration was stated. A signed-in two-turn synthetic request asked for duration, then produced a 30-minute preview after the answer; no event was created in that test.
- Calendar guest and Meet support: bounded guest emails and a Meet request are part of the validated proposal and exact approval hash. The review shows whether invitations will be sent and whether a Meet link is requested. One separately approved synthetic event with one test guest was created using `sendUpdates=all`; Google Calendar showed the event, one guest and a Meet link. Kaarya stored a Google event ID and confirmed Meet link. The user confirmed delivery to their second test inbox.
- Guest and Meet choices must be explicit before a new proposal can reach approval. In a signed-in synthetic dialogue, Kaarya asked both questions and showed a guest-free/no-Meet review only after the user answered. The server checks that proposed choices match the user's words.
- Per-user database request budgets for chat, transcription and synthesis: implemented with a generated migration; live concurrent behavior not yet checked against Postgres.
- Approved Calendar execution route and encrypted credential loading: one user-approved, guest-free synthetic event was created on the connected test account, with a stored Google event ID and the event observed in Google Calendar. Duplicate and foreign-user claims of the same completed plan were rejected in a live database check. Expired previews close in the UI; the server also rejects stale approvals.
- Typed chat and exact Calendar review UI: signed-in desktop and narrow mobile layout inspected; the mobile view showed no horizontal overflow.
- Gnani Timbre v2.5 voice output: an authenticated, bounded WAV route automatically speaks each new assistant reply while showing text. If the browser blocks autoplay, it offers an "Enable sound" control. Synthetic English and Kannada provider requests returned real WAV; signed-in browser UI showed automatic "Speaking…" and no app error. Sound was not independently audible to the agent. Detected speech language is saved and selects a documented voice. Kannada end-to-end browser playback remains open.
- Google Tasks: typed or transcribed requests produce a persisted, exact approval preview. The server validates title and date-only behavior, and targets the authenticated account's default task list. After the user granted the Tasks scope and approved one exact synthetic preview, Kaarya stored a real Google task ID; the task was observed in Google Tasks My Tasks due the next day. The plan/action were succeeded in the database, so no duplicate pending approval remained.
- Gmail send: strict proposal, exact in-app recipient/subject/body review, owned approval path, MIME adapter and receipt handling are implemented. Gmail API and the send-only OAuth scope are enabled; re-consent was verified. The user approved one synthetic email to a test account they control. Kaarya stored a real Gmail message ID and succeeded plan/action; the user confirmed receipt in the second inbox. Delivery to arbitrary recipients and negative provider outcomes remain untested live.
- Two-action plans: Gemini can propose up to two supported actions in order. Kaarya shows both exact actions on one review, binds them to one approval hash, claims them once, and stores separate receipts so a partial failure stays visible. A synthetic Calendar plus Task proposal and signed-in review were verified. The user chose to leave that preview unapproved, so live batch execution has not been tested. A test covers a provider rejection after the first action succeeds.

This is a locally verified Phase 1 slice, not a deployed service. Full cross-user HTTP testing with a second account and deployment remain open.

## Try it locally

For hands-free conversation, use the blue waveform button beside Send, and it starts listening immediately. Pause after each sentence: Kaarya transcribes it, sends it to Codex automatically, streams a spoken reply, then listens again. The voice session uses Kannada, English and Hindi recognition hints, with no language selector or transcript list in the panel. Pause, close, or switch tabs to stop the microphone. When a plan is ready, voice pauses so you can inspect and approve the exact action. Conversation mode uses Timbre v3.0 Shivani streaming audio; regular chat retains v2.5 speech. STT still uploads each completed utterance over REST, and Codex CLI starts per turn: this is automatic turn-taking, not a fully streaming duplex transport or a verified 1–2 second response.

1. Run `npm run dev` in this folder and open `http://localhost:3000/app`. Sign in with the Google test account if prompted. After a long break, re-consent may be required. Old action previews expire; start a new conversation.
2. Type a **synthetic** Calendar request with a future date, title, start and end time. Answer Kaarya's guest and Meet questions, inspect the exact preview, then use **Cancel** or approve only an event you actually want on your calendar.
3. Record a short synthetic English or Kannada request. Confirm the transcript is editable before pressing Send. Check that the text reply appears and that Gnani Timbre speaks it automatically; the browser may require one **Enable sound** tap.
4. Try a date-only Task and a Gmail draft to an account you control. Inspect the task date and the Gmail **From**, **To**, subject and full body. Approve only if you intend the real Google write.
5. Try one request for a Calendar event **and** a Task. Review both cards. The two-action execution code has automated tests, but a live batch write has not been verified because the user declined that test.

The app uses real provider calls. Codex model access, Gnani credits, Google consent and network speed can affect a test. A complete spoken turn in 1–2 seconds has not been verified. The repo has no hosted deployment.

## Local setup

The Codex CLI is a local development option. Install and sign in to `codex`, then check `codex --version`. It receives only the bounded conversation context, runs in a temporary read-only working directory, and inherits no Kaarya provider secrets. Set `CODEX_CLI_ENABLED=false` to skip it. Production disables the CLI unless a trusted private host explicitly sets `CODEX_CLI_ENABLED=true`; this is not a general hosted web backend. ChatGPT subscription model access and Fast tier availability must be verified separately. Every Codex proposal still passes strict server validation and the exact approval gate.

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
