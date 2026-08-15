'use client';

import { useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Panel, ScoreDial, EmptyState, ErrorState, ProcessingState, AiDisclosure } from '@/components/ui';
import type { MatchCategory } from '@/lib/scoring/engine';

interface ResumeInfo {
  id: string; fileName: string; fileSize: number; pageCount: number | null;
  status: string; extractionError: string | null; createdAt: string; excerpt: string;
}

interface Analysis {
  ats_score: number | null;
  ats: { score: number; parseability: string; findings: Array<{ area: string; severity: string; finding: string; fix: string }> };
  sections: { has_summary: boolean; has_quantified_impact: boolean; readability: string; notes: string[] };
  extracted: {
    skills: Array<{ label: string; category: string; evidence: string }>;
    experience: Array<{ company: string; title: string; duration: string | null; summary: string }>;
    education: Array<{ institution: string; degree: string | null; end_year: number | null }>;
    projects: Array<{ name: string; summary: string; tech: string[] }>;
    certifications: Array<{ name: string; issuer: string | null }>;
    years_experience: number | null;
  };
  strengths: string[];
  improvements: Array<{ area: string; recommendation: string; priority: string }>;
}

export function ResumeWorkspace({ resume, analysis }: {
  resume: ResumeInfo | null; analysis: Analysis | null; hasProfile: boolean;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  const upload = useCallback(async (file: File) => {
    setUploading(true); setError(null); setNotice(null);
    try {
      const body = new FormData();
      body.append('file', file);
      const res = await fetch('/api/resumes/upload', { method: 'POST', body });
      const json = await res.json();

      if (!res.ok) { setError(json.error ?? 'Upload failed.'); return; }
      if (json.status === 'requires_review') { setError(json.message); router.refresh(); return; }

      setNotice('Resume uploaded. Analysis is running — this page updates when it finishes.');
      // Nudge the queue so the demo does not wait for the next cron tick.
      fetch('/api/worker/drain', { method: 'POST' }).catch(() => {});
      setTimeout(() => router.refresh(), 4000);
      router.refresh();
    } catch {
      setError('The upload could not be completed. Check your connection and try again.');
    } finally {
      setUploading(false);
    }
  }, [router]);

  function onDrop(e: React.DragEvent) {
    e.preventDefault(); setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) upload(file);
  }

  return (
    <div className="space-y-6">
      <Panel eyebrow="Upload" title={resume ? 'Replace your resume' : 'Upload your resume'}>
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={`rounded-sharp border-2 border-dashed px-6 py-10 text-center transition-colors ${
            dragging ? 'border-petrol-500 bg-petrol-50' : 'border-rule bg-wash'}`}
        >
          <p className="text-sm font-medium">Drop a PDF here, or choose a file</p>
          <p className="mt-1 text-xs text-ink-muted">PDF only, up to 5 MB. Text-based exports read best — scans cannot be analysed.</p>
          <input ref={inputRef} type="file" accept="application/pdf" className="sr-only"
                 onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ''; }} />
          <button type="button" className="btn-secondary mt-4" disabled={uploading}
                  onClick={() => inputRef.current?.click()}>
            {uploading ? 'Uploading\u2026' : 'Choose file'}
          </button>
        </div>

        {error && <div className="mt-4"><ErrorState title="Upload needs attention" body={error} /></div>}
        {notice && (
          <p className="mt-4 rounded-sharp border border-petrol-500/30 bg-petrol-50 px-4 py-3 text-sm text-petrol-700">
            {notice}
          </p>
        )}
      </Panel>

      {!resume && (
        <EmptyState title="No resume yet"
                    body="Your resume drives role matching, screening and interview preparation. Upload one to get started." />
      )}

      {resume && resume.status !== 'analyzed' && (
        <Panel eyebrow="Status" title={resume.fileName}>
          {resume.status === 'requires_review' || resume.status === 'failed' ? (
            <ErrorState
              title="This resume could not be read"
              body={resume.extractionError ?? 'The text layer could not be extracted. Your file is stored safely — re-upload a text-based PDF to continue.'}
            />
          ) : (
            <ProcessingState label="Analysing your resume. This normally takes under a minute." />
          )}
          <p className="mt-4 text-xs text-ink-faint">
            Uploaded {new Date(resume.createdAt).toLocaleString()} &middot; {(resume.fileSize / 1024).toFixed(0)} KB
            {resume.pageCount ? ` · ${resume.pageCount} page${resume.pageCount === 1 ? '' : 's'}` : ''}
          </p>
        </Panel>
      )}

      {resume && resume.status === 'analyzed' && analysis && (
        <>
          <Panel eyebrow="ATS readability" title="How machines read your resume">
            <div className="grid gap-6 sm:grid-cols-[auto_1fr] sm:items-start">
              <ScoreDial value={analysis.ats_score ?? 0} category={band(analysis.ats_score ?? 0)} size="lg" />
              <div>
                <p className="text-sm leading-relaxed text-ink-soft">
                  This measures how cleanly applicant tracking systems can parse your file —
                  structure, headings, readable dates and absence of layout traps. It is
                  not a judgement of your experience.
                </p>
                <p className="mt-3 chip">Parseability: {analysis.ats.parseability.replace(/_/g, ' ')}</p>
              </div>
            </div>

            {analysis.ats.findings.length > 0 && (
              <div className="mt-6">
                <p className="eyebrow mb-2">Findings</p>
                <div className="border-t border-rule">
                  {analysis.ats.findings.map((f, i) => (
                    <div key={i} className="border-b border-rule py-3">
                      <div className="flex flex-wrap items-baseline gap-x-3">
                        <span className="text-sm font-medium">{f.area}</span>
                        <span className={`font-mono text-micro uppercase tracking-wider ${
                          f.severity === 'critical' ? 'text-evidence-no'
                          : f.severity === 'warning' ? 'text-evidence-partial' : 'text-ink-faint'}`}>
                          {f.severity}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-ink-soft">{f.finding}</p>
                      <p className="mt-1 text-sm text-ink-muted"><span className="font-medium">Fix:</span> {f.fix}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <AiDisclosure sources="your uploaded resume" />
          </Panel>

          <div className="grid gap-6 lg:grid-cols-2">
            <Panel eyebrow="Extracted" title="What was found">
              <Section label="Skills">
                {analysis.extracted.skills.length === 0 ? <Muted>No skills could be extracted with supporting evidence.</Muted> : (
                  <div className="flex flex-wrap gap-1.5">
                    {analysis.extracted.skills.map((s, i) => (
                      <span key={i} className="chip" title={s.evidence}>{s.label}</span>
                    ))}
                  </div>
                )}
              </Section>
              <Section label="Experience">
                {analysis.extracted.experience.length === 0 ? <Muted>No roles detected.</Muted> : (
                  <ul className="space-y-2">
                    {analysis.extracted.experience.map((e, i) => (
                      <li key={i} className="text-sm">
                        <span className="font-medium">{e.title}</span>
                        <span className="text-ink-muted"> — {e.company}{e.duration ? ` · ${e.duration}` : ''}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </Section>
              <Section label="Education">
                {analysis.extracted.education.length === 0 ? <Muted>No education detected.</Muted> : (
                  <ul className="space-y-1.5">
                    {analysis.extracted.education.map((e, i) => (
                      <li key={i} className="text-sm">
                        {e.degree ? `${e.degree}, ` : ''}{e.institution}
                        {e.end_year ? <span className="tnum text-ink-muted"> · {e.end_year}</span> : null}
                      </li>
                    ))}
                  </ul>
                )}
              </Section>
              <Section label="Projects">
                {analysis.extracted.projects.length === 0 ? <Muted>No projects detected.</Muted> : (
                  <ul className="space-y-2">
                    {analysis.extracted.projects.map((p, i) => (
                      <li key={i} className="text-sm">
                        <span className="font-medium">{p.name}</span>
                        {p.tech.length > 0 && <span className="text-ink-muted"> — {p.tech.join(', ')}</span>}
                      </li>
                    ))}
                  </ul>
                )}
              </Section>
            </Panel>

            <div className="space-y-6">
              <Panel eyebrow="Strengths" title="Working well">
                {analysis.strengths.length === 0 ? <Muted>No strengths recorded.</Muted> : (
                  <ul className="space-y-2">
                    {analysis.strengths.map((s, i) => (
                      <li key={i} className="flex gap-2.5 text-sm leading-relaxed text-ink-soft">
                        <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-evidence-yes" aria-hidden />{s}
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>

              <Panel eyebrow="Improvements" title="Worth changing">
                {analysis.improvements.length === 0 ? <Muted>No recommendations.</Muted> : (
                  <div className="border-t border-rule">
                    {analysis.improvements.map((im, i) => (
                      <div key={i} className="border-b border-rule py-3">
                        <div className="flex flex-wrap items-baseline gap-x-3">
                          <span className="text-sm font-medium">{im.area}</span>
                          <span className="font-mono text-micro uppercase tracking-wider text-ink-faint">{im.priority}</span>
                        </div>
                        <p className="mt-1 text-sm text-ink-soft">{im.recommendation}</p>
                      </div>
                    ))}
                  </div>
                )}
              </Panel>
            </div>
          </div>

          <RewriteTool excerpt={resume.excerpt} />
        </>
      )}
    </div>
  );
}

function RewriteTool({ excerpt }: { excerpt: string }) {
  const [text, setText] = useState('');
  const [role, setRole] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    variants: Array<{ text: string; emphasis: string }>;
    preserved_facts: string[]; warning: string | null;
  } | null>(null);
  const [copied, setCopied] = useState<number | null>(null);

  async function run() {
    setBusy(true); setError(null); setResult(null);
    try {
      const res = await fetch('/api/resumes/rewrite', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ original: text, targetRole: role || null }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? 'Suggestions could not be generated.'); return; }
      setResult(json);
    } catch {
      setError('The request could not be completed.');
    } finally { setBusy(false); }
  }

  return (
    <Panel eyebrow="Rewrite" title="Improve a section">
      <p className="text-sm text-ink-muted">
        Paste one section — a bullet, a summary, a project description. Wording is improved;
        facts are never added. If something is missing, you will be told rather than have it invented.
      </p>

      <div className="mt-4 space-y-3">
        <div>
          <label htmlFor="rw-text" className="mb-1.5 block text-sm font-medium">Section to improve</label>
          <textarea id="rw-text" rows={4} className="field font-mono text-xs" value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder={excerpt.slice(0, 120) || 'Paste a bullet or paragraph from your resume\u2026'} />
        </div>
        <div>
          <label htmlFor="rw-role" className="mb-1.5 block text-sm font-medium">
            Target role <span className="font-normal text-ink-faint">(optional)</span>
          </label>
          <input id="rw-role" className="field" value={role} onChange={(e) => setRole(e.target.value)}
                 placeholder="e.g. Backend Engineer" />
        </div>
        <button className="btn-primary" disabled={busy || text.trim().length < 20} onClick={run}>
          {busy ? 'Generating\u2026' : 'Suggest improvements'}
        </button>
      </div>

      {error && <div className="mt-4"><ErrorState title="Could not generate suggestions" body={error} /></div>}

      {result && (
        <div className="mt-6 space-y-4">
          {result.warning && (
            <div className="rounded-sharp border border-evidence-partial/30 bg-evidence-partial/5 px-4 py-3">
              <p className="text-sm font-medium text-evidence-partial">Missing detail</p>
              <p className="mt-1 text-sm text-ink-soft">{result.warning}</p>
            </div>
          )}
          {result.variants.map((v, i) => (
            <div key={i} className="panel panel-pad">
              <div className="flex items-start justify-between gap-3">
                <p className="eyebrow">{v.emphasis}</p>
                <button className="btn-ghost text-xs"
                        onClick={() => { navigator.clipboard?.writeText(v.text); setCopied(i); setTimeout(() => setCopied(null), 1500); }}>
                  {copied === i ? 'Copied' : 'Copy'}
                </button>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{v.text}</p>
            </div>
          ))}
          {result.preserved_facts.length > 0 && (
            <div>
              <p className="eyebrow mb-2">Facts carried through unchanged</p>
              <ul className="space-y-1">
                {result.preserved_facts.map((f, i) => (
                  <li key={i} className="text-xs text-ink-muted">&middot; {f}</li>
                ))}
              </ul>
            </div>
          )}
          <p className="text-xs text-ink-faint">
            Review before using. Your stored resume is unchanged — replace it above when you are ready.
          </p>
        </div>
      )}
    </Panel>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-rule py-3 first:pt-0 last:border-b-0 last:pb-0">
      <p className="eyebrow mb-2">{label}</p>
      {children}
    </div>
  );
}
function Muted({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-ink-faint">{children}</p>;
}
function band(score: number): MatchCategory {
  if (score >= 85) return 'strong';
  if (score >= 70) return 'good';
  if (score >= 50) return 'potential';
  return 'low';
}
