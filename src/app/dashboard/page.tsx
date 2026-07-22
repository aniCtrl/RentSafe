import AppShell from '@/components/app/AppShell';
import DashboardOverview from '@/components/dashboard/DashboardOverview';

export default function DashboardPage() {
  return (
    <AppShell title="Rental Portal">
      <DashboardOverview />
    </AppShell>
  );
}
