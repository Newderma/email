# HR Task Follow-up Automation

Every few days, each active employee gets an email listing their open tasks
as plain questions. They open a link (no login), tap a real status
(Done / In progress / Not yet) per task, optionally add a short note, and
hit Send — which emails the manager **as them, immediately, from their own
answers**. Nothing is ever guessed or sent without them directly providing it.

## How it works
1. `src/scheduler.js` runs daily. For each employee whose last check-in was
   4+ days ago (configurable) and who has open tasks, it creates a one-time
   approval link and emails them (as the manager) via SMTP.
2. They open `public/approve.html?token=...`, tap statuses, submit.
3. `src/server.js` receives the submission, composes the reply email from
   their taps/notes, and sends it via SMTP **as them**, then marks
   "Done" tasks complete in Supabase.

## One-time setup

### 1. Supabase
Run `sql/schema.sql` in your Supabase SQL editor (same project as
clinic-tracker). This creates `hrf_employees`, `hrf_tasks`, `hrf_approvals`
— all prefixed `hrf_` so nothing collides with your existing `ct_` tables.

Then add your employees, e.g.:
```sql
insert into hrf_employees (name, email, role, smtp_key) values
  ('Israa', 'israa@newderma1.com', 'HR', 'ISRAA'),
  ('Legal Consultant Name', 'legal@newderma1.com', 'Legal', 'LEGAL');
```
The `smtp_key` must match an `EMPLOYEE_SMTP_<KEY>` entry in your `.env`.

And add tasks as you normally think of them — plain text, nothing special:
```sql
insert into hrf_tasks (employee_id, task_text) values
  ('<israa-uuid>', 'Renew Ahmed''s iqama, expires Aug 15'),
  ('<israa-uuid>', 'Confirm Sara''s Seha membership renewal');
```

### 2. Environment
Copy `.env.example` to `.env` and fill in:
- Supabase URL + **service role** key (Project Settings → API in Supabase)
- Manager's SMTP details for `mail.newderma1.com`
- One `EMPLOYEE_SMTP_<KEY>` line per employee — get each mailbox's SMTP
  host/port from web.com's hosting control panel (usually
  `mail.newderma1.com`, port 587)
- `APPROVAL_BASE_URL` — wherever you host `public/approve.html`

**Never commit `.env` to git.** Add it to `.gitignore`.

### 3. Install & run
```bash
npm install
npm start
```
To test the email-sending logic immediately without waiting for the daily
cron:
```bash
npm run check-now
```

### 4. Hosting
This needs a place that keeps a Node process running (unlike static
Netlify hosting) — **Render** or **Railway** both have free tiers that are
plenty for this volume. Steps are the same on either:
1. Push this folder to a GitHub repo (or a folder inside your existing repo)
2. Connect that repo on Render/Railway, set the start command to `npm start`
3. Paste in the same `.env` values as environment variables in their dashboard
4. The approval page (`public/approve.html`) is served automatically by
   this same server at `<your-deployed-url>/approve.html` — point
   `APPROVAL_BASE_URL` at that deployed URL.

## Security notes
- Employee mailbox passwords live only in server environment variables,
  never in the Supabase database.
- Approval tokens are single-use, random, and expire (default 72h).
- Supabase tables have RLS enabled with no public policies — only the
  service role key (used server-side only) can read/write them.

## Adding a new employee later
1. Add a row to `hrf_employees` with a new unique `smtp_key`
2. Add the matching `EMPLOYEE_SMTP_<KEY>=host|port|user|pass` line to `.env`
   (and to your hosting provider's environment variables)
3. Add their tasks to `hrf_tasks` as you assign them — plain text is fine

## Handing this off to Claude Code
This is a complete, working starting point. If you want changes (e.g.
WhatsApp notification instead of email, a different check-in cadence,
reminder nudges for unanswered links), open this folder with Claude Code
and describe what you want changed — it can edit, test, and redeploy
directly against this codebase.
