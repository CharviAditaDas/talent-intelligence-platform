export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-7xl px-5 py-8">
      <div className="mb-8 space-y-3">
        <div className="h-3 w-24 animate-pulse rounded-sharp bg-rule/60" />
        <div className="h-7 w-64 animate-pulse rounded-sharp bg-rule/60" />
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-40 animate-pulse rounded-sharp bg-rule/40" />
        ))}
      </div>
      <span className="sr-only" role="status">Loading</span>
    </div>
  );
}
