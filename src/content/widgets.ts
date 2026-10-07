/**
 * Interactive widget contract.
 *
 * Lessons embed widgets with `::widget{name="km-hand-calculation"}`. The
 * validator only accepts names listed here; the React implementations live in
 * src/components/widgets/ and are registered in src/components/widgets/registry.tsx.
 * Props are passed as strings from the directive attributes.
 */
export interface WidgetSpec {
  name: string;
  title: string;
  description: string;
  props?: Record<string, string>;
}

export const WIDGETS: readonly WidgetSpec[] = [
  {
    name: 'lifecycle-map',
    title: 'Clinical data lifecycle',
    description: 'Clickable map PROTOCOL → CRF → RAW → DM → SDTM → ADaM → Analysis → TLF → QC → CSR → Ad hoc, with the artifacts and roles at each stage.',
    props: { highlight: 'optional stage id to emphasise: protocol|crf|raw|dm|sdtm|adam|analysis|tlf|qc|csr|adhoc' },
  },
  {
    name: 'pdv-stepper',
    title: 'Program Data Vector stepper',
    description: 'Steps through a small SAS DATA step one statement at a time, showing the PDV, _N_, _ERROR_, FIRST./LAST. flags and the output dataset.',
    props: { example: 'basic | retain | sum | first-last | merge | lag' },
  },
  {
    name: 'join-visualizer',
    title: 'Join / MERGE visualizer',
    description: 'Shows how SAS MERGE and SQL joins combine two small tables, including one-to-many and many-to-many behaviour and IN= flags.',
    props: { engine: 'merge | sql', case: 'one-to-one | one-to-many | many-to-many | non-matching' },
  },
  {
    name: 'sampling-distribution',
    title: 'Sampling distribution simulator',
    description: 'Draws repeated samples from a skewed population and builds the sampling distribution of the mean; shows SE = σ/√n.',
  },
  {
    name: 'ci-coverage',
    title: 'Confidence-interval coverage',
    description: 'Simulates 100 trials and shows which 95% CIs contain the true value — the frequentist meaning of confidence.',
  },
  {
    name: 'power-calculator',
    title: 'Power & sample size',
    description: 'Interactive power/sample-size calculator for two means, two proportions, or a time-to-event endpoint (Schoenfeld events).',
    props: { endpoint: 'means | proportions | survival' },
  },
  {
    name: 't-distribution',
    title: 't vs normal',
    description: 'Compares the t distribution with different degrees of freedom against the standard normal; shows critical values.',
  },
  {
    name: 'regression-diagnostics',
    title: 'Regression diagnostics lab',
    description: 'Drag points to create outliers/high leverage; watch the fit, residual plots, Q–Q plot, Cook’s distance and R² respond.',
  },
  {
    name: 'logistic-explorer',
    title: 'Logistic regression explorer',
    description: 'Adjust β0/β1 and see probabilities, odds and log-odds; relates the odds ratio to a one-unit change.',
  },
  {
    name: 'km-hand-calculation',
    title: 'Kaplan–Meier by hand',
    description: 'A 12-subject dataset: step through each event time, update the risk set, and watch the KM curve and Greenwood SE build.',
  },
  {
    name: 'km-study',
    title: 'CBX-417 Kaplan–Meier curves',
    description: 'KM curves by arm for the flagship oncology study with number-at-risk table, censor marks, median and HR summary.',
    props: { endpoint: 'PFS | OS' },
  },
  {
    name: 'forest-plot',
    title: 'Subgroup forest plot',
    description: 'Hazard ratios with 95% CIs by subgroup for the oncology study, with caution about subgroup interpretation.',
    props: { endpoint: 'PFS | OS' },
  },
  {
    name: 'ph-diagnostics',
    title: 'Proportional-hazards diagnostics',
    description: 'log(−log S(t)) vs log t plot and a scaled Schoenfeld residual trend for the oncology PFS model.',
  },
  {
    name: 'pca-geometry',
    title: 'PCA geometry',
    description: '2-D point cloud: rotate a candidate axis and watch projected variance; snap to PC1/PC2 to see what PCA maximizes.',
  },
  {
    name: 'pca-explorer',
    title: 'PCA explorer (manufacturing)',
    description: 'Scree plot, scores and loadings for the manufacturing process dataset; select a component to highlight contributing variables.',
  },
  {
    name: 'sdtm-explorer',
    title: 'SDTM domain relationship explorer',
    description: 'Interactive map of DM, AE, CM, MH, EX, LB, VS, EG, DS, DV, RS, TR, SUPPQUAL and their keys/relationships.',
  },
  {
    name: 'trace-value',
    title: 'Trace this value',
    description: 'Click a number in a table and follow it back: TLF cell → analysis records → ADaM variables → SDTM records → raw CRF rows.',
    props: { tlf: 'demog | ae-soc-pt | lab-chg | pfs-summary' },
  },
  {
    name: 'tlf',
    title: 'TLF output',
    description: 'Renders a table, listing or figure computed live from the ADaM datasets (with traceable cells).',
    props: { id: 'TLF id from the TLF catalogue, e.g. t-demog, t-ae-overview, t-ae-soc-pt, t-lab-chg, t-lab-shift, t-pfs, f-km-pfs' },
  },
  {
    name: 'randomization-simulator',
    title: 'Randomization simulator',
    description: 'Simple vs permuted-block vs stratified randomization; shows imbalance and predictability.',
  },
  {
    name: 'multiplicity-simulator',
    title: 'Multiplicity simulator',
    description: 'Shows family-wise error inflation with k tests and how Bonferroni, Holm and fixed-sequence testing control it.',
  },
  {
    name: 'missing-data-simulator',
    title: 'Missing-data mechanisms',
    description: 'Generates MCAR, MAR and MNAR dropout in a longitudinal trial and shows bias of complete-case vs model-based estimates.',
  },
  {
    name: 'study-day-calculator',
    title: 'ISO 8601 & study day calculator',
    description: 'Parse full/partial ISO 8601 dates and compute --DY relative to RFSTDTC (no day 0), with SAS/R/Python equivalents.',
  },
  {
    name: 'excel-grid',
    title: 'Spreadsheet sandbox',
    description: 'A small spreadsheet with a formula bar that evaluates a practical subset of Excel functions (SUMIFS, COUNTIFS, XLOOKUP, INDEX/MATCH, IF/IFS, text & date functions).',
    props: { sheet: 'sheet id defined in content/excel/*.yaml (SheetFileSchema); only functions in EXCEL_FUNCTIONS are supported' },
  },
  {
    name: 'control-chart',
    title: 'Control chart',
    description: 'Individuals / moving-range chart of batch potency with Western Electric rule violations highlighted.',
  },
  {
    name: 'cv-leakage',
    title: 'Cross-validation leakage demo',
    description: 'Compares row-level vs batch-grouped cross-validation on repeated-measurement process data; shows optimistic error from leakage.',
  },
  {
    name: 'denominator-explorer',
    title: 'Denominator explorer',
    description: 'Same AE data, different denominators (subjects vs events, safety vs ITT population) — see how the percentages change.',
  },
  {
    name: 'waterfall-plot',
    title: 'Waterfall plot',
    description: 'Best percentage change from baseline in tumor size (sum of diameters) per subject, colored by best overall response.',
  },
  {
    name: 'correlation-heatmap',
    title: 'Correlation heatmap',
    description: 'Correlation matrix of manufacturing process variables; hover for pairwise scatter, highlights multicollinearity.',
  },
  {
    name: 'spectra-viewer',
    title: 'Spectra viewer',
    description: 'Overlay of NIR-like spectra by batch/potency, with raw vs standard-normal-variate (SNV) preprocessing.',
  },
] as const;

export const WIDGET_NAMES = WIDGETS.map((w) => w.name);
