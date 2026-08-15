/**
 * Candidate-facing application progression (§32).
 * Shows only the candidate's own trajectory — never other applicants,
 * recruiter notes, internal ranking, or the reason for a transition.
 */
export const STAGE_ORDER = [
  'submitted', 'ai_screening', 'under_review', 'shortlisted',
  'interview_1', 'interview_2', 'final_evaluation', 'offer',
] as const;

export const STAGE_LABEL: Record<string, string> = {
  submitted: 'Application submitted',
  ai_screening: 'Screening complete',
  under_review: 'Under review',
  shortlisted: 'Shortlisted',
  interview_1: 'First interview',
  interview_2: 'Second interview',
  final_evaluation: 'Final evaluation',
  offer: 'Offer',
  hired: 'Hired',
  rejected: 'Not progressing',
};

export function StageTracker({ stage }: { stage: string }) {
  if (stage === 'rejected') {
    return (
      <div className="rounded-sharp border border-rule bg-wash px-4 py-3">
        <p className="text-sm font-medium">This application is closed</p>
        <p className="mt-1 text-sm text-ink-muted">
          The team is not progressing with this application. Your profile and other
          applications are unaffected.
        </p>
      </div>
    );
  }

  const terminalHired = stage === 'hired';
  const currentIndex = terminalHired
    ? STAGE_ORDER.length - 1
    : STAGE_ORDER.indexOf(stage as (typeof STAGE_ORDER)[number]);

  return (
    <ol className="relative">
      {STAGE_ORDER.map((s, i) => {
        const done = i < currentIndex || terminalHired;
        const current = i === currentIndex && !terminalHired;
        return (
          <li key={s} className="relative flex gap-4 pb-5 last:pb-0">
            {i < STAGE_ORDER.length - 1 && (
              <span aria-hidden
                    className={`absolute left-[7px] top-4 h-full w-px ${done ? 'bg-petrol-700' : 'bg-rule'}`} />
            )}
            <span aria-hidden
                  className={`relative mt-1 h-[15px] w-[15px] shrink-0 rounded-full border-2 ${
                    done ? 'border-petrol-700 bg-petrol-700'
                    : current ? 'border-petrol-700 bg-paper'
                    : 'border-rule bg-paper'}`} />
            <div className="min-w-0 pt-0.5">
              <p className={`text-sm ${current ? 'font-semibold' : done ? 'font-medium' : 'text-ink-faint'}`}>
                {STAGE_LABEL[s]}
              </p>
              {current && <p className="mt-0.5 text-xs text-petrol-700">Current stage</p>}
            </div>
          </li>
        );
      })}
      {terminalHired && (
        <li className="flex gap-4">
          <span aria-hidden className="mt-1 h-[15px] w-[15px] shrink-0 rounded-full border-2 border-evidence-yes bg-evidence-yes" />
          <p className="pt-0.5 text-sm font-semibold text-evidence-yes">Hired</p>
        </li>
      )}
    </ol>
  );
}
