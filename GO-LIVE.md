# Going live — complete step-by-step guide

Written for someone who has never deployed anything. No step is assumed.

**Total time:** about 90 minutes, plus waiting.
**Total cost:** £0 / $0. Every service below is used on its free tier.
**Software to install on your computer:** none.

---

## Before you start: read this bit

### One thing you asked for is not possible as stated

You said two things that conflict:

1. *"I have told people I have posted this on my GitHub"*
2. *"People should not see my code"*

A **private** GitHub repository is invisible. It does not appear on your
profile. Nobody can see that it exists. So if a person opens your GitHub
looking for this project, they will find **nothing at all** — which looks worse
than not mentioning it.

You cannot have both "people see it on my GitHub" and "the code is hidden" in
one repository. But you can have both across two:

| | What it holds | Who can see it |
|---|---|---|
| **Repo 1 — private** | All your source code | Only you |
| **Repo 2 — public** | A README: description, screenshots, live link | Everyone |

Repo 2 gives you something real to point at. It appears on your profile, looks
professional, and contains **zero source code**. This is normal practice for
commercial work, and an interviewer will not find it odd.

**Phase 8 sets up Repo 2.** Do not skip it — it is the part that satisfies
what you told people.

### One thing about "hiding the code" you should understand

I checked your built app specifically for this. Your **scoring engine, AI
prompts, and database security rules never reach the browser** — they run on
the server and are not downloadable. That is the valuable part, and it is
genuinely protected.

But every website in existence sends *some* code to the browser to draw the
page. A determined person with developer tools can read that layer on any site
— Facebook, your bank, this app. What they would get is button and layout code,
not your scoring logic or prompts.

So: your actual intellectual property is safe. Total invisibility is not a
thing any deployed website has, and anyone claiming otherwise is wrong.

### About downloads

You will download **one file, once** — a 184 KB `.tar.gz`. That is unavoidable;
the code has to get from here to GitHub somehow.

You will **not install any software**. No Node.js, no Git, no code editor,
no terminal on your machine. Everything else runs in browser tabs.

---

## What you are building

```
   YOUR BROWSER
        |
   [ Vercel ]  ......... runs the website, gives you a public link
        |
   [ Supabase ] ........ stores accounts, jobs, resumes, assessments
        |
   [ Groq ] ............ reads resumes and produces the analysis
```

Four accounts: GitHub, Supabase, Groq, Vercel. All free.

---

# PHASE 1 — Create your four accounts

Do all four now, before touching anything else. Open each in its own tab.

### 1.1 GitHub

1. Go to **https://github.com/signup**
2. Enter your email → **Continue**
3. Create a password → **Continue**
4. Choose a username. **This appears in your public profile URL, so pick
   something you would put on a CV.** `bharat-dev` reads better than
   `coolguy2003`.
5. Verify your email (check inbox, including spam).

### 1.2 Supabase

1. Go to **https://supabase.com/dashboard**
2. Click **Sign in with GitHub** — reuses the account you just made.
3. Click **Authorize Supabase**.

### 1.3 Groq

1. Go to **https://console.groq.com**
2. Sign up (Google or email).

### 1.4 Vercel

1. Go to **https://vercel.com/signup**
2. Choose **Hobby** (the free one).
3. Click **Continue with GitHub** → **Authorize Vercel**.

✅ **Checkpoint:** four tabs, all logged in.

---

# PHASE 2 — Put your code on GitHub (privately)

### 2.1 Download the project file

From this conversation, download **`talent-intelligence-platform.tar.gz`**.

It goes to your Downloads folder. **Do not try to open or extract it** — your
computer may not know how, and you do not need to. Just know where it is.

### 2.2 Create the private repository

1. Go to **https://github.com/new**
2. **Repository name:** `talent-intelligence-platform`
3. **Description:** `AI resume screening and talent intelligence platform`
4. Select **🔒 Private** ← **this is the important one. Check it twice.**
5. Tick **Add a README file**
6. Click **Create repository**

You now have a private repo. Confirm: next to the name at the top there should
be a grey **Private** badge. If it says **Public**, stop and fix it:
**Settings → General → scroll to Danger Zone → Change repository visibility**.

### 2.3 Open a Codespace (a free computer in your browser)

A Codespace is a full development machine that runs in a browser tab. Free
accounts get 120 hours per month; you will use about one.

1. On your repository page, click the green **`< > Code`** button
2. Click the **Codespaces** tab
3. Click **Create codespace on main**

A code editor loads in your browser. First time takes 1–3 minutes.

At the bottom you will see a **Terminal** panel — a black box where you type
commands. If you cannot see it: menu **☰ → Terminal → New Terminal**.

> **You are not "coding".** You are copying and pasting commands I give you.
> Paste with **Ctrl+V** (Windows) or **Cmd+V** (Mac), then press **Enter**.

### 2.4 Upload the project file

1. On the **left side** of the Codespace is the file explorer, showing
   `README.md`.
2. Open your Downloads folder on your computer.
3. **Drag `talent-intelligence-platform.tar.gz` from Downloads into the
   left-hand file list in the browser tab.**
4. Wait for it to appear in the list. It is small — a few seconds.

If drag-and-drop does not work: right-click the empty area of the file
explorer → **Upload...** → pick the file.

### 2.5 Unpack it

Click into the Terminal and paste this, then press Enter:

```bash
tar -xzf talent-intelligence-platform.tar.gz && mv talentiq/* talentiq/.* . 2>/dev/null; rm -rf talentiq talent-intelligence-platform.tar.gz && ls
```

You should see a list including `app`, `lib`, `components`, `supabase`,
`package.json`.

**If you see `app` and `lib` in that list, it worked.** Continue.

### 2.6 Confirm no secrets are about to be uploaded

Paste this:

```bash
cat .gitignore | head -12 && echo "--- env files present: ---" && ls -a | grep "^.env" || echo "none"
```

You should see `.env` and `.env*.local` listed in the ignore rules, and only
`.env.example` present. That means your future passwords cannot be uploaded
by accident.

### 2.7 Send the code to GitHub

Paste these **one at a time**, pressing Enter after each and waiting for it to
finish:

```bash
git add -A
```

```bash
git commit -m "AI resume screening and talent intelligence platform"
```

```bash
git push
```

If Git asks for your name and email, paste this first and then retry:

```bash
git config --global user.email "your@email.com" && git config --global user.name "Your Name"
```

### 2.8 Verify

Go back to your repository tab and **refresh**. You should now see all the
folders. The **Private** badge should still be there.

✅ **Checkpoint:** code is on GitHub, privately.

**Keep this Codespace tab open.** You need it again in Phase 6.

---

# PHASE 3 — Set up the database

### 3.1 Create the project

1. Go to **https://supabase.com/dashboard**
2. Click **New project**
3. **Name:** `talent-intelligence`
4. **Database Password:** click **Generate a password**, then click the copy
   icon.
5. **Paste that password somewhere safe right now.** A notes app is fine. You
   will likely never need it, but recovering it later is painful.
6. **Region:** pick the one nearest you (e.g. `Southeast Asia (Singapore)` or
   `Central EU (Frankfurt)`).
7. Click **Create new project**.

**Wait 2–3 minutes** while it provisions. Get a coffee.

### 3.2 Build the tables

1. In the left sidebar, click **SQL Editor** (icon looks like a terminal).
2. Click **+ New query**.
3. In your Codespace tab, open `supabase/migrations/0001_schema.sql` from the
   left file list.
4. Click inside the file, press **Ctrl+A** then **Ctrl+C** (Mac: Cmd+A, Cmd+C).
5. Back in Supabase, click in the big empty box and paste (**Ctrl+V**).
6. Click **Run** (bottom right, or Ctrl+Enter).

Wait for **"Success. No rows returned"** at the bottom. That is what success
looks like — it is not an error.

### 3.3 Apply the security rules

**This step is what stops one candidate reading another's data. Do not skip
it.**

1. Click **+ New query** again.
2. In your Codespace, open `supabase/migrations/0002_rls.sql`.
3. Select all, copy.
4. Paste into Supabase, click **Run**.

Again: **"Success. No rows returned"**.

### 3.4 Verify security is actually on

1. **+ New query**
2. Paste this and **Run**:

```sql
select tablename from pg_tables
where schemaname = 'public' and rowsecurity = false;
```

**You must get "Success. No rows returned".**

If any table names appear, security did not apply to them. Re-run
`0002_rls.sql` and check again. Do not continue until this returns nothing.

### 3.5 Collect your three keys

1. Left sidebar → **Project Settings** (gear icon) → **API**
2. You need three values. Copy each into your notes file:

| Label on the page | Call it |
|---|---|
| **Project URL** | SUPABASE_URL |
| **anon** / **public** key | SUPABASE_ANON_KEY |
| **service_role** / **secret** key (click *Reveal*) | SUPABASE_SERVICE_KEY |

> ⚠️ The **service_role** key bypasses all security. Never post it, never put
> it in a screenshot, never paste it into a public repo or a chat. If it ever
> leaks, come back here and click **Reset**.

✅ **Checkpoint:** database built, security verified, three keys saved.

---

# PHASE 4 — Get your AI key

1. Go to **https://console.groq.com**
2. Left sidebar → **API Keys**
3. Click **Create API Key**
4. **Name:** `talent-platform`
5. Click **Submit**
6. **Copy the key immediately** — it starts with `gsk_` and is shown **once
   only**. Save it in your notes as GROQ_KEY.

If you close the box before copying, delete the key and make a new one.

✅ **Checkpoint:** four values in your notes file.

---

# PHASE 5 — Put the site online

### 5.1 Import your repository

1. Go to **https://vercel.com/new**
2. You should see `talent-intelligence-platform` listed. Click **Import**.

*If it is not listed:* click **Adjust GitHub App Permissions** → grant access
to the repo → come back.

3. **Framework Preset** should already say **Next.js**. Leave everything else
   alone.

### 5.2 Add your secret values

**Do this before deploying.** Deploying without them fails.

Find **Environment Variables** and expand it. Add these **seven**, one at a
time — type the Name, paste the Value, click **Add**:

| Name | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | your SUPABASE_URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | your SUPABASE_ANON_KEY |
| `SUPABASE_SERVICE_ROLE_KEY` | your SUPABASE_SERVICE_KEY |
| `GROQ_API_KEY` | your GROQ_KEY |
| `GROQ_MODEL` | `llama-3.3-70b-versatile` |
| `AI_WORKER_SECRET` | see below |
| `CRON_SECRET` | see below |

For the last two, you need two random strings. In your **Codespace terminal**,
paste this:

```bash
echo "AI_WORKER_SECRET: $(openssl rand -hex 32)" && echo "CRON_SECRET: $(openssl rand -hex 32)"
```

Copy each long string into the matching box. Also save both in your notes.

**Check spelling carefully.** `NEXT_PUBLIC_SUPABASE_URL` with a typo means a
broken site and a confusing error.

### 5.3 Deploy

Click **Deploy**.

Wait 2–4 minutes. You will see build logs scrolling. When it finishes you get
a congratulations screen and a URL like:

```
https://talent-intelligence-platform.vercel.app
```

**Save that URL in your notes.** That is your live product.

Click it. You should see the landing page with the requirement matrix.

> **If the build failed:** click the failed deployment → read the red error.
> Nine times out of ten it is a misspelled environment variable name. Fix it
> under **Settings → Environment Variables**, then **Deployments → ⋯ →
> Redeploy**.

### 5.4 Tell Supabase about your URL

Without this, logging in will fail.

1. Supabase → **Authentication** → **URL Configuration**
2. **Site URL:** paste your Vercel URL (no trailing slash)
3. **Redirect URLs** → **Add URL** → paste your Vercel URL followed by `/**`

   Example: `https://talent-intelligence-platform.vercel.app/**`
4. Click **Save**

### 5.5 Add the site URL to Vercel too

1. Vercel → your project → **Settings** → **Environment Variables**
2. Add: `NEXT_PUBLIC_SITE_URL` = your Vercel URL
3. Go to **Deployments** → click **⋯** on the newest → **Redeploy** →
   **Redeploy**

✅ **Checkpoint:** your site is live and publicly reachable.

---

# PHASE 6 — Create accounts and demo data

Your site works but is empty. Time to fill it.

### 6.1 Choose your three passwords

You need three. **Make them yourself** — I deliberately have not generated any,
because anything written in this chat is not a secret.

In your Codespace terminal:

```bash
echo "CANDIDATE: $(openssl rand -base64 18)" && echo "RECRUITER: $(openssl rand -base64 18)" && echo "ADMIN: $(openssl rand -base64 18)"
```

Save all three in your notes, labelled. You will read these out or type them
during your interview, so keep them somewhere you can find in five seconds.

### 6.2 Give the Codespace your keys

In the Codespace terminal, paste this **template**, but replace each
`PASTE_...` with your real value first. Easiest way: paste it into your notes
app, edit it there, then copy the finished version into the terminal.

```bash
cat > .env.local <<'EOF'
NEXT_PUBLIC_SUPABASE_URL=PASTE_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=PASTE_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=PASTE_SUPABASE_SERVICE_KEY
GROQ_API_KEY=PASTE_GROQ_KEY
GROQ_MODEL=llama-3.3-70b-versatile
AI_WORKER_SECRET=PASTE_AI_WORKER_SECRET
EOF
echo "saved"
```

> This file is in `.gitignore`, so it will never be uploaded to GitHub. That
> is deliberate.

### 6.3 Install and seed

Paste, one at a time:

```bash
npm install
```

(Takes 1–2 minutes.)

```bash
export SEED_PASSWORD_CANDIDATE='your-candidate-password'
export SEED_PASSWORD_RECRUITER='your-recruiter-password'
export SEED_PASSWORD_ADMIN='your-admin-password'
```

Replace each with the real password, **keeping the single quotes**.

```bash
set -a && source .env.local && set +a && npx tsx scripts/seed.ts
```

You should see accounts, roles and applications being created, ending with
**"Seeding complete."**

### 6.4 Run the AI analysis

The seed queued the work; now it must be processed. Replace the URL and secret
with yours:

```bash
for i in $(seq 1 20); do curl -s -X POST "https://YOUR-VERCEL-URL.vercel.app/api/worker/drain" -H "Authorization: Bearer YOUR_AI_WORKER_SECRET"; echo ""; sleep 20; done
```

This runs 20 times over about 7 minutes. You will see `{"processed":8}`,
then smaller numbers, eventually `{"processed":0}`.

**`{"processed":0}` repeatedly means it is done.** Press **Ctrl+C** to stop
early once you see it twice.

> Groq's free tier is rate limited. If you see `rate_limited`, that is normal
> and expected — the queue backs off and retries by itself. Just let it run.

### 6.5 Upload one real resume

The seeded resumes have no PDF file behind them, so the recruiter's PDF viewer
will show a fallback message. Fix it in two minutes:

1. Open your live site → **Sign in** as `candidate@demo.internal`
2. Go to **Resume** → upload any real PDF resume (your own is fine)
3. Wait for the analysis
4. Go to **Roles** → open one → **Check my match** → **Apply**

Now at least one candidate has a genuine PDF a recruiter can open.

✅ **Checkpoint:** your platform has real data.

---

# PHASE 7 — Test everything

Go through this on the **live site**, not the Codespace. Tick each.

**Public (sign out first, or use a private window):**
- [ ] Landing page loads
- [ ] `/jobs` shows open roles
- [ ] Clicking a role shows its description
- [ ] Visiting `/admin` directly sends you to the login page

**Candidate** (`candidate@demo.internal`):
- [ ] Sign in lands on the candidate dashboard
- [ ] Resume page shows the ATS analysis
- [ ] A role shows a match preview
- [ ] Applications list shows your applications
- [ ] Interview preparation generates questions

**Recruiter** (`recruiter@demo.internal`):
- [ ] Sign in lands on the recruiter dashboard
- [ ] Opening a role shows ranked applicants with scores
- [ ] Opening a candidate shows the requirement matrix
- [ ] The original PDF displays (for the candidate from 6.5)
- [ ] Changing the stage works
- [ ] **Export CSV** downloads a file

**Admin** (`admin@demo.internal`):
- [ ] Sign in lands on the admin dashboard
- [ ] Users page lists accounts
- [ ] AI operations shows requests and the queue

**Security — the important one:**
- [ ] Signed in as **candidate**, type `/recruiter` in the address bar →
      you are redirected, not shown the page
- [ ] Signed in as **candidate**, type `/admin` → redirected
- [ ] Signed in as **recruiter**, type `/admin` → redirected

If any security check fails, stop and tell me before showing anyone.

---

# PHASE 8 — The public showcase repo

This is the part that makes your GitHub show something. It contains **no
source code**.

### 8.1 Take screenshots

On your live site, screenshot these four:

1. The landing page
2. A recruiter candidate workspace (the requirement matrix)
3. The score breakdown table
4. The candidate resume analysis

Save them. On Windows use **Win+Shift+S**, on Mac **Cmd+Shift+4**.

### 8.2 Create the public repo

1. **https://github.com/new**
2. **Name:** `talent-intelligence-platform-showcase`
3. Select **Public**
4. Tick **Add a README file**
5. **Create repository**

### 8.3 Add your screenshots

1. In the new repo, click **Add file** → **Upload files**
2. Drag your four screenshots in
3. Click **Commit changes**

### 8.4 Write the README

1. Click **README.md** → click the **pencil** icon
2. Delete everything
3. Paste the template below, replacing the CAPITALISED bits
4. Click **Commit changes**

````markdown
# AI Resume Screening & Talent Intelligence Platform

**Live demo → https://YOUR-URL.vercel.app**

An evidence-first recruitment platform. Every claim it makes about a candidate
is traceable to the line of the resume it came from.

![Landing page](./screenshot-1.png)

## The problem

Most resume screeners infer. A resume saying "worked with cloud technologies"
becomes an AWS qualification, and a recruiter acts on something the candidate
never claimed.

This one refuses to infer. That phrase resolves to **not demonstrated**, and
becomes a question for the interview instead.

![Requirement matrix](./screenshot-2.png)

## How assessment works

1. **Specification** — a job posting becomes discrete, individually assessable
   requirements, each marked required, preferred, or nice-to-have.
2. **Evidence** — the resume is assessed against each one and resolved to
   *demonstrated*, *insufficient evidence*, or *not demonstrated*, carrying the
   phrase that supports it.
3. **Scoring** — a deterministic engine weights evidence by importance and by
   role-specific dimension weights. **The language model never produces the
   score.** Same input, same number, every time.
4. **Decision** — the recruiter reviews the matrix beside the original PDF.
   Their decision is stored separately and never overwrites the assessment.

![Score breakdown](./screenshot-3.png)

## Engineering notes

- **Authorization is enforced in the database**, not the interface. 78
  row-level security policies mean an unauthorized API call returns nothing
  even if a UI check were bypassed.
- **Recruiters cannot browse candidates.** A candidate becomes visible only by
  applying to that recruiter's specific role.
- **Applications snapshot their job spec**, so editing a role later cannot
  retroactively change an assessment that has already been made.
- **The AI queue survives provider outages** — exponential backoff, retry, and
  partial-result preservation. A failed analysis never destroys an upload.
- **220 automated assertions** across scoring, authorization, PDF handling, AI
  behaviour, and live HTTP.

![Resume analysis](./screenshot-4.png)

## Built with

Next.js · TypeScript · PostgreSQL (Supabase) · Groq · Tailwind CSS · Vercel

## Source code

The source is in a private repository. Happy to walk through the architecture,
the scoring engine, or the security model in an interview.

---

Built by YOUR NAME · [LinkedIn](YOUR-LINKEDIN)
````

> Adjust the screenshot filenames to match what you actually uploaded — check
> the file list in your repo.

### 8.5 Pin it to your profile

1. Go to `https://github.com/YOUR-USERNAME`
2. Click **Customize your pins**
3. Tick `talent-intelligence-platform-showcase`
4. **Save pins**

✅ **Checkpoint:** anyone visiting your GitHub sees a professional project page
with a working link, and no source code.

---

# PHASE 9 — Before any interview

### The day before

- [ ] Open your live URL and click through every page. **Supabase pauses free
      projects after 7 days of no activity** and takes a minute to wake. Do not
      discover this in front of an interviewer.
- [ ] Confirm all three logins work
- [ ] Have your three passwords open in a notes app

### Things you should be ready to explain

**"Why doesn't the AI produce the score?"**
Because language models are not consistent. Ask twice, get 84 then 79. A
recruiter cannot defend a decision on that, and in many places a candidate can
ask why they were rejected. So the model does what it is good at — reading
text and citing evidence — and fixed arithmetic does the scoring. Same input,
same number, and the full breakdown is on screen.

**"How do you stop one recruiter seeing another's candidates?"**
It is enforced in Postgres, not the interface. Row-level security means a
recruiter reaches a candidate only through an application to a job they own.
Even if someone called the API directly, the database returns nothing.

**"What was the hardest bug?"**
The scoring weights. The model proposes per-role emphasis, which I clamp to
bounds and renormalise. But clamping and rescaling once let one dimension
escape its ceiling — 0.64 against a 0.45 limit. My tests caught it. I replaced
it with iterative projection and verified against 5,000 random vectors.

**Be honest about what is not built.** `STATUS.md` in the private repo lists
it. Saying "seeded resumes have no PDF, so I upload one real file before
demoing" is a much stronger answer than being caught by it.

---

# If something breaks

| Symptom | Cause | Fix |
|---|---|---|
| Build failed on Vercel | Misspelled env var | Settings → Environment Variables → fix → Redeploy |
| Site loads, login fails | Supabase URL config | Phase 5.4 |
| "Failed to fetch" everywhere | Supabase project paused | Open Supabase dashboard, wait 60s |
| Applications stuck on "Screening" | Queue not drained | Re-run the loop from Phase 6.4 |
| `rate_limited` in the queue | Groq free tier | Normal. Wait; it retries itself |
| Resume upload says "could not be read" | Image-based PDF | Use a text PDF (exported from Word/Docs, not a scan) |
| PDF viewer empty for seeded candidates | Expected | See Phase 6.5 |

**Where to look first:** Vercel → your project → **Logs**. Errors appear there
in plain language.

---

# Cost control

Nothing here charges you automatically. None of these services can bill you
without you entering a card.

| Service | Free limit | Watch for |
|---|---|---|
| GitHub | Unlimited private repos | — |
| Codespaces | 120 hours/month | **Stop it when done** (see below) |
| Supabase | 500 MB database, 1 GB files | Pauses after 7 days idle |
| Vercel | 100 GB bandwidth/month | Nowhere near it |
| Groq | Rate-limited free usage | Slows down, never charges |

**Stop your Codespace when finished** so it does not eat your hours:
go to **https://github.com/codespaces**, click **⋯** next to it, click **Stop**.

You can restart it any time; your files stay.

---

# Quick reference — fill this in

```
Live URL:            _______________________________________
Private repo:        github.com/________/talent-intelligence-platform
Public showcase:     github.com/________/talent-intelligence-platform-showcase

candidate@demo.internal   password: ______________________
recruiter@demo.internal   password: ______________________
admin@demo.internal       password: ______________________
```

Keep this in a private notes app. **Not** in either repository.
