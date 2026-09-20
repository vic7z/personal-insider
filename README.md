# Personal Insider 

Private mobile-first guest relations PWA for W Maldives.

## Runtime

React / Next.js on Vercel with Supabase PostgreSQL and Supabase Auth. The app uses server-only Supabase sessions in HttpOnly cookies. No guest records or authentication tokens are stored in localStorage. The service worker caches only a non-sensitive offline screen and app icons. The original Vinext preview scripts remain available; Vercel builds with next build.

## Database

Project: uuwotpmmvqbjmjbfiaux. Applied SQL is retained in supabase/migrations. The pi_private schema holds members, invitations, guests, moves and room history. Tables have RLS enabled and direct access is denied. Public SECURITY INVOKER RPC wrappers call private functions that validate the current authenticated session and active team role. Mutations lock guest records and check versions; a room move and history insertion commit atomically.

Admin manages team access and guests. Guest Relations edits guests. Manager is read-only. Butler receives a reduced room/stay view without notes, travel agents, membership, celebrations or EPIC moments.

## Account setup

Direct registrations join the same hotel workspace with Guest Relations access after email verification, without approval. The existing owner email reservation receives Admin access. Invited registrations wait for the inviter to approve them in Settings. Non-admin inviters can only grant their own role. Invitation links are email-bound and expire after 24 hours. Only the inviter can approve an accepted invitation. Configure Supabase Auth Site URL and redirect allowlist to the deployed app URL, /auth/callback, and /auth/callback?next=/reset-password. Configure custom SMTP before inviting email addresses outside the Supabase organization team.

## Run

npm ci
npm run dev
npm run build

Local preview uses the online Supabase project. Previous D1 preview state is retained locally, but is no longer used. No preview guests were copied into production.

## Verification

TypeScript and production build checked. Transactional database checks cover single guest identity, planned/completed moves, history, stale edits, departures, archives, and Manager/Butler/inactive/anonymous access. Test records were rolled back. Email delivery and live user registration require the owner's email confirmation and Auth URL configuration.

## BNF schedules

BNF appears in desktop and mobile navigation. Admin and Guest Relations users can select a PDF (up to 3 MB / 20 pages), extract text locally, compare it against rendered page previews, correct dates and details, and save the reviewed text. Manager and Butler users have read-only access. Only the title, date range, reviewed details, review notes and source filename are sent to Supabase; PDF bytes and page previews never leave the browser. Scanned/image text requires manual transcription; extraction is not OCR. Sparse table cells retain their date labels and merged notes remain unassigned.

Apply `20260920170000_bnf_schedules.sql` and `20260920170100_bnf_initial_schedules.sql` to a new database. Both are already applied to the connected project. The second seeds visually reviewed details for 8–14 and 15–21 September 2026. There is no Storage bucket dependency. The public RPC calls a checked private function using the existing active-member/session rules; direct table access is denied.

The bundled `public/pdf.worker.min.mjs` matches the pinned `pdfjs-dist` version. Copy the corresponding `node_modules/pdfjs-dist/build/pdf.worker.min.mjs` when deliberately upgrading PDF.js.

Validate with `npx tsc --noEmit`, `npx next build`, and `node tests/bnf.mjs <8-14-PDF-path> <15-21-PDF-path>`. Database authorization assertions are in `tests/bnf.sql` and roll back their synthetic records.
