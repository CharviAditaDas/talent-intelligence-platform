import Link from 'next/link';

export function Wordmark({ tone = 'dark' }: { tone?: 'dark' | 'light' }) {
  const ink = tone === 'dark' ? 'text-ink' : 'text-white';
  const accent = tone === 'dark' ? 'text-petrol-700' : 'text-petrol-300';
  return (
    <Link href="/" className={`inline-flex items-baseline gap-2 ${ink}`}>
      <span className="font-mono text-micro uppercase tracking-[0.2em]">Evidence</span>
      <span className="text-base font-semibold tracking-tight">
        Talent Intelligence<span className={accent}>.</span>
      </span>
    </Link>
  );
}

export function PublicHeader() {
  return (
    <header className="border-b border-rule bg-paper">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-5 py-4">
        <Wordmark />
        <nav className="flex items-center gap-1 sm:gap-3">
          <Link href="/jobs" className="btn-ghost">Open roles</Link>
          <Link href="/login" className="btn-primary">Sign in</Link>
        </nav>
      </div>
    </header>
  );
}

export function PublicFooter() {
  return (
    <footer className="border-t border-rule bg-paper">
      <div className="mx-auto max-w-6xl px-5 py-8">
        <p className="max-w-3xl text-xs leading-relaxed text-ink-faint">
          This platform produces decision support, not decisions. Assessments are
          generated from candidate-supplied resumes and profiles against a
          published job specification, and every finding is traceable to its
          source. Scores are computed by a fixed scoring model, not by a language
          model. Recruiters remain responsible for all hiring outcomes.
        </p>
      </div>
    </footer>
  );
}
