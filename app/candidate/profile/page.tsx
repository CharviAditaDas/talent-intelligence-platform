import { requirePage } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';
import { AppShell, PageHead } from '@/components/app-shell';
import { ProfileForm } from './profile-form';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Profile' };

export default async function ProfilePage() {
  const user = await requirePage('candidate');
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from('candidate_profiles')
    .select('id, phone, location, headline, summary, linkedin_url, portfolio_url, years_experience, completeness')
    .eq('user_id', user.id).single();

  return (
    <AppShell user={user}>
      <PageHead
        eyebrow="Profile"
        title="Professional profile"
        description="This sits alongside your resume during assessment. A fuller profile means fewer findings of insufficient evidence."
      />
      <ProfileForm
        initial={{
          fullName: user.fullName,
          phone: profile?.phone ?? '',
          location: profile?.location ?? '',
          headline: profile?.headline ?? '',
          summary: profile?.summary ?? '',
          linkedinUrl: profile?.linkedin_url ?? '',
          portfolioUrl: profile?.portfolio_url ?? '',
          yearsExperience: profile?.years_experience ?? null,
        }}
        completeness={profile?.completeness ?? 0}
      />
    </AppShell>
  );
}
