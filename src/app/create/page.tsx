import AppShell from '@/components/app/AppShell';
import CreateAgreementView from '@/components/dashboard/CreateAgreementView';

export default function CreateAgreementPage() {
  return (
    <AppShell title="Create Rental Agreement">
      <CreateAgreementView />
    </AppShell>
  );
}
