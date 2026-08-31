import { GuidedDemo } from '@/components/fieldrelay/guided-demo';
import { PrototypeDisclaimer, PublicHeader } from '@/components/fieldrelay/public-header';

export default function DemoPage() {
  return <main className="public-inner"><PublicHeader /><GuidedDemo /><PrototypeDisclaimer /></main>;
}
