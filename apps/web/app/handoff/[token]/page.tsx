import { PrototypeDisclaimer, PublicHeader } from '@/components/fieldrelay/public-header';
import { ReceiverHandoff } from '@/components/fieldrelay/receiver-handoff';

export default function HandoffPage() { return <main className="public-inner"><PublicHeader /><div className="handoff-shell"><ReceiverHandoff /></div><PrototypeDisclaimer /></main>; }
