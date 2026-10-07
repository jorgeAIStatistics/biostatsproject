/** Catalogue of outputs that the TLF engine can compute from the ADaM datasets. */
export interface TlfSpec {
  id: string;
  number: string;
  kind: 'table' | 'figure' | 'listing';
  title: string;
  population: string;
  /** Shell id in the SAP/shells document, when one exists. */
  shell?: string;
}

export const TLF_CATALOGUE: TlfSpec[] = [
  { id: 't-demog', number: '14.1.2', kind: 'table', title: 'Demographic and baseline characteristics', population: 'Intent-to-treat population' },
  { id: 't-disp', number: '14.1.1', kind: 'table', title: 'Subject disposition', population: 'All screened subjects' },
  { id: 't-exposure', number: '14.3.0', kind: 'table', title: 'Extent of exposure', population: 'Safety population' },
  { id: 't-ae-overview', number: '14.3.1.1', kind: 'table', title: 'Overview of treatment-emergent adverse events', population: 'Safety population' },
  { id: 't-ae-soc-pt', number: '14.3.1.2', kind: 'table', title: 'TEAEs by system organ class and preferred term', population: 'Safety population' },
  { id: 't-ae-grade3', number: '14.3.1.3', kind: 'table', title: 'Grade ≥3 TEAEs by preferred term', population: 'Safety population' },
  { id: 't-sae', number: '14.3.1.4', kind: 'table', title: 'Serious TEAEs by preferred term', population: 'Safety population' },
  { id: 't-lab-chg', number: '14.3.4.1', kind: 'table', title: 'Laboratory values and change from baseline by visit', population: 'Safety population' },
  { id: 't-lab-shift', number: '14.3.4.2', kind: 'table', title: 'Shift from baseline to worst post-baseline CTCAE grade', population: 'Safety population' },
  { id: 't-orr', number: '14.2.3', kind: 'table', title: 'Best overall response and objective response rate', population: 'Intent-to-treat population' },
  { id: 't-pfs', number: '14.2.1', kind: 'table', title: 'Progression-free survival', population: 'Intent-to-treat population' },
  { id: 't-os', number: '14.2.2', kind: 'table', title: 'Overall survival', population: 'Intent-to-treat population' },
  { id: 'f-km-pfs', number: '14.2.1.1', kind: 'figure', title: 'Kaplan–Meier plot of progression-free survival', population: 'Intent-to-treat population' },
  { id: 'f-km-os', number: '14.2.2.1', kind: 'figure', title: 'Kaplan–Meier plot of overall survival', population: 'Intent-to-treat population' },
  { id: 'f-forest-pfs', number: '14.2.1.2', kind: 'figure', title: 'Forest plot of PFS hazard ratio by subgroup', population: 'Intent-to-treat population' },
  { id: 'f-waterfall', number: '14.2.3.1', kind: 'figure', title: 'Best percentage change from baseline in tumor size', population: 'ITT subjects with measurable disease' },
  { id: 'l-sae', number: '16.2.7', kind: 'listing', title: 'Listing of serious adverse events', population: 'Safety population' },
  { id: 'l-deaths', number: '16.2.8', kind: 'listing', title: 'Listing of deaths', population: 'All randomized subjects' },
];

export const TLF_BY_ID = new Map(TLF_CATALOGUE.map((t) => [t.id, t]));
