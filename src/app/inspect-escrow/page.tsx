import AppShell from '@/components/app/AppShell';
import InspectEscrowView from '@/components/dashboard/InspectEscrowView';

export default function InspectEscrowIndexPage() {
  return (
    <AppShell title="Inspect Agreement">
      <InspectEscrowView />
    </AppShell>
  );
}
