import { Compass } from 'lucide-react';
import { usePage } from '../components/layout/page';
import { ButtonLink, EmptyState } from '../components/ui';

export default function NotFound() {
  usePage('Not found');
  return (
    <div className="page">
      <EmptyState icon={<Compass />} title="This page does not exist" action={<ButtonLink to="/">Back to the dashboard</ButtonLink>}>
        Try the search (⌘K) — it covers lessons, exercises, datasets, variables and reference entries.
      </EmptyState>
    </div>
  );
}
