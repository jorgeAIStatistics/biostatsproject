import type { WidgetProps } from '../registry';
import TlfWidget from '../cdisc/TlfWidget';

/** Subgroup forest plot for the flagship study. */
export default function ForestPlotWidget(_: WidgetProps) {
  void _;
  return <TlfWidget props={{ id: 'f-forest-pfs' }} />;
}
