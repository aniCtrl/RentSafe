import AppShell from '@/components/app/AppShell';
import AnalyticsView from '@/components/dashboard/AnalyticsView';

export default function AnalyticsPage() {
  return (
    <AppShell title="Platform Analytics">
      <AnalyticsView />
    </AppShell>
  );
}
