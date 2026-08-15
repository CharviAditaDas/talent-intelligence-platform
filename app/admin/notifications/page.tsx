import { NotificationsPage } from '@/components/notifications-page';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Notifications' };

export default function Page() {
  return <NotificationsPage roles={['admin']} />;
}
