import AppShell from '@/components/app/AppShell';
import InspectEscrowView from '@/components/dashboard/InspectEscrowView';

type InspectEscrowPageProps = {
  params: Promise<{
    agreementId: string;
  }>;
};

export default async function InspectEscrowPage({ params }: InspectEscrowPageProps) {
  const { agreementId } = await params;

  return (
    <AppShell title="Inspect Agreement">
      <InspectEscrowView agreementId={agreementId} />
    </AppShell>
  );
}
