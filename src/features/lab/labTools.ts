import type { LabId } from '../../content/vocab';

export interface LabTool {
  label: string;
  description: string;
  to: string;
}

/** Interactive environments linked from each lab's overview page. */
export const LAB_TOOLS: Partial<Record<LabId, LabTool[]>> = {
  trials: [
    { label: 'Trial simulator', description: 'Walk CBX417-301 from protocol to CSR.', to: '/trial' },
    { label: 'Study documents', description: 'Protocol synopsis, CRF, SAP, shells, specs.', to: '/documents' },
  ],
  sas: [
    { label: 'SAS log trainer', description: 'Read real-looking logs and flag every problem.', to: '/practice?lab=sas&format=log&count=10&title=SAS%20log%20trainer' },
    { label: 'Find the bug', description: 'Click the defective line in SAS programs.', to: '/practice?lab=sas&format=hotspot&count=8&title=SAS%20debugging' },
    { label: 'SAS ↔ R ↔ Python crosswalk', description: 'Same task, semantic differences explained.', to: '/crosswalk' },
  ],
  cdisc: [
    { label: 'SDTM domain explorer', description: 'Domains, keys and relationships.', to: '/trial/sdtm' },
    { label: 'Trace this value', description: 'TLF cell → ADaM → SDTM → raw CRF row.', to: '/trial/trace' },
    { label: 'Dataset viewer', description: 'Raw, SDTM and ADaM datasets with metadata.', to: '/data' },
  ],
  tlf: [
    { label: 'TLF gallery', description: 'Outputs computed live from ADaM, with traceable cells.', to: '/trial/tlf' },
    { label: 'Table shells', description: 'Mock shells from the SAP.', to: '/documents/tlf-shells' },
  ],
  stats: [
    { label: 'Kaplan–Meier by hand', description: 'Build the KM estimate step by step.', to: '/trial/survival' },
    { label: 'MS Companion', description: 'Academic vs industry view of each course topic.', to: '/companion' },
  ],
  r: [{ label: 'Code crosswalk', description: 'SAS ↔ R translations with semantic notes.', to: '/crosswalk' }],
  python: [{ label: 'Code crosswalk', description: 'pandas vs SAS/R/SQL semantics.', to: '/crosswalk' }],
  sql: [
    { label: 'SQL workbench', description: 'Query the study databases live in your browser.', to: '/sql' },
    { label: 'SQL drills', description: 'Graded queries on clinical tables.', to: '/practice?lab=sql&count=10&title=SQL%20drills' },
  ],
  excel: [{ label: 'Spreadsheet sandbox', description: 'Practice formulas on realistic sheets.', to: '/practice?lab=excel&count=8' }],
  analytics: [
    { label: 'Manufacturing datasets', description: 'Batches, sensors, spectra, messy exports.', to: '/data' },
  ],
  qc: [
    { label: 'QC comparisons', description: 'Two outputs disagree — find out why.', to: '/practice?mode=qc&count=8&title=QC%20comparisons' },
    { label: 'AI code review', description: 'Spot subtle errors in generated code.', to: '/practice?tag=ai-review&count=8&title=AI%20code%20review' },
  ],
  git: [{ label: 'Portfolio builder', description: 'Turn capstones into credible repositories.', to: '/portfolio' }],
};
