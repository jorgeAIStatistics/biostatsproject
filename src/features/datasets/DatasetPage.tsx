import { useParams } from 'react-router';
import { usePage } from '../../components/layout/page';
import { DatasetViewer } from '../../components/data/DatasetViewer';

export default function DatasetPage() {
  const params = useParams();
  const id = params['*'] ?? '';
  const name = id.split('/').pop()?.toUpperCase() ?? 'Dataset';
  usePage(name, [{ label: 'Datasets', to: '/data' }, { label: id.split('/').slice(0, 2).join(' / ') }], 'dataset');
  return (
    <div className="page page--wide">
      <DatasetViewer id={id} />
    </div>
  );
}
