# Deployment runbook

Everything here needs credentials I do not have. Budget ~25 minutes.
Total cost: $0 — every service below is used on its free tier.

---

## 1. Supabase (~8 min)

1. Create a project at supabase.com. Note the **database password**.
2. Project Settings → API. Copy:
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon` `public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` (server-only, never client)
3. SQL Editor → New query. Paste and run **in this order**:
   - `supabase/migrations/0001_schema.sql`
   - `supabase/migrations/0002_rls.sql`

   `0002` creates the private `resumes` storage bucket too, so there is no
   separate storage step.

4. Verify RLS is on everywhere — this should return **zero rows**:

```sql
select tablename from pg_tables
where schemaname = 'public' and rowsecurity = false;
```

5. Create the three demo accounts. Authentication → Users → Add user
   (tick *Auto Confirm User*), then set the role via metadata:

```sql
-- After creating the three auth users in the dashboard, run:
update auth.users set raw_user_meta_data =
  jsonb_build_object('role','candidate','full_name','Priya Raman')
  where email = 'candidate@demo.internal';
update auth.users set raw_user_meta_data =
  jsonb_build_object('role','recruiter','full_name','Daniel Okonjo')
  where email = 'recruiter@demo.internal';
update auth.users set raw_user_meta_data =
  jsonb_build_object('role','admin','full_name','System Administrator')
  where email = 'admin@demo.internal';

-- Sync the profiles rows the trigger created:
update public.profiles p set role = (u.raw_user_meta_data->>'role')::user_role,
                             full_name = u.raw_user_meta_data->>'full_name'
from auth.users u where u.id = p.id;

-- Candidates need a candidate_profiles row:
insert into public.candidate_profiles (user_id)
select id from public.profiles where role = 'candidate'
on conflict (user_id) do nothing;
```

**Generate your own passwords** — use a password manager, minimum 20
characters. Do not reuse anything. Do not commit them anywhere. Keep them in
your notes app for the interview.

---

## 2. Groq (~2 min)

1. console.groq.com → API Keys → Create.
2. `GROQ_API_KEY` = the key. `GROQ_MODEL` = `llama-3.3-70b-versatile`.

Free tier is rate-limited, which is exactly why `lib/ai/service.ts` implements
queueing with backoff. Worth mentioning in the interview — it was a design
constraint, not an afterthought.

---

## 3. Local run (~3 min)

```bash
cp .env.example .env.local     # then fill in real values
npm install
npm run test:scoring           # 23 assertions, should pass
npm run typecheck
npm run dev
```

---

## 4. Private GitHub repo (~3 min)

```bash
git init
git add -A
git status                     # CONFIRM .env.local is NOT listed
git commit -m "Talent intelligence platform: schema, RLS, AI layer, scoring engine"
gh repo create talent-intelligence --private --source=. --push
# or create the repo in the UI as PRIVATE, then:
# git remote add origin git@github.com:<you>/talent-intelligence.git && git push -u origin main
```

Verify privacy: repo page must show a **Private** badge next to the name.

---

## 5. Vercel (~5 min)

1. vercel.com → Add New → Project → import the private repo.
2. Framework preset: Next.js. Leave build settings default.
3. Add environment variables for **Production, Preview and Development**:

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | your project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | service role key |
| `GROQ_API_KEY` | Groq key |
| `GROQ_MODEL` | `llama-3.3-70b-versatile` |
| `AI_WORKER_SECRET` | `openssl rand -hex 32` |
| `NEXT_PUBLIC_SITE_URL` | your `.vercel.app` URL |

4. Deploy. Then set Supabase → Authentication → URL Configuration → Site URL
   to your Vercel URL, or sign-in redirects will fail in production.

---

## 6. Post-deploy verification

Walk these in order on the live URL:

- [ ] Landing page renders, no console errors
- [ ] `/jobs` loads while signed out
- [ ] Sign in as each of the three accounts → lands on the right workspace
- [ ] **Security:** signed in as candidate, manually visit `/recruiter` and
      `/admin` → both must redirect, not render
- [ ] **Security:** signed in as recruiter, `/admin` → redirects
- [ ] Sign out clears the session

---

## Cost guardrails

| Service | Free tier | Watch for |
|---|---|---|
| Supabase | 500 MB DB, 1 GB storage | Pauses after 7 days idle — open it before the interview |
| Vercel | 100 GB bandwidth | Fine |
| Groq | Rate-limited free usage | Queue handles 429s; don't bulk-screen right before demoing |

**Open the Supabase project the morning of the interview.** A paused free-tier
project takes a minute to wake and will make the demo look broken.
