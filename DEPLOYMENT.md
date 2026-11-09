# Deploy Kaarya AI

This app needs hosted API credentials and a PostgreSQL database. The repository contains no live credentials or database records.

## Before importing into Vercel

1. Run the checked-in migrations against the intended Supabase database with `npm run db:migrate` from a trusted local machine. Do not run an unchecked schema push against shared data.
2. Import this repository as a Next.js project. The repository root is the app root; use the default build command `npm run build`.
3. In the Vercel project environment settings, enter these **server-only** values for Production before deploying: `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `DATABASE_URL`, `TOKEN_ENCRYPTION_KEY`, `GNANI_API_KEY`, and `GEMINI_API_KEY`. Optional overrides are `GEMINI_MODEL` and `GNANI_STT_URL`. Use the same encryption key as the database's existing encrypted Google connection records; changing it without re-consent makes those tokens unreadable. Do not use a `NEXT_PUBLIC_` prefix for secrets.
4. Use the assigned stable HTTPS production domain. In the Google Cloud OAuth Web client, add `https://YOUR-DOMAIN/api/auth/callback/google` as an authorized redirect URI and `https://YOUR-DOMAIN` as an authorized JavaScript origin. Keep the local callback as a separate entry for development. The Calendar API and `https://www.googleapis.com/auth/calendar.events` consent scope must be enabled; add the intended Google account as a test user while the OAuth app is in Testing.

Auth.js infers the host on Vercel. A stable production callback is required for Google sign-in; dynamic preview URLs need additional OAuth configuration and are not part of this release. Environment variable changes apply to a new deployment, so redeploy after changing them.

## Verify before sharing the URL

- Open the HTTPS site and sign in with the consenting test account. Check that the workspace loads and Google grants Calendar events access.
- Record a short synthetic voice request, inspect and edit the transcript, and send it. Use typed input if microphone permission is unavailable.
- Review the proposed event. Approve only an explicitly authorized synthetic, guest-free test event. Confirm the app shows a Google event ID and the exact event opens in Google Calendar.
- Check a second, fresh browser context cannot open the workspace or approve a plan. Check mobile layout without horizontal overflow.
- Capture only synthetic data in the demo. Keep API keys, OAuth codes/tokens, personal recordings, private IDs and email addresses out of screenshots and public video.

Do not claim the deployed integration works until these hosted checks pass. Google Tasks, Gmail sending, and voice output are not part of the verified release yet.
