import { ConsoleShell } from '@/components/fieldrelay/console-shell';
import { DeliveryForensics } from '@/components/fieldrelay/delivery-forensics';

export default function IntegrationDeliveryPage() {
  return <ConsoleShell active="integrations" eyebrow="Integration delivery" title="DL / 019" recordId="FR / 2026 / 0842"><DeliveryForensics /></ConsoleShell>;
}
