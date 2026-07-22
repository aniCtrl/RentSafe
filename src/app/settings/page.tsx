import AppShell from '@/components/app/AppShell';
import SettingsView from '@/components/dashboard/SettingsView';

export default function SettingsPage() {
  return (
    <AppShell title="User Settings">
      <SettingsView />
    </AppShell>
  );
}
