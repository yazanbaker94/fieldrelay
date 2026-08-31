import { FaAws } from 'react-icons/fa';
import { SiNodedotjs, SiPostgresql, SiReact, SiTypescript } from 'react-icons/si';

const technologies = [
  { label: 'React', icon: SiReact },
  { label: 'React Native', icon: SiReact },
  { label: 'TypeScript', icon: SiTypescript },
  { label: 'Node.js', icon: SiNodedotjs },
  { label: 'PostgreSQL', icon: SiPostgresql },
  { label: 'AWS queues', icon: FaAws },
];

export function TechnologyRail() {
  return <div className="technology-rail" aria-label="Technology stack">{technologies.map(({ label, icon: Icon }) => <div key={label}><Icon aria-hidden="true" /><span>{label}</span></div>)}</div>;
}
