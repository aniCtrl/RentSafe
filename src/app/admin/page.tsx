import AppShell from '@/components/app/AppShell';
import AdminPanelView from '@/components/dashboard/AdminPanelView';

export default function AdminPage() {
  return (
    <AppShell title="Admin Arbitration Panel">
      <AdminPanelView />
    </AppShell>
  );
}
