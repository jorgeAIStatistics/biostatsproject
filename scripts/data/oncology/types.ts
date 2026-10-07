/**
 * The "true" study: what really happened to each synthetic subject. Raw EDC /
 * vendor exports are rendered from it (with injected problems) and SDTM is
 * built from it (i.e., from the corrected data). Dates are day numbers.
 */
import type { PartialDate } from './dates.ts';
import type { ArmCd, Site } from './config.ts';

export type Resp = 'CR' | 'PR' | 'SD' | 'PD' | 'NE';

export interface TScan {
  visitName: string; // SDTM VISIT, e.g. "WEEK 12", "SCREENING", "UNSCHEDULED"
  visitNum: number;
  week: number | null; // nominal week (null for baseline / unscheduled)
  date: number;
  method: 'CT SCAN' | 'MRI';
  sld: number | null; // mm; null when not evaluable
  nt: 'NON-CR/NON-PD' | 'CR' | 'PD' | 'NE' | null; // non-target response (null at baseline)
  newLesion: 'Y' | 'N' | null;
  resp: Resp | null; // overall response (null at baseline)
  baseline: boolean;
  outOfWindow: boolean;
}

export interface TAe {
  pt: string;
  soc: string;
  verbatim: string;
  start: number;
  /** Start date as collected, when incomplete. */
  startPartial?: PartialDate;
  end: number | null;
  endPartial?: PartialDate;
  grade: 1 | 2 | 3 | 4 | 5;
  serious: boolean;
  sdth: boolean;
  slife: boolean;
  shosp: boolean;
  sdisab: boolean;
  scong: boolean;
  smie: boolean;
  relCbx: 'Y' | 'N' | null;
  relDoc: 'Y' | 'N' | null;
  acnCbx: string;
  acnDoc: string;
  outcome: string;
  phase: 'pre' | 'on' | 'post';
  cycle: number | null;
  /** internal: duration used before capping */
  dur: number;
  /** internal: the event is still ongoing at the subject's last contact */
  ongoingPref?: boolean;
}

export interface TExCbx {
  cycle: number;
  kit: string;
  content: 'CBX-417' | 'PLACEBO';
  start: number;
  end: number;
  dose: number;
  reason: string | null;
  time: number | null; // first dose time (cycle 1 only)
}

export interface TExDoc {
  cycle: number;
  date: number;
  time: number;
  bsa: number;
  level: number;
  doseMg: number;
  reason: string | null;
}

export interface TLab {
  visitName: string; // SDTM VISIT
  visitNum: number;
  unscheduled: boolean;
  date: number;
  time: number;
  code: string;
  local: boolean;
  /** Original result as reported (local labs may use conventional units). */
  orig: string;
  origUnit: string;
  origLo: string;
  origHi: string;
  /** Standardized (SI) numeric result, reference range. */
  std: number;
  stdLo: number;
  stdHi: number;
  accession: string;
  /** true = test not done for this sample (missing baseline issue) */
  notDone?: boolean;
}

export interface TVitals {
  visitName: string;
  visitNum: number;
  date: number;
  time: number;
  sysbp: number;
  diabp: number;
  pulse: number;
  temp: number;
  weight: number;
  height: number | null;
  ecog: number | null;
  /** Collected in F / lb at some US sites (original values; standardized values above). */
  tempF?: number;
  weightLb?: number;
}

export interface TEcg {
  visitName: string;
  visitNum: number;
  date: number;
  time: number;
  qtcf: number;
  hr: number;
  interp: string;
}

export interface TContact {
  n: number;
  date: number;
  status: 'Alive' | 'Dead' | 'Lost to follow-up';
  newTherapy: 'Y' | 'N';
  therapyName: string | null;
  therapyStart: number | null;
}

export interface TCm {
  name: string;
  verbatim: string;
  indication: string;
  dose: number | null;
  unit: string | null;
  route: string;
  freq: string | null;
  start: PartialDate;
  end: PartialDate | null;
  ongoing: boolean;
  category: 'PRIOR CANCER THERAPY' | 'CONCOMITANT' | 'SUBSEQUENT ANTICANCER THERAPY';
}

export interface TMh {
  verbatim: string;
  pt: string;
  soc: string;
  start: PartialDate;
  ongoing: boolean;
  /** Site recorded this history item on the AE page (resolved by query → MH). */
  enteredOnAePage?: boolean;
}

export interface TDv {
  category: string;
  description: string;
  date: number;
  severity: 'Major' | 'Minor';
}

export interface TSubject {
  idx: number;
  site: Site;
  subjid: string;
  usubjid: string;
  consent: number;
  screenDate: number;
  // demographics
  age: number;
  birthYear: number;
  sex: 'M' | 'F';
  races: string[];
  raceOtherSp: string | null;
  ethnic: 'HISPANIC OR LATINO' | 'NOT HISPANIC OR LATINO' | 'NOT REPORTED';
  heightCm: number;
  weightKg: number;
  // baseline disease
  histology: string;
  histol: 'SQUAMOUS' | 'NON-SQUAMOUS';
  stage: string;
  diagDate: PartialDate;
  diagDay: number;
  pdl1: number;
  priorLines: number;
  priorIO: boolean;
  brainMets: boolean;
  smoking: 'CURRENT' | 'FORMER' | 'NEVER';
  ecog: number;
  baselineSld: number;
  // screening outcome
  screenFail: boolean;
  sfReason: string | null;
  sfDate: number | null;
  // randomization (null for screen failures)
  randDate: number | null;
  randNo: string | null;
  arm: ArmCd | null;
  stratEcog: number | null;
  stratIO: boolean | null;
  misStrat: string | null;
  // treatment
  treated: boolean;
  neverTreatedReason: string | null;
  actualArm: ArmCd | null;
  unplanned: string | null; // ACTARMUD text when actual treatment was unplanned
  dispensingError: string | null;
  exCbx: TExCbx[];
  exDoc: TExDoc[];
  firstDose: number | null;
  firstDoseTime: number | null;
  lastDose: number | null;
  eotReason: string | null; // NCOMPLT term; null = ongoing at DCO / never treated
  eotReasonText: string | null;
  eotDate: number | null; // EOT visit date
  cycleStarts: number[];
  // efficacy truth
  tProg: number; // days from randomization to true progression
  pdDate: number | null; // documented PD date (scan)
  deathDate: number | null;
  deathCause: 'Progressive disease' | 'Adverse event' | 'Other' | 'Unknown' | null;
  scans: TScan[];
  missedPair: boolean;
  noBaselineScan: boolean;
  nactStart: number | null;
  withdrawalDate: number | null; // withdrawal of consent from study
  ltfuDate: number | null;
  eosReason: string | null; // NCOMPLT term for study discontinuation
  eosDate: number | null;
  contacts: TContact[];
  // safety & findings
  aes: TAe[];
  labs: TLab[];
  vitals: TVitals[];
  ecgs: TEcg[];
  cms: TCm[];
  mhs: TMh[];
  dvs: TDv[];
  lastContact: number;
  sfuDate: number | null;
  subTherapy: { name: string; start: number } | null;
  // latent
  frailty: number;
  depth: number;
  pdType: 'target' | 'new' | 'nontarget';
  tDeathNoPd: number;
  pps: number;
  zResp: number;
  plan: { c1: number; end: number; reason: string; n0: number } | null;
  flags: Record<string, boolean>;
}
