import { ConsoleShell } from '@/components/fieldrelay/console-shell';
import { DeliveryForensics } from '@/components/fieldrelay/delivery-forensics';

export default async function IntegrationDeliveryPage({
  params,
}: {
  params: Promise<{ deliveryId: string }>;
}) {
  const { deliveryId } = await params;
  return <ConsoleShell active="integrations" eyebrow="Integration delivery" title={deliveryId.replaceAll('-', ' / ')} recordId="LIVE / FORENSICS"><DeliveryForensics deliveryId={deliveryId} /></ConsoleShell>;
}
