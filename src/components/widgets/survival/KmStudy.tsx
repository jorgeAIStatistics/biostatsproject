import type { WidgetProps } from '../registry';
import TlfWidget from '../cdisc/TlfWidget';

/** Kaplan–Meier curves for the flagship study (wraps the TLF engine). */
export default function KmStudy({ props }: WidgetProps) {
  const id = (props.endpoint ?? 'PFS').toUpperCase() === 'OS' ? 'f-km-os' : 'f-km-pfs';
  return <TlfWidget props={{ id }} />;
}
