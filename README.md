# Personal Insider

Private mobile-first guest relations PWA for W Maldives.

## Runtime

React / Vinext with Supabase PostgreSQL and Supabase Auth. The app uses server-only Supabase sessions in HttpOnly cookies. No guest records or authentication tokens are stored in localStorage. The service worker caches only a non-sensitive offline screen and app icons.

## Database

Project: uuwotpmmvqbjmjbfiaux. Applied SQL is retained in supabase/migrations. The pi_private schema holds members, invitations, guests, moves and room history. Tables have RLS enabled and direct access is denied. Public SECURITY INVOKER RPC wrappers call private functions that validate the current authenticated session and active team role. Mutations lock guest records and check versions; a room move and history insertion commit atomically.

Admin manages team access and guests. Guest Relations edits guests. Manager is read-only. Butler receives a reduced room/stay view without notes, travel agents, membership, celebrations or EPIC moments.

## Account setup

The first admin invitation is in the private output file, excluded from Git. New accounts require a valid invitation. Supabase email verification remains enabled. Configure Supabase Auth Site URL and redirect allowlist to the deployed app URL, /auth/callback, and /auth/callback?next=/reset-password. For local development, allow http://localhost:5173/auth/callback and http://localhost:5173/auth/callback?next=/reset-password. Configure custom SMTP before inviting email addresses outside the Supabase organization team.

## Run

npm ci
npm run dev
npm run build

Local preview uses the online Supabase project. Previous D1 preview state is retained locally, but is no longer used. No preview guests were copied into production.

## Verification

TypeScript and production build checked. Transactional database checks cover single guest identity, planned/completed moves, history, stale edits, departures, archives, and Manager/Butler/inactive/anonymous access. Test records were rolled back. Email delivery and live user registration require the owner's email confirmation and Auth URL configuration.
