# Build status

## Verified in this session

| Check | Result |
|---|---|
| `tsc --noEmit` | clean |
| `next build` (production) | succeeds, 55 routes |
| Scoring engine suite | 23/23 |
| Authorization suite | 76/76 |
| PDF ingestion suite | 29/29 |
| AI layer suite | 50/50 |
| Live HTTP suite | 42/42 |
| Security audit (10 checks) | all pass |

**220 assertions total.** Run with `npm test` and `npm run test:http`.

Three real bugs were found and fixed by these tests, not by inspection:

1. **Weight normalisation escaped its bounds.** Clamp-then-rescale ran once,
   so renormalisation pushed `technical_skills` to 0.64 against a 0.45 ceiling.
   Replaced with iterative projection plus residual redistribution; verified
   against 5,000 random weight vectors.
2. **Dead branch in the seed script.** TypeScript caught a `draft` comparison
   that no seeded job could satisfy, masking a latent publish/close bug.
3. **Two false results in my own authorization tests.** A character-window
   regex bled into the adjacent policy statement, and static parsing could not
   see policies generated inside a `do $$` loop. Both replaced with a real
   policy parser. Worth noting because a security test that passes for the
   wrong reason is worse than no test.

## Built

**Data layer** — 27 tables, foreign keys, check constraints, partial and
trigram indexes, `updated_at` triggers, auth→profile trigger. 78 RLS policies
(63 static, 15 loop-generated), `FORCE`d, deny-by-default, with
`SECURITY DEFINER` helpers that avoid policy recursion. Private storage bucket
scoped so a recruiter reaches a resume only through an application to their
own job.

**AI layer** — single Groq abstraction; nine Zod-validated operations sharing
one evidence contract; corrective retry on schema failure; queue with
optimistic claim, exponential backoff and `Retry-After` support; partial
unique index preventing duplicate in-flight work; failure paths that preserve
stored artifacts; usage and event logging.

**Scoring** — deterministic engine. The model supplies evidence states and one
bounded 0–1 semantic signal; arithmetic produces the number. Per-role weights
are clamped and renormalised. Unused dimensions redistribute rather than
scoring zero. Full component breakdown; contributions sum to the total.

**Candidate** — profile editor with completeness; resume upload with drag-drop,
PDF validation, extraction and ATS analysis; section rewriting with
fact-preservation warnings; role browsing; pre-application match preview with
no score exposed; apply flow with spec snapshotting; application tracking;
interview preparation and interactive practice with per-answer feedback.

**Recruiter** — job create/edit with AI-derived specification; ranked applicant
table with seven simultaneous filters; candidate workspace pairing the
requirement matrix with the original PDF; score breakdown; skill and experience
intelligence; decision panel where the recruiter's stage never overwrites the
assessment; notes and tags; interview kits; multi-candidate comparison;
per-job and per-candidate CSV export with formula-injection guards; pipeline
board.

**Admin** — user management with self-lockout prevention; role oversight; AI
configuration and feature toggles; queue inspection with manual retry; system
monitoring; storage and processing health.

**Reliability** — loading, empty, error and processing states throughout; root
error boundary; classified PDF failures with actionable copy; queue survives
provider outages.

## Not built

- **Seeded resumes have no PDF file.** The seed inserts extracted text
  directly, so the recruiter PDF viewer degrades to its fallback for seeded
  candidates. Upload a real PDF as `candidate@demo.internal` before demoing
  the viewer.
- **Storage cleanup on hard-deleted candidates** is not implemented; orphaned
  objects would accumulate. Irrelevant at demo scale.
- **No live cross-tenant probing.** The authorization suite verifies policy
  structure, not runtime behaviour against a real database. The manual
  checklist in `DEPLOY.md` §6 covers this and should be run once.

## Honest read

The application is functionally complete against the specification and every
layer is exercised by tests. What it has never been is *run against a real
Supabase and Groq*, because my sandbox has no network route to either. Until
you complete `DEPLOY.md`, treat "works" as "compiles, passes 220 assertions,
and serves correctly under a live HTTP server with placeholder credentials."

The two things most worth walking an interviewer through are the RLS model and
the scoring engine — that is where the actual engineering judgement sits.
