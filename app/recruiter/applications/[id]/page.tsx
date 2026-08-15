import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requirePage, requireApplicationAccess } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';
import { AppShell, PageHead } from '@/components/app-shell';
import { Panel, ScoreDial, CategoryPill, EvidenceBadge, ImportanceTag, AiDisclosure, ProcessingState, ErrorState } from '@/components/ui';
import { DIMENSION_LABEL, type Dimension, type MatchCategory } from '@/lib/scoring/engine';
import { ResumeViewer } from './resume-viewer';
import { DecisionPanel } from './decision-panel';
import { InterviewKit } from './interview-kit';

export const dynamic = 'force-dynamic';

export default async function CandidateWorkspace({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requirePage('recruiter', 'admin');
  await requireApplicationAccess(id);
  const supabase = await createClient();

  const { data: app } = await supabase
    .from('applications')
    .select(`id, stage, screening_status, submitted_at, job_id, resume_id,
             jobs(id, title, company),
             candidate_profiles(location, years_experience, headline, summary, phone,
                                linkedin_url, portfolio_url, profiles(full_name, email)),
             application_scores(overall, category, components, weights, engine_version),
             application_analyses(requirement_matrix, skill_intelligence, experience_intel,
                                  strengths, concerns, summary, model)`)
    .eq('id', id).maybeSingle();

  if (!app) notFound();

  const job = app.jobs as unknown as { id: string; title: string; company: string } | null;
  const cp = app.candidate_profiles as unknown as {
    location: string | null; years_experience: number | null; headline: string | null;
    summary: string | null; phone: string | null; linkedin_url: string | null;
    portfolio_url: string | null; profiles: { full_name: string; email: string } | null;
  } | null;
  const score = app.application_scores as unknown as {
    overall: number; category: MatchCategory; engine_version: string;
    components: Array<{ dimension: Dimension; raw: number; weight: number; contribution: number; considered: number; detail: string }>;
  } | null;
  const analysis = app.application_analyses as unknown as {
    requirement_matrix: Array<{ id: string; label: string; kind: string; importance: 'required' | 'preferred' | 'nice_to_have'; state: 'demonstrated' | 'insufficient' | 'not_demonstrated'; evidence: string | null; reasoning: string }>;
    skill_intelligence: { matching: string[]; missing: string[]; additional: string[] };
    experience_intel: {
      relevant_roles: Array<{ role: string; relevance: string; why: string }>;
      relevant_projects: Array<{ name: string; relevance: string; why: string }>;
    };
    strengths: string[]; concerns: string[]; summary: string | null; model: string;
  } | null;

  const { data: notes } = await supabase
    .from('recruiter_notes').select('id, body, created_at')
    .eq('application_id', id).order('created_at', { ascending: false });

  const { data: tags } = await supabase.from('application_tags').select('tag').eq('application_id', id);

  const { data: events } = await supabase
    .from('application_events').select('kind, from_stage, to_stage, note, created_at')
    .eq('application_id', id).order('created_at', { ascending: false }).limit(12);

  const { data: kit } = await supabase
    .from('interview_kits').select('questions').eq('application_id', id).maybeSingle();

  const { data: rank } = await supabase
    .from('applications').select('id, application_scores(overall)').eq('job_id', app.job_id);
  const ranked = (rank ?? [])
    .map((r) => ({ id: r.id, overall: Number((r.application_scores as unknown as { overall: number } | null)?.overall ?? -1) }))
    .sort((a, b) => b.overall - a.overall);
  const position = ranked.findIndex((r) => r.id === id) + 1;

  const matrix = analysis?.requirement_matrix ?? [];
  const grouped = {
    required: matrix.filter((m) => m.importance === 'required'),
    preferred: matrix.filter((m) => m.importance === 'preferred'),
    nice_to_have: matrix.filter((m) => m.importance === 'nice_to_have'),
  };

  return (
    <AppShell user={user}>
      <Link href={`/recruiter/jobs/${app.job_id}`}
            className="font-mono text-micro uppercase tracking-wider text-ink-faint hover:text-ink">
        &larr; {job?.title}
      </Link>

      <div className="mt-4">
        <PageHead
          eyebrow={`Applied ${new Date(app.submitted_at).toLocaleDateString()} · ${job?.company}`}
          title={cp?.profiles?.full_name ?? 'Candidate'}
          description={cp?.headline ?? undefined}
          action={
            <a href={`/api/export/application/${id}`} className="btn-secondary text-sm" download>
              Export report
            </a>
          }
        />
      </div>

      {app.screening_status === 'failed' && (
        <div className="mb-6">
          <ErrorState
            title="Screening did not complete"
            body="The assessment could not be produced for this application. The resume and application are intact — use Re-run assessment below to try again."
          />
        </div>
      )}

      {(app.screening_status === 'queued' || app.screening_status === 'processing') && (
        <div className="mb-6">
          <ProcessingState label="Screening in progress. This page will show the assessment when it completes." />
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-6">
          {/* --- Overview --- */}
          <Panel eyebrow="Overview" title="Assessment summary">
            <div className="flex flex-wrap items-center gap-6">
              {score ? (
                <>
                  <ScoreDial value={Number(score.overall)} category={score.category} size="lg" />
                  <div>
                    <CategoryPill category={score.category} />
                    <p className="tnum mt-2 text-sm text-ink-muted">
                      Ranked <span className="font-semibold text-ink">{position}</span> of {ranked.length} for this role
                    </p>
                    <p className="mt-1 font-mono text-micro uppercase tracking-wider text-ink-faint">
                      Engine {score.engine_version}
                    </p>
                  </div>
                </>
              ) : (
                <p className="text-sm text-ink-muted">No assessment available yet.</p>
              )}
            </div>

            {analysis?.summary && (
              <p className="mt-5 border-t border-rule pt-4 text-sm leading-relaxed text-ink-soft">
                {analysis.summary}
              </p>
            )}
            <AiDisclosure />
          </Panel>

          {/* --- Requirement matrix: the signature view --- */}
          <Panel eyebrow="Requirement matrix" title="Evidence against each requirement">
            {matrix.length === 0 ? (
              <p className="text-sm text-ink-muted">No requirement assessment available.</p>
            ) : (
              <>
                {(['required', 'preferred', 'nice_to_have'] as const).map((band) =>
                  grouped[band].length === 0 ? null : (
                    <div key={band} className="mb-5 last:mb-0">
                      <div className="mb-2"><ImportanceTag importance={band} /></div>
                      <div className="border-t border-rule">
                        {grouped[band].map((m, i) => (
                          <div key={m.id ?? i} className={`ledger-row rail-${m.state}`}>
                            <div className="min-w-0">
                              <p className="text-sm font-semibold">{m.label}</p>
                              {m.evidence ? (
                                <p className="mt-1.5 border-l-2 border-rule pl-3 text-xs italic leading-relaxed text-ink-muted">
                                  {m.evidence}
                                </p>
                              ) : (
                                <p className="mt-1.5 text-xs leading-relaxed text-ink-faint">
                                  {m.reasoning || 'No supporting evidence found in the resume.'}
                                </p>
                              )}
                            </div>
                            <div className="shrink-0 pt-0.5"><EvidenceBadge state={m.state} /></div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ),
                )}
                <p className="mt-4 border-t border-rule pt-3 text-xs leading-relaxed text-ink-faint">
                  Quoted text is drawn from the resume on the right. Where no evidence is quoted,
                  the source did not support the requirement — that is a gap to explore in
                  interview, not a disqualification.
                </p>
              </>
            )}
          </Panel>

          {/* --- Score breakdown --- */}
          {score && (
            <Panel eyebrow="Score breakdown" title="How this number was produced">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[34rem]">
                  <thead>
                    <tr>
                      <th className="th">Dimension</th>
                      <th className="th text-right">Raw</th>
                      <th className="th text-right">Weight</th>
                      <th className="th text-right">Contributes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {score.components.map((c) => (
                      <tr key={c.dimension}>
                        <td className="td">
                          <span className="font-medium">{DIMENSION_LABEL[c.dimension] ?? c.dimension}</span>
                          <span className="block text-xs text-ink-faint">{c.detail}</span>
                        </td>
                        <td className="td tnum text-right">{c.weight === 0 ? '—' : c.raw.toFixed(0)}</td>
                        <td className="td tnum text-right">{(c.weight * 100).toFixed(1)}%</td>
                        <td className="td tnum text-right font-semibold">{c.contribution.toFixed(1)}</td>
                      </tr>
                    ))}
                    <tr>
                      <td className="td font-semibold">Total</td>
                      <td className="td" /><td className="td" />
                      <td className="td tnum text-right font-semibold">{Number(score.overall).toFixed(1)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="mt-4 text-xs leading-relaxed text-ink-faint">
                Computed by the scoring engine from evidence states and role weights. The
                language model contributes evidence and one bounded semantic signal; it does
                not produce this number.
              </p>
            </Panel>
          )}

          {/* --- Skill and experience intelligence --- */}
          {analysis && (
            <div className="grid gap-6 sm:grid-cols-2">
              <Panel eyebrow="Skills" title="Skill intelligence">
                <SkillGroup label="Matching" items={analysis.skill_intelligence?.matching ?? []} tone="yes" />
                <SkillGroup label="Missing" items={analysis.skill_intelligence?.missing ?? []} tone="no" />
                <SkillGroup label="Additional" items={analysis.skill_intelligence?.additional ?? []} tone="neutral" />
              </Panel>

              <Panel eyebrow="Experience" title="Relevance">
                {(analysis.experience_intel?.relevant_roles ?? []).length === 0
                  && (analysis.experience_intel?.relevant_projects ?? []).length === 0 ? (
                  <p className="text-sm text-ink-faint">No relevant experience identified.</p>
                ) : (
                  <>
                    {(analysis.experience_intel?.relevant_roles ?? []).map((r, i) => (
                      <RelevanceRow key={`r${i}`} title={r.role} relevance={r.relevance} why={r.why} />
                    ))}
                    {(analysis.experience_intel?.relevant_projects ?? []).map((p, i) => (
                      <RelevanceRow key={`p${i}`} title={p.name} relevance={p.relevance} why={p.why} />
                    ))}
                  </>
                )}
              </Panel>
            </div>
          )}

          {analysis && (
            <div className="grid gap-6 sm:grid-cols-2">
              <Panel eyebrow="Strengths" title="Supported by evidence">
                <Bullets items={analysis.strengths ?? []} tone="yes" empty="No strengths recorded." />
              </Panel>
              <Panel eyebrow="Concerns" title="Evidence gaps">
                <Bullets items={analysis.concerns ?? []} tone="partial" empty="No concerns recorded." />
              </Panel>
            </div>
          )}

          <InterviewKit applicationId={id} initial={(kit?.questions as never) ?? null} />
        </div>

        {/* ---------------- Right rail ---------------- */}
        <div className="space-y-6">
          <DecisionPanel
            applicationId={id}
            stage={app.stage}
            aiScore={score ? Number(score.overall) : null}
            aiCategory={score?.category ?? null}
            notes={(notes ?? []).map((n) => ({ id: n.id, body: n.body, createdAt: n.created_at }))}
            tags={(tags ?? []).map((t) => t.tag)}
          />

          <Panel eyebrow="Source" title="Original resume">
            <ResumeViewer resumeId={app.resume_id} />
          </Panel>

          <Panel eyebrow="Contact" title="Candidate details">
            <dl className="space-y-2.5 text-sm">
              <ContactRow label="Email" value={cp?.profiles?.email ?? '—'} href={`mailto:${cp?.profiles?.email}`} />
              <ContactRow label="Phone" value={cp?.phone ?? '—'} />
              <ContactRow label="Location" value={cp?.location ?? '—'} />
              <ContactRow label="Experience" value={cp?.years_experience != null ? `${cp.years_experience} years` : '—'} />
              {cp?.linkedin_url && <ContactRow label="LinkedIn" value="Profile" href={cp.linkedin_url} />}
              {cp?.portfolio_url && <ContactRow label="Portfolio" value="Link" href={cp.portfolio_url} />}
            </dl>
            {cp?.summary && (
              <p className="mt-4 border-t border-rule pt-3 text-sm leading-relaxed text-ink-soft">{cp.summary}</p>
            )}
          </Panel>

          <Panel eyebrow="History" title="Application history">
            {(events ?? []).length === 0 ? (
              <p className="text-sm text-ink-faint">No activity recorded.</p>
            ) : (
              <ul className="space-y-3">
                {(events ?? []).map((e, i) => (
                  <li key={i} className="border-l-2 border-rule pl-3">
                    <p className="text-sm">
                      {e.from_stage ? `${e.from_stage} → ${e.to_stage}` : e.to_stage ?? e.kind}
                    </p>
                    {e.note && <p className="mt-0.5 text-xs text-ink-muted">{e.note}</p>}
                    <p className="tnum mt-0.5 text-xs text-ink-faint">
                      {new Date(e.created_at).toLocaleString()}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>
    </AppShell>
  );
}

function SkillGroup({ label, items, tone }: { label: string; items: string[]; tone: 'yes' | 'no' | 'neutral' }) {
  const cls = {
    yes: 'border-evidence-yes/30 text-evidence-yes bg-evidence-yes/5',
    no: 'border-evidence-no/30 text-evidence-no bg-evidence-no/5',
    neutral: 'border-rule text-ink-muted bg-wash',
  }[tone];
  return (
    <div className="border-b border-rule py-3 first:pt-0 last:border-b-0 last:pb-0">
      <p className="eyebrow mb-2">{label}</p>
      {items.length === 0 ? <p className="text-sm text-ink-faint">None identified.</p> : (
        <div className="flex flex-wrap gap-1.5">
          {items.map((s, i) => (
            <span key={i} className={`inline-flex rounded-sharp border px-2 py-0.5 font-mono text-micro uppercase tracking-wider ${cls}`}>
              {s}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function RelevanceRow({ title, relevance, why }: { title: string; relevance: string; why: string }) {
  const colour = relevance === 'high' ? 'text-evidence-yes'
    : relevance === 'moderate' ? 'text-evidence-partial' : 'text-ink-faint';
  return (
    <div className="border-b border-rule py-2.5 last:border-b-0">
      <div className="flex flex-wrap items-baseline gap-x-3">
        <span className="text-sm font-medium">{title}</span>
        <span className={`font-mono text-micro uppercase tracking-wider ${colour}`}>{relevance}</span>
      </div>
      <p className="mt-1 text-xs leading-relaxed text-ink-muted">{why}</p>
    </div>
  );
}

function Bullets({ items, tone, empty }: { items: string[]; tone: 'yes' | 'partial'; empty: string }) {
  if (items.length === 0) return <p className="text-sm text-ink-faint">{empty}</p>;
  const dot = tone === 'yes' ? 'bg-evidence-yes' : 'bg-evidence-partial';
  return (
    <ul className="space-y-2">
      {items.map((s, i) => (
        <li key={i} className="flex gap-2.5 text-sm leading-relaxed text-ink-soft">
          <span className={`mt-1.5 h-1 w-1 shrink-0 rounded-full ${dot}`} aria-hidden />{s}
        </li>
      ))}
    </ul>
  );
}

function ContactRow({ label, value, href }: { label: string; value: string; href?: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-rule pb-2.5 last:border-b-0 last:pb-0">
      <dt className="text-ink-muted">{label}</dt>
      <dd className="text-right">
        {href ? (
          <a href={href} target="_blank" rel="noopener noreferrer" className="text-petrol-700 hover:underline">{value}</a>
        ) : value}
      </dd>
    </div>
  );
}
