/**
 * Widget registry: maps `::widget{name="…"}` to lazily loaded React components.
 * The list of valid names and their documented props lives in
 * src/content/widgets.ts (validated at authoring time).
 */
import { lazy, type ComponentType, type LazyExoticComponent } from 'react';
import { Sparkles } from 'lucide-react';
import { WIDGETS } from '../../content/widgets';
import './widgets.css';

export type WidgetProps = { props: Record<string, string> };
type Loader = LazyExoticComponent<ComponentType<WidgetProps>>;

const registry: Record<string, Loader> = {
  'pdv-stepper': lazy(() => import('./PdvStepper')),
  'lifecycle-map': lazy(() => import('./LifecycleMap')),
  'join-visualizer': lazy(() => import('./JoinVisualizer')),
  'randomization-simulator': lazy(() => import('./trials/RandomizationSimulator')),
  't-distribution': lazy(() => import('./stats/TDistribution')),
  'sampling-distribution': lazy(() => import('./stats/SamplingDistribution')),
  'ci-coverage': lazy(() => import('./stats/CiCoverage')),
  'power-calculator': lazy(() => import('./stats/PowerCalculator')),
  'study-day-calculator': lazy(() => import('./cdisc/StudyDayCalculator')),
  'km-hand-calculation': lazy(() => import('./survival/KmHandCalculation')),
  'regression-diagnostics': lazy(() => import('./stats/RegressionDiagnostics')),
  'logistic-explorer': lazy(() => import('./stats/LogisticExplorer')),
  'sdtm-explorer': lazy(() => import('./cdisc/SdtmExplorer')),
  'excel-grid': lazy(() => import('./excel/ExcelGrid')),
  tlf: lazy(() => import('./cdisc/TlfWidget')),
  'trace-value': lazy(() => import('./cdisc/TraceValue')),
  'km-study': lazy(() => import('./survival/KmStudy')),
  'forest-plot': lazy(() => import('./survival/ForestPlotWidget')),
  'waterfall-plot': lazy(() => import('./survival/WaterfallPlot')),
  'denominator-explorer': lazy(() => import('./cdisc/DenominatorExplorer')),
  'pca-geometry': lazy(() => import('./analytics/PcaGeometry')),
  'ph-diagnostics': lazy(() => import('./survival/PhDiagnostics')),
  'multiplicity-simulator': lazy(() => import('./trials/MultiplicitySimulator')),
  'missing-data-simulator': lazy(() => import('./trials/MissingDataSimulator')),
};

export function WidgetHost({ name, props }: { name?: string; props: Record<string, string> }) {
  const spec = WIDGETS.find((w) => w.name === name);
  const Comp = name ? registry[name] : undefined;
  if (!spec || !Comp) {
    return (
      <div className="widget widget--missing">
        <Sparkles size={16} />
        <span>Unknown interactive “{name}”.</span>
      </div>
    );
  }
  return (
    <section className="widget" aria-label={spec.title}>
      <header className="widget__head">
        <Sparkles size={14} />
        <span className="widget__kicker">Interactive</span>
        <span className="widget__title">{spec.title}</span>
      </header>
      <div className="widget__body">
        <Comp props={props} />
      </div>
    </section>
  );
}
