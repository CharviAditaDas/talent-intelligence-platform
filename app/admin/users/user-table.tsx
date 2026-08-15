'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { ErrorState } from '@/components/ui';

export interface UserRow {
  id: string; email: string; fullName: string;
  role: string; isActive: boolean; createdAt: string;
}

export function UserTable({ rows, currentUserId }: { rows: UserRow[]; currentUserId: string }) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (roleFilter && r.role !== roleFilter) return false;
      if (q && !`${r.fullName} ${r.email}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [rows, query, roleFilter]);

  async function update(id: string, patch: { isActive?: boolean; role?: string }) {
    setBusyId(id); setError(null);
    try {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? 'The account could not be updated.'); return; }
      router.refresh();
    } catch {
      setError('The account could not be updated.');
    } finally { setBusyId(null); }
  }

  return (
    <div>
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <input className="field sm:col-span-2" placeholder="Search name or email" value={query}
               onChange={(e) => setQuery(e.target.value)} aria-label="Search users" />
        <select className="field" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}
                aria-label="Filter by role">
          <option value="">All roles</option>
          <option value="candidate">Candidates</option>
          <option value="recruiter">Recruiters</option>
          <option value="admin">Administrators</option>
        </select>
      </div>

      {error && <div className="mb-4"><ErrorState title="Update failed" body={error} /></div>}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[40rem]">
          <thead>
            <tr>
              <th className="th">Name</th><th className="th">Email</th>
              <th className="th">Role</th><th className="th">Status</th><th className="th" />
            </tr>
          </thead>
          <tbody>
            {filtered.map((u) => (
              <tr key={u.id}>
                <td className="td font-medium">
                  {u.fullName || <span className="text-ink-faint">Not set</span>}
                  {u.id === currentUserId && (
                    <span className="ml-2 font-mono text-micro uppercase tracking-wider text-petrol-700">You</span>
                  )}
                </td>
                <td className="td text-ink-muted">{u.email}</td>
                <td className="td">
                  <select className="field py-1 text-xs" value={u.role} disabled={busyId === u.id}
                          onChange={(e) => update(u.id, { role: e.target.value })}
                          aria-label={`Role for ${u.email}`}>
                    <option value="candidate">Candidate</option>
                    <option value="recruiter">Recruiter</option>
                    <option value="admin">Administrator</option>
                  </select>
                </td>
                <td className="td">
                  <span className={`font-mono text-micro uppercase tracking-wider ${
                    u.isActive ? 'text-evidence-yes' : 'text-evidence-no'}`}>
                    {u.isActive ? 'Active' : 'Deactivated'}
                  </span>
                </td>
                <td className="td text-right">
                  <button className="text-sm text-petrol-700 hover:underline disabled:opacity-40"
                          disabled={busyId === u.id || u.id === currentUserId}
                          onClick={() => update(u.id, { isActive: !u.isActive })}>
                    {u.isActive ? 'Deactivate' : 'Reactivate'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {filtered.length === 0 && (
        <p className="py-8 text-center text-sm text-ink-faint">No users match those filters.</p>
      )}
    </div>
  );
}
