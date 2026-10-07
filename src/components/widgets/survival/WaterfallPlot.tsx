import type { WidgetProps } from '../registry';
import TlfWidget from '../cdisc/TlfWidget';

/** Best percentage change from baseline in tumour size. */
export default function WaterfallPlot(_: WidgetProps) {
  void _;
  return <TlfWidget props={{ id: 'f-waterfall' }} />;
}
