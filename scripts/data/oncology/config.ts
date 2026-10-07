/**
 * Study constants and catalogs for the synthetic CBX417-301 trial.
 * Everything here is fictional. Coded terms are MedDRA-like and illustrative
 * (no MedDRA codes); drug classes are ATC-like text (no WHO Drug codes).
 */
import { dayOf } from './dates.ts';

export const STUDYID = 'CBX417-301';
export const DEFAULT_SEED = 20250331;
export const DCO = dayOf('2025-03-31');
export const FIRST_RAND = dayOf('2022-04-11');
export const LAST_RAND = dayOf('2023-11-28');
export const N_SCREENED = 468;
export const N_SCREEN_FAIL = 48;
export const N_RANDOMIZED = 420;

export type ArmCd = 'CBX+DOC' | 'PBO+DOC';
export const ARMS: Record<ArmCd, { arm: string; trt: string; trtn: number }> = {
  'CBX+DOC': { arm: 'CBX-417 200 mg + Docetaxel 75 mg/m2', trt: 'CBX-417 + Docetaxel', trtn: 1 },
  'PBO+DOC': { arm: 'Placebo + Docetaxel 75 mg/m2', trt: 'Placebo + Docetaxel', trtn: 2 },
};

export type Region = 'NORTH AMERICA' | 'EUROPE' | 'ASIA-PACIFIC';
export const REGION_SHARE: Record<Region, number> = { 'NORTH AMERICA': 0.3, EUROPE: 0.45, 'ASIA-PACIFIC': 0.25 };

export interface Country {
  code: string;
  name: string;
  region: Region;
  nSites: number;
  race: Record<string, number>;
  hispanic: number;
}

const EU_RACE = { WHITE: 0.94, 'BLACK OR AFRICAN AMERICAN': 0.02, ASIAN: 0.02, MULTIPLE: 0.006, OTHER: 0.006, 'NOT REPORTED': 0.008 };
const EA_RACE = { ASIAN: 0.99, 'NOT REPORTED': 0.01 };

export const COUNTRIES: Country[] = [
  { code: 'USA', name: 'United States', region: 'NORTH AMERICA', nSites: 9, hispanic: 0.14,
    race: { WHITE: 0.72, 'BLACK OR AFRICAN AMERICAN': 0.16, ASIAN: 0.05, 'AMERICAN INDIAN OR ALASKA NATIVE': 0.012, 'NATIVE HAWAIIAN OR OTHER PACIFIC ISLANDER': 0.006, MULTIPLE: 0.025, OTHER: 0.012, 'NOT REPORTED': 0.015 } },
  { code: 'CAN', name: 'Canada', region: 'NORTH AMERICA', nSites: 3, hispanic: 0.02,
    race: { WHITE: 0.8, ASIAN: 0.1, 'BLACK OR AFRICAN AMERICAN': 0.04, 'AMERICAN INDIAN OR ALASKA NATIVE': 0.02, MULTIPLE: 0.02, 'NOT REPORTED': 0.02 } },
  { code: 'DEU', name: 'Germany', region: 'EUROPE', nSites: 4, hispanic: 0.0, race: EU_RACE },
  { code: 'FRA', name: 'France', region: 'EUROPE', nSites: 3, hispanic: 0.0,
    race: { WHITE: 0.68, 'BLACK OR AFRICAN AMERICAN': 0.04, ASIAN: 0.02, 'NOT REPORTED': 0.26 } },
  { code: 'ESP', name: 'Spain', region: 'EUROPE', nSites: 3, hispanic: 0.55, race: EU_RACE },
  { code: 'ITA', name: 'Italy', region: 'EUROPE', nSites: 3, hispanic: 0.0, race: EU_RACE },
  { code: 'POL', name: 'Poland', region: 'EUROPE', nSites: 3, hispanic: 0.0, race: { WHITE: 0.99, 'NOT REPORTED': 0.01 } },
  { code: 'GBR', name: 'United Kingdom', region: 'EUROPE', nSites: 3, hispanic: 0.0,
    race: { WHITE: 0.87, ASIAN: 0.07, 'BLACK OR AFRICAN AMERICAN': 0.04, MULTIPLE: 0.01, 'NOT REPORTED': 0.01 } },
  { code: 'JPN', name: 'Japan', region: 'ASIA-PACIFIC', nSites: 4, hispanic: 0.0, race: EA_RACE },
  { code: 'KOR', name: 'Republic of Korea', region: 'ASIA-PACIFIC', nSites: 3, hispanic: 0.0, race: EA_RACE },
  { code: 'TWN', name: 'Taiwan', region: 'ASIA-PACIFIC', nSites: 2, hispanic: 0.0, race: EA_RACE },
  { code: 'AUS', name: 'Australia', region: 'ASIA-PACIFIC', nSites: 2, hispanic: 0.01,
    race: { WHITE: 0.72, ASIAN: 0.2, 'NATIVE HAWAIIAN OR OTHER PACIFIC ISLANDER': 0.02, OTHER: 0.03, MULTIPLE: 0.02, 'NOT REPORTED': 0.01 } },
];

export interface Site {
  siteId: string;
  country: Country;
  weight: number;
  /** Local laboratory reporting conventional units for unscheduled / urgent draws. */
  localLab: boolean;
  /** US site whose nurses sometimes chart temperature in F and weight in lb. */
  imperial: boolean;
}

/* ------------------------------------------------------------------ */
/* Visits                                                               */
/* ------------------------------------------------------------------ */

export const VISIT = {
  SCREENING: { name: 'SCREENING', num: 1 },
  EOT: { name: 'END OF TREATMENT', num: 800 },
  SFU: { name: 'SAFETY FOLLOW-UP', num: 810 },
};
export const cycleVisit = (n: number) => ({ name: `CYCLE ${n} DAY 1`, num: n * 10 });
export const C1D8 = { name: 'CYCLE 1 DAY 8', num: 11 };
export const survVisit = (n: number) => ({ name: `SURVIVAL FOLLOW-UP ${n}`, num: 900 + n });
/** Tumor assessment visits: VISITNUM = 1000 + nominal week (study convention). */
export const tumorVisit = (week: number) => ({ name: `WEEK ${week}`, num: 1000 + week });

/** Nominal tumor-assessment weeks from randomization: q6w to week 48, then q9w. */
export function tumorWeeks(maxDays: number): number[] {
  const out: number[] = [];
  for (let w = 6; w <= 48; w += 6) out.push(w);
  for (let w = 57; w * 7 <= maxDays + 7; w += 9) out.push(w);
  return out;
}

/* ------------------------------------------------------------------ */
/* Laboratory tests                                                     */
/* ------------------------------------------------------------------ */

export interface LabTest {
  code: string;
  name: string;
  cat: 'CHEMISTRY' | 'HEMATOLOGY';
  spec: 'SERUM' | 'BLOOD';
  unit: string;
  dp: number;
  ref: { M: [number, number]; F: [number, number] };
  vendorCode: string;
  vendorName: string;
  local: { code: string; name: string; unit: string; dp: number; factor: number; ref: { M: [number, number]; F: [number, number] } };
  param: string;
  /** Direction graded by the simplified CTCAE-style lab grading, if any. */
  tox?: 'high' | 'low';
}

export const LAB_TESTS: LabTest[] = [
  { code: 'ALT', name: 'Alanine Aminotransferase', cat: 'CHEMISTRY', spec: 'SERUM', unit: 'U/L', dp: 0, ref: { M: [10, 50], F: [7, 35] },
    vendorCode: 'CH010', vendorName: 'ALT (SGPT)', param: 'Alanine Aminotransferase (U/L)', tox: 'high',
    local: { code: 'L-ALT', name: 'Alanine transaminase', unit: 'U/L', dp: 0, factor: 1, ref: { M: [5, 45], F: [5, 34] } } },
  { code: 'AST', name: 'Aspartate Aminotransferase', cat: 'CHEMISTRY', spec: 'SERUM', unit: 'U/L', dp: 0, ref: { M: [15, 40], F: [13, 35] },
    vendorCode: 'CH011', vendorName: 'AST (SGOT)', param: 'Aspartate Aminotransferase (U/L)', tox: 'high',
    local: { code: 'L-AST', name: 'Aspartate transaminase', unit: 'U/L', dp: 0, factor: 1, ref: { M: [5, 40], F: [5, 35] } } },
  { code: 'BILI', name: 'Bilirubin', cat: 'CHEMISTRY', spec: 'SERUM', unit: 'umol/L', dp: 0, ref: { M: [3, 21], F: [3, 21] },
    vendorCode: 'CH020', vendorName: 'Bilirubin, Total', param: 'Bilirubin (umol/L)', tox: 'high',
    local: { code: 'L-TBIL', name: 'Total bilirubin', unit: 'mg/dL', dp: 1, factor: 17.1, ref: { M: [0.2, 1.2], F: [0.2, 1.2] } } },
  { code: 'CREAT', name: 'Creatinine', cat: 'CHEMISTRY', spec: 'SERUM', unit: 'umol/L', dp: 0, ref: { M: [62, 106], F: [44, 80] },
    vendorCode: 'CH030', vendorName: 'Creatinine', param: 'Creatinine (umol/L)',
    local: { code: 'L-CREA', name: 'Creatinine, serum', unit: 'mg/dL', dp: 2, factor: 88.4, ref: { M: [0.7, 1.2], F: [0.5, 0.9] } } },
  { code: 'HGB', name: 'Hemoglobin', cat: 'HEMATOLOGY', spec: 'BLOOD', unit: 'g/L', dp: 0, ref: { M: [130, 175], F: [120, 155] },
    vendorCode: 'HE001', vendorName: 'Hemoglobin', param: 'Hemoglobin (g/L)', tox: 'low',
    local: { code: 'L-HGB', name: 'Haemoglobin', unit: 'g/dL', dp: 1, factor: 10, ref: { M: [13.0, 17.0], F: [12.0, 15.5] } } },
  { code: 'NEUT', name: 'Neutrophils', cat: 'HEMATOLOGY', spec: 'BLOOD', unit: '10^9/L', dp: 2, ref: { M: [1.8, 7.5], F: [1.8, 7.5] },
    vendorCode: 'HE010', vendorName: 'Absolute Neutrophil Count', param: 'Neutrophils (10^9/L)', tox: 'low',
    local: { code: 'L-ANC', name: 'Neutrophils, absolute', unit: '10^3/uL', dp: 2, factor: 1, ref: { M: [1.5, 7.0], F: [1.5, 7.0] } } },
  { code: 'PLAT', name: 'Platelets', cat: 'HEMATOLOGY', spec: 'BLOOD', unit: '10^9/L', dp: 0, ref: { M: [150, 400], F: [150, 400] },
    vendorCode: 'HE020', vendorName: 'Platelet Count', param: 'Platelets (10^9/L)', tox: 'low',
    local: { code: 'L-PLT', name: 'Platelets', unit: '10^3/uL', dp: 0, factor: 1, ref: { M: [150, 400], F: [150, 400] } } },
];
export const LAB = Object.fromEntries(LAB_TESTS.map((t) => [t.code, t])) as Record<string, LabTest>;
export const HEME_CODES = ['HGB', 'NEUT', 'PLAT'];
export const CHEM_CODES = ['ALT', 'AST', 'BILI', 'CREAT'];

/* ------------------------------------------------------------------ */
/* Vital signs / ECG                                                    */
/* ------------------------------------------------------------------ */

export const VS_TESTS = [
  { code: 'SYSBP', name: 'Systolic Blood Pressure', unit: 'mmHg', param: 'Systolic Blood Pressure (mmHg)', dp: 0 },
  { code: 'DIABP', name: 'Diastolic Blood Pressure', unit: 'mmHg', param: 'Diastolic Blood Pressure (mmHg)', dp: 0 },
  { code: 'PULSE', name: 'Pulse Rate', unit: 'beats/min', param: 'Pulse Rate (beats/min)', dp: 0 },
  { code: 'TEMP', name: 'Temperature', unit: 'C', param: 'Temperature (C)', dp: 1 },
  { code: 'WEIGHT', name: 'Weight', unit: 'kg', param: 'Weight (kg)', dp: 1 },
  { code: 'HEIGHT', name: 'Height', unit: 'cm', param: 'Height (cm)', dp: 0 },
] as const;

export const ECOG_TEXT = [
  'Fully active, able to carry on all pre-disease performance without restriction',
  'Restricted in physically strenuous activity but ambulatory and able to carry out work of a light or sedentary nature, e.g., light house work, office work',
  'Ambulatory and capable of all selfcare but unable to carry out any work activities. Up and about more than 50% of waking hours',
  'Capable of only limited selfcare, confined to bed or chair more than 50% of waking hours',
  'Completely disabled. Cannot carry on any selfcare. Totally confined to bed or chair',
  'Dead',
];

/* ------------------------------------------------------------------ */
/* Adverse events (MedDRA-like, illustrative, US spelling, no codes)    */
/* ------------------------------------------------------------------ */

export type Profile = 'first' | 'early' | 'uniform' | 'late';
export type LabLink = 'NEUT' | 'PLAT' | 'HGB' | 'ALT' | 'AST' | 'BILI' | 'SBP' | 'TEMP' | 'WEIGHT' | 'WBC';

export interface AeDef {
  pt: string;
  soc: string;
  inc: [number, number];
  grades: [number, number, number, number];
  gradesPbo?: [number, number, number, number];
  profile: Profile;
  day: [number, number];
  dur: [number, number];
  recur: number;
  ser: [number, number, number, number];
  relCbx: [number, number];
  relDoc: number;
  cbxAct: 'strong' | 'normal' | 'weak';
  docAct: 'neutro' | 'neuro' | 'normal' | 'none';
  lab?: LabLink;
  ongoing?: number;
  verbatims: string[];
}

const S = {
  blood: 'Blood and lymphatic system disorders',
  cardiac: 'Cardiac disorders',
  endo: 'Endocrine disorders',
  eye: 'Eye disorders',
  gi: 'Gastrointestinal disorders',
  gen: 'General disorders and administration site conditions',
  inf: 'Infections and infestations',
  inv: 'Investigations',
  metab: 'Metabolism and nutrition disorders',
  msk: 'Musculoskeletal and connective tissue disorders',
  nerv: 'Nervous system disorders',
  psych: 'Psychiatric disorders',
  resp: 'Respiratory, thoracic and mediastinal disorders',
  skin: 'Skin and subcutaneous tissue disorders',
  vasc: 'Vascular disorders',
  neo: 'Neoplasms benign, malignant and unspecified (incl cysts and polyps)',
  renal: 'Renal and urinary disorders',
  repro: 'Reproductive system and breast disorders',
};
export const SOC = S;

const Z4: [number, number, number, number] = [0, 0, 0, 0];

export const AE_CATALOG: AeDef[] = [
  { pt: 'Neutropenia', soc: S.blood, inc: [0.46, 0.44], grades: [8, 22, 38, 32], profile: 'first', day: [6, 10], dur: [7, 0.35], recur: 0.35, ser: [0, 0, 0.02, 0.05], relCbx: [0.35, 0.3], relDoc: 0.97, cbxAct: 'weak', docAct: 'neutro', lab: 'NEUT', verbatims: ['Neutropenia', 'neutropenia', 'Low neutrophil count', 'Decreased ANC', 'NEUTROPENIA'] },
  { pt: 'Febrile neutropenia', soc: S.blood, inc: [0.085, 0.055], grades: [0, 0, 85, 15], profile: 'first', day: [6, 12], dur: [5, 0.3], recur: 0.05, ser: [1, 1, 1, 1], relCbx: [0.45, 0.4], relDoc: 1, cbxAct: 'normal', docAct: 'neutro', lab: 'NEUT', verbatims: ['Febrile neutropenia', 'Neutropenic fever', 'febrile neutropenia', 'Fever with low ANC'] },
  { pt: 'Fatigue', soc: S.gen, inc: [0.42, 0.36], grades: [45, 40, 15, 0], profile: 'early', day: [2, 15], dur: [35, 0.8], recur: 0.15, ser: [0, 0, 0.04, 0], relCbx: [0.65, 0.55], relDoc: 0.75, cbxAct: 'normal', docAct: 'normal', ongoing: 0.25, verbatims: ['Fatigue', 'fatigue', 'Tiredness', 'tiredness', 'Feeling tired', 'FATIGUE'] },
  { pt: 'Diarrhea', soc: S.gi, inc: [0.53, 0.25], grades: [45, 37, 18, 0], gradesPbo: [62, 30, 8, 0], profile: 'early', day: [3, 14], dur: [7, 0.6], recur: 0.35, ser: [0, 0, 0.25, 0], relCbx: [0.85, 0.45], relDoc: 0.45, cbxAct: 'strong', docAct: 'normal', lab: 'WEIGHT', verbatims: ['Diarrhea', 'diarrhoea', 'Diarrhoea', 'Loose stools', 'Watery stools', 'Increased stool frequency'] },
  { pt: 'Alopecia', soc: S.skin, inc: [0.37, 0.35], grades: [40, 60, 0, 0], profile: 'first', day: [14, 21], dur: [120, 0.5], recur: 0, ser: Z4, relCbx: [0.1, 0.1], relDoc: 0.98, cbxAct: 'weak', docAct: 'none', ongoing: 0.5, verbatims: ['Alopecia', 'Hair loss', 'hair loss', 'ALOPECIA'] },
  { pt: 'Nausea', soc: S.gi, inc: [0.35, 0.29], grades: [60, 33, 7, 0], profile: 'early', day: [1, 6], dur: [5, 0.7], recur: 0.3, ser: [0, 0, 0.1, 0], relCbx: [0.6, 0.5], relDoc: 0.7, cbxAct: 'normal', docAct: 'normal', verbatims: ['Nausea', 'nausea', 'Nauseous', 'NAUSEA'] },
  { pt: 'Rash', soc: S.skin, inc: [0.3, 0.1], grades: [50, 35, 15, 0], gradesPbo: [70, 27, 3, 0], profile: 'early', day: [7, 20], dur: [21, 0.6], recur: 0.2, ser: [0, 0, 0.05, 0], relCbx: [0.9, 0.6], relDoc: 0.2, cbxAct: 'strong', docAct: 'none', verbatims: ['Rash', 'Skin rash', 'rash on trunk', 'Rash', 'Rash to chest and arms'] },
  { pt: 'Stomatitis', soc: S.gi, inc: [0.28, 0.17], grades: [55, 35, 10, 0], profile: 'early', day: [5, 14], dur: [10, 0.5], recur: 0.25, ser: Z4, relCbx: [0.7, 0.5], relDoc: 0.6, cbxAct: 'normal', docAct: 'normal', verbatims: ['Stomatitis', 'Mouth sores', 'Oral mucositis', 'stomatitis'] },
  { pt: 'Decreased appetite', soc: S.metab, inc: [0.25, 0.2], grades: [55, 38, 7, 0], profile: 'uniform', day: [1, 20], dur: [40, 0.8], recur: 0.1, ser: Z4, relCbx: [0.5, 0.4], relDoc: 0.5, cbxAct: 'weak', docAct: 'none', lab: 'WEIGHT', ongoing: 0.2, verbatims: ['Decreased appetite', 'Anorexia', 'Loss of appetite', 'Poor appetite'] },
  { pt: 'Anemia', soc: S.blood, inc: [0.2, 0.18], grades: [35, 45, 20, 0], profile: 'late', day: [1, 20], dur: [45, 0.7], recur: 0.1, ser: [0, 0, 0.05, 0], relCbx: [0.3, 0.25], relDoc: 0.6, cbxAct: 'weak', docAct: 'normal', lab: 'HGB', ongoing: 0.2, verbatims: ['Anemia', 'Anaemia', 'Low hemoglobin', 'anemia'] },
  { pt: 'Alanine aminotransferase increased', soc: S.inv, inc: [0.23, 0.075], grades: [55, 22, 18, 5], gradesPbo: [70, 20, 10, 0], profile: 'early', day: [5, 20], dur: [18, 0.5], recur: 0.15, ser: [0, 0, 0.05, 0.2], relCbx: [0.85, 0.6], relDoc: 0.3, cbxAct: 'strong', docAct: 'normal', lab: 'ALT', verbatims: ['ALT elevated', 'Increased ALT', 'Elevated alanine aminotransferase', 'ALT increased', 'Raised ALT'] },
  { pt: 'Aspartate aminotransferase increased', soc: S.inv, inc: [0.15, 0.05], grades: [60, 22, 15, 3], gradesPbo: [72, 20, 8, 0], profile: 'early', day: [5, 20], dur: [16, 0.5], recur: 0.1, ser: [0, 0, 0.05, 0.2], relCbx: [0.85, 0.6], relDoc: 0.3, cbxAct: 'strong', docAct: 'normal', lab: 'AST', verbatims: ['AST elevated', 'Increased AST', 'Elevated aspartate aminotransferase', 'AST increased'] },
  { pt: 'Edema peripheral', soc: S.gen, inc: [0.15, 0.12], grades: [55, 40, 5, 0], profile: 'late', day: [1, 20], dur: [60, 0.7], recur: 0.05, ser: Z4, relCbx: [0.3, 0.25], relDoc: 0.8, cbxAct: 'weak', docAct: 'normal', ongoing: 0.3, verbatims: ['Peripheral edema', 'Oedema peripheral', 'Ankle swelling', 'Bilateral leg edema'] },
  { pt: 'Neuropathy peripheral', soc: S.nerv, inc: [0.12, 0.11], grades: [55, 35, 10, 0], profile: 'late', day: [1, 20], dur: [90, 0.7], recur: 0, ser: Z4, relCbx: [0.2, 0.2], relDoc: 0.9, cbxAct: 'weak', docAct: 'neuro', ongoing: 0.4, verbatims: ['Peripheral neuropathy', 'Numbness in fingers and toes', 'Peripheral sensory neuropathy', 'Tingling hands and feet'] },
  { pt: 'Vomiting', soc: S.gi, inc: [0.15, 0.12], grades: [60, 32, 8, 0], profile: 'early', day: [1, 8], dur: [3, 0.6], recur: 0.25, ser: [0, 0, 0.15, 0], relCbx: [0.55, 0.45], relDoc: 0.65, cbxAct: 'normal', docAct: 'normal', verbatims: ['Vomiting', 'vomiting', 'Emesis'] },
  { pt: 'Constipation', soc: S.gi, inc: [0.15, 0.16], grades: [65, 33, 2, 0], profile: 'early', day: [2, 12], dur: [10, 0.6], recur: 0.15, ser: Z4, relCbx: [0.2, 0.2], relDoc: 0.3, cbxAct: 'weak', docAct: 'none', verbatims: ['Constipation', 'constipation', 'Constipated'] },
  { pt: 'Dyspnea', soc: S.resp, inc: [0.14, 0.15], grades: [45, 40, 15, 0], profile: 'uniform', day: [1, 20], dur: [21, 0.8], recur: 0.1, ser: [0, 0, 0.2, 0], relCbx: [0.15, 0.15], relDoc: 0.15, cbxAct: 'weak', docAct: 'none', verbatims: ['Dyspnea', 'Shortness of breath', 'Dyspnoea', 'SOB on exertion'] },
  { pt: 'Cough', soc: S.resp, inc: [0.12, 0.12], grades: [65, 33, 2, 0], profile: 'uniform', day: [1, 20], dur: [30, 0.8], recur: 0.05, ser: Z4, relCbx: [0.1, 0.1], relDoc: 0.1, cbxAct: 'weak', docAct: 'none', verbatims: ['Cough', 'cough', 'Dry cough', 'Productive cough'] },
  { pt: 'Pyrexia', soc: S.gen, inc: [0.1, 0.09], grades: [65, 30, 5, 0], profile: 'uniform', day: [1, 20], dur: [3, 0.5], recur: 0.15, ser: [0, 0, 0.3, 0], relCbx: [0.3, 0.25], relDoc: 0.35, cbxAct: 'weak', docAct: 'none', lab: 'TEMP', verbatims: ['Fever', 'Pyrexia', 'fever', 'Temperature elevated'] },
  { pt: 'Hypertension', soc: S.vasc, inc: [0.18, 0.055], grades: [20, 50, 30, 0], profile: 'early', day: [1, 20], dur: [60, 0.8], recur: 0, ser: Z4, relCbx: [0.85, 0.4], relDoc: 0.1, cbxAct: 'normal', docAct: 'none', lab: 'SBP', ongoing: 0.4, verbatims: ['Hypertension', 'High blood pressure', 'Elevated BP', 'Worsening hypertension'] },
  { pt: 'Pneumonia', soc: S.inf, inc: [0.07, 0.06], grades: [0, 20, 70, 10], profile: 'uniform', day: [1, 20], dur: [12, 0.4], recur: 0.05, ser: [0, 0.5, 0.9, 1], relCbx: [0.2, 0.2], relDoc: 0.3, cbxAct: 'normal', docAct: 'normal', lab: 'TEMP', verbatims: ['Pneumonia', 'Community acquired pneumonia', 'Lower respiratory tract infection - pneumonia', 'pneumonia'] },
  { pt: 'Dysgeusia', soc: S.nerv, inc: [0.1, 0.07], grades: [75, 25, 0, 0], profile: 'early', day: [3, 15], dur: [40, 0.7], recur: 0, ser: Z4, relCbx: [0.6, 0.5], relDoc: 0.6, cbxAct: 'weak', docAct: 'none', verbatims: ['Dysgeusia', 'Taste alteration', 'Metallic taste', 'Altered taste'] },
  { pt: 'Asthenia', soc: S.gen, inc: [0.12, 0.11], grades: [45, 42, 13, 0], profile: 'uniform', day: [1, 20], dur: [30, 0.8], recur: 0.1, ser: Z4, relCbx: [0.5, 0.45], relDoc: 0.6, cbxAct: 'normal', docAct: 'normal', verbatims: ['Asthenia', 'Weakness', 'Generalized weakness', 'asthenia'] },
  { pt: 'Arthralgia', soc: S.msk, inc: [0.08, 0.08], grades: [60, 35, 5, 0], profile: 'uniform', day: [1, 20], dur: [20, 0.8], recur: 0.1, ser: Z4, relCbx: [0.3, 0.3], relDoc: 0.4, cbxAct: 'weak', docAct: 'none', verbatims: ['Arthralgia', 'Joint pain', 'joint pains'] },
  { pt: 'Headache', soc: S.nerv, inc: [0.08, 0.07], grades: [70, 27, 3, 0], profile: 'uniform', day: [1, 20], dur: [4, 0.8], recur: 0.2, ser: Z4, relCbx: [0.3, 0.3], relDoc: 0.2, cbxAct: 'weak', docAct: 'none', verbatims: ['Headache', 'headache', 'Head ache'] },
  { pt: 'Hypokalemia', soc: S.metab, inc: [0.06, 0.04], grades: [50, 20, 25, 5], profile: 'uniform', day: [1, 20], dur: [7, 0.6], recur: 0.15, ser: [0, 0, 0.05, 0.3], relCbx: [0.4, 0.3], relDoc: 0.2, cbxAct: 'weak', docAct: 'none', verbatims: ['Hypokalemia', 'Low potassium', 'Hypokalaemia'] },
  { pt: 'Thrombocytopenia', soc: S.blood, inc: [0.06, 0.05], grades: [50, 25, 18, 7], profile: 'early', day: [6, 12], dur: [8, 0.5], recur: 0.15, ser: [0, 0, 0.05, 0.2], relCbx: [0.4, 0.35], relDoc: 0.9, cbxAct: 'normal', docAct: 'neutro', lab: 'PLAT', verbatims: ['Thrombocytopenia', 'Low platelets', 'Platelet count decreased - low platelets', 'thrombocytopenia'] },
  { pt: 'Pneumonitis', soc: S.resp, inc: [0.04, 0.01], grades: [0, 40, 50, 10], profile: 'uniform', day: [1, 20], dur: [30, 0.6], recur: 0, ser: [0, 0.5, 0.9, 1], relCbx: [0.8, 0.5], relDoc: 0.3, cbxAct: 'strong', docAct: 'normal', verbatims: ['Pneumonitis', 'Drug-induced pneumonitis', 'Non-infectious pneumonitis'] },
  { pt: 'Pulmonary embolism', soc: S.resp, inc: [0.03, 0.02], grades: [0, 25, 60, 15], profile: 'uniform', day: [1, 20], dur: [30, 0.5], recur: 0, ser: [0, 0.6, 0.95, 1], relCbx: [0.2, 0.2], relDoc: 0.2, cbxAct: 'normal', docAct: 'normal', verbatims: ['Pulmonary embolism', 'PE', 'Bilateral pulmonary emboli', 'Pulmonary embolus'] },
  { pt: 'Sepsis', soc: S.inf, inc: [0.02, 0.015], grades: [0, 0, 55, 45], profile: 'uniform', day: [1, 20], dur: [12, 0.4], recur: 0, ser: [1, 1, 1, 1], relCbx: [0.3, 0.3], relDoc: 0.5, cbxAct: 'normal', docAct: 'normal', lab: 'TEMP', verbatims: ['Sepsis', 'Neutropenic sepsis', 'Septicaemia', 'sepsis'] },
  { pt: 'Respiratory failure', soc: S.resp, inc: [0.01, 0.01], grades: [0, 0, 50, 50], profile: 'uniform', day: [1, 20], dur: [10, 0.5], recur: 0, ser: [1, 1, 1, 1], relCbx: [0.1, 0.1], relDoc: 0.1, cbxAct: 'normal', docAct: 'normal', verbatims: ['Respiratory failure', 'Acute respiratory failure', 'Hypoxic respiratory failure'] },
  { pt: 'Blood bilirubin increased', soc: S.inv, inc: [0.03, 0.02], grades: [55, 30, 15, 0], profile: 'uniform', day: [1, 20], dur: [14, 0.5], recur: 0.05, ser: Z4, relCbx: [0.6, 0.4], relDoc: 0.3, cbxAct: 'normal', docAct: 'normal', lab: 'BILI', verbatims: ['Bilirubin increased', 'Hyperbilirubinemia', 'Elevated total bilirubin'] },
  { pt: 'Weight decreased', soc: S.inv, inc: [0.08, 0.06], grades: [60, 35, 5, 0], profile: 'late', day: [1, 20], dur: [60, 0.7], recur: 0, ser: Z4, relCbx: [0.4, 0.3], relDoc: 0.3, cbxAct: 'weak', docAct: 'none', lab: 'WEIGHT', ongoing: 0.5, verbatims: ['Weight loss', 'Weight decreased', 'Loss of weight'] },
  { pt: 'Back pain', soc: S.msk, inc: [0.07, 0.07], grades: [60, 33, 7, 0], profile: 'uniform', day: [1, 20], dur: [20, 0.8], recur: 0.1, ser: Z4, relCbx: [0.05, 0.05], relDoc: 0.05, cbxAct: 'weak', docAct: 'none', verbatims: ['Back pain', 'Lower back pain', 'back pain'] },
  { pt: 'Insomnia', soc: S.psych, inc: [0.07, 0.06], grades: [70, 28, 2, 0], profile: 'uniform', day: [1, 20], dur: [30, 0.8], recur: 0, ser: Z4, relCbx: [0.2, 0.2], relDoc: 0.2, cbxAct: 'weak', docAct: 'none', verbatims: ['Insomnia', 'Difficulty sleeping', 'insomnia'] },
  { pt: 'Myalgia', soc: S.msk, inc: [0.06, 0.06], grades: [65, 32, 3, 0], profile: 'early', day: [2, 8], dur: [5, 0.7], recur: 0.2, ser: Z4, relCbx: [0.3, 0.3], relDoc: 0.7, cbxAct: 'weak', docAct: 'none', verbatims: ['Myalgia', 'Muscle aches', 'Muscle pain'] },
  { pt: 'Abdominal pain', soc: S.gi, inc: [0.06, 0.05], grades: [55, 38, 7, 0], profile: 'uniform', day: [1, 20], dur: [7, 0.8], recur: 0.1, ser: [0, 0, 0.3, 0], relCbx: [0.3, 0.25], relDoc: 0.3, cbxAct: 'weak', docAct: 'none', verbatims: ['Abdominal pain', 'Stomach pain', 'Abdominal cramps'] },
  { pt: 'Nail disorder', soc: S.skin, inc: [0.07, 0.06], grades: [70, 28, 2, 0], profile: 'late', day: [1, 20], dur: [90, 0.6], recur: 0, ser: Z4, relCbx: [0.3, 0.3], relDoc: 0.9, cbxAct: 'weak', docAct: 'none', ongoing: 0.4, verbatims: ['Nail changes', 'Nail discoloration', 'Nail disorder'] },
  { pt: 'Dry skin', soc: S.skin, inc: [0.06, 0.03], grades: [75, 25, 0, 0], profile: 'early', day: [5, 20], dur: [45, 0.7], recur: 0, ser: Z4, relCbx: [0.7, 0.4], relDoc: 0.3, cbxAct: 'weak', docAct: 'none', verbatims: ['Dry skin', 'Xerosis', 'dry skin'] },
  { pt: 'Pruritus', soc: S.skin, inc: [0.06, 0.04], grades: [65, 32, 3, 0], profile: 'early', day: [5, 20], dur: [14, 0.7], recur: 0.1, ser: Z4, relCbx: [0.6, 0.4], relDoc: 0.3, cbxAct: 'weak', docAct: 'none', verbatims: ['Pruritus', 'Itching', 'Itchy skin'] },
  { pt: 'Palmar-plantar erythrodysesthesia syndrome', soc: S.skin, inc: [0.06, 0.02], grades: [45, 40, 15, 0], profile: 'early', day: [7, 20], dur: [30, 0.6], recur: 0.1, ser: Z4, relCbx: [0.85, 0.4], relDoc: 0.3, cbxAct: 'strong', docAct: 'none', verbatims: ['Hand-foot syndrome', 'Palmar-plantar erythrodysesthesia', 'Hand foot skin reaction'] },
  { pt: 'Lacrimation increased', soc: S.eye, inc: [0.05, 0.05], grades: [75, 25, 0, 0], profile: 'late', day: [1, 20], dur: [40, 0.7], recur: 0, ser: Z4, relCbx: [0.2, 0.2], relDoc: 0.8, cbxAct: 'weak', docAct: 'none', verbatims: ['Watery eyes', 'Increased lacrimation', 'Epiphora'] },
  { pt: 'Dizziness', soc: S.nerv, inc: [0.05, 0.05], grades: [70, 28, 2, 0], profile: 'uniform', day: [1, 20], dur: [5, 0.8], recur: 0.1, ser: Z4, relCbx: [0.2, 0.2], relDoc: 0.2, cbxAct: 'weak', docAct: 'none', verbatims: ['Dizziness', 'Lightheadedness', 'dizzy'] },
  { pt: 'Epistaxis', soc: S.resp, inc: [0.04, 0.03], grades: [85, 15, 0, 0], profile: 'uniform', day: [1, 20], dur: [2, 0.5], recur: 0.2, ser: Z4, relCbx: [0.3, 0.2], relDoc: 0.2, cbxAct: 'weak', docAct: 'none', verbatims: ['Epistaxis', 'Nosebleed', 'Nose bleed'] },
  { pt: 'Urinary tract infection', soc: S.inf, inc: [0.04, 0.04], grades: [20, 65, 15, 0], profile: 'uniform', day: [1, 20], dur: [8, 0.5], recur: 0.05, ser: [0, 0, 0.3, 0], relCbx: [0.1, 0.1], relDoc: 0.2, cbxAct: 'weak', docAct: 'none', lab: 'TEMP', verbatims: ['Urinary tract infection', 'UTI', 'Cystitis'] },
  { pt: 'Upper respiratory tract infection', soc: S.inf, inc: [0.05, 0.05], grades: [50, 45, 5, 0], profile: 'uniform', day: [1, 20], dur: [8, 0.5], recur: 0.1, ser: Z4, relCbx: [0.1, 0.1], relDoc: 0.15, cbxAct: 'weak', docAct: 'none', verbatims: ['Upper respiratory tract infection', 'URTI', 'Common cold', 'Head cold'] },
  { pt: 'Hypomagnesemia', soc: S.metab, inc: [0.05, 0.03], grades: [70, 20, 8, 2], profile: 'uniform', day: [1, 20], dur: [14, 0.6], recur: 0.1, ser: Z4, relCbx: [0.5, 0.3], relDoc: 0.2, cbxAct: 'weak', docAct: 'none', verbatims: ['Hypomagnesemia', 'Low magnesium', 'Hypomagnesaemia'] },
  { pt: 'Dehydration', soc: S.metab, inc: [0.03, 0.02], grades: [10, 55, 35, 0], profile: 'early', day: [3, 14], dur: [5, 0.5], recur: 0, ser: [0, 0.2, 0.6, 0], relCbx: [0.5, 0.3], relDoc: 0.4, cbxAct: 'normal', docAct: 'normal', lab: 'WEIGHT', verbatims: ['Dehydration', 'dehydration', 'Dehydrated'] },
  { pt: 'Pleural effusion', soc: S.resp, inc: [0.04, 0.04], grades: [20, 50, 30, 0], profile: 'uniform', day: [1, 20], dur: [25, 0.6], recur: 0, ser: [0, 0.2, 0.5, 0], relCbx: [0.1, 0.1], relDoc: 0.3, cbxAct: 'weak', docAct: 'none', verbatims: ['Pleural effusion', 'Left pleural effusion', 'Right pleural effusion'] },
  { pt: 'Hypoalbuminemia', soc: S.metab, inc: [0.04, 0.03], grades: [50, 45, 5, 0], profile: 'late', day: [1, 20], dur: [40, 0.6], recur: 0, ser: Z4, relCbx: [0.3, 0.2], relDoc: 0.2, cbxAct: 'weak', docAct: 'none', verbatims: ['Hypoalbuminemia', 'Low albumin', 'Hypoalbuminaemia'] },
  { pt: 'Hyperglycemia', soc: S.metab, inc: [0.04, 0.03], grades: [50, 35, 15, 0], profile: 'early', day: [1, 5], dur: [5, 0.6], recur: 0.2, ser: Z4, relCbx: [0.2, 0.2], relDoc: 0.3, cbxAct: 'weak', docAct: 'none', verbatims: ['Hyperglycemia', 'High blood sugar', 'Steroid-induced hyperglycaemia'] },
  { pt: 'Leukopenia', soc: S.blood, inc: [0.05, 0.05], grades: [20, 40, 30, 10], profile: 'first', day: [6, 10], dur: [7, 0.4], recur: 0.2, ser: Z4, relCbx: [0.3, 0.3], relDoc: 0.95, cbxAct: 'weak', docAct: 'neutro', lab: 'NEUT', verbatims: ['Leukopenia', 'Low white cell count', 'Low WBC'] },
  { pt: 'Atrial fibrillation', soc: S.cardiac, inc: [0.02, 0.01], grades: [0, 50, 45, 5], profile: 'uniform', day: [1, 20], dur: [14, 0.8], recur: 0, ser: [0, 0.3, 0.6, 1], relCbx: [0.3, 0.2], relDoc: 0.1, cbxAct: 'normal', docAct: 'none', verbatims: ['Atrial fibrillation', 'AF', 'New onset atrial fibrillation'] },
  { pt: 'Hypothyroidism', soc: S.endo, inc: [0.02, 0.02], grades: [30, 70, 0, 0], profile: 'late', day: [1, 20], dur: [200, 0.3], recur: 0, ser: Z4, relCbx: [0.3, 0.3], relDoc: 0.1, cbxAct: 'weak', docAct: 'none', ongoing: 0.8, verbatims: ['Hypothyroidism', 'Underactive thyroid', 'hypothyroidism'] },
];

/** PTs created only by linkage (fatal events, QTc outliers), not by the incidence model. */
export const LINKED_AE: Record<string, { soc: string; verbatims: string[] }> = {
  'Cardiac arrest': { soc: S.cardiac, verbatims: ['Cardiac arrest', 'Cardiopulmonary arrest'] },
  'Electrocardiogram QT prolonged': { soc: S.inv, verbatims: ['QTc prolongation', 'Prolonged QTc', 'ECG QT prolonged'] },
};

/** Fatal (grade 5) AE terms used for deaths without progression during treatment. */
export const FATAL_PTS: { pt: string; w: number }[] = [
  { pt: 'Pneumonia', w: 0.3 },
  { pt: 'Sepsis', w: 0.2 },
  { pt: 'Respiratory failure', w: 0.2 },
  { pt: 'Pulmonary embolism', w: 0.12 },
  { pt: 'Cardiac arrest', w: 0.1 },
  { pt: 'Pneumonitis', w: 0.08 },
];

export function aeSoc(pt: string): string {
  const d = AE_CATALOG.find((a) => a.pt === pt);
  if (d) return d.soc;
  const l = LINKED_AE[pt];
  if (l) return l.soc;
  throw new Error(`unknown PT ${pt}`);
}

export function aeVerbatims(pt: string): string[] {
  const d = AE_CATALOG.find((a) => a.pt === pt);
  if (d) return d.verbatims;
  return LINKED_AE[pt].verbatims;
}

/* ------------------------------------------------------------------ */
/* Medical history                                                      */
/* ------------------------------------------------------------------ */

export interface MhDef {
  pt: string;
  soc: string;
  p: number;
  male?: boolean;
  verbatims: string[];
  meds: string[];
  /** Typical years before consent that the condition started. */
  years: [number, number];
}

export const MH_CATALOG: MhDef[] = [
  { pt: 'Hypertension', soc: S.vasc, p: 0.35, verbatims: ['Hypertension', 'HTN', 'High blood pressure', 'Essential hypertension'], meds: ['AMLODIPINE', 'LISINOPRIL', 'LOSARTAN', 'METOPROLOL'], years: [1, 20] },
  { pt: 'Hyperlipidemia', soc: S.metab, p: 0.25, verbatims: ['Hyperlipidemia', 'Hyperlipidaemia', 'Raised lipids'], meds: ['ATORVASTATIN'], years: [1, 15] },
  { pt: 'Type 2 diabetes mellitus', soc: S.metab, p: 0.15, verbatims: ['Type 2 diabetes', 'T2DM', 'Diabetes mellitus type II', 'NIDDM'], meds: ['METFORMIN'], years: [1, 20] },
  { pt: 'Chronic obstructive pulmonary disease', soc: S.resp, p: 0.25, verbatims: ['COPD', 'Chronic obstructive pulmonary disease', 'Emphysema/COPD'], meds: ['TIOTROPIUM', 'SALBUTAMOL'], years: [1, 15] },
  { pt: 'Coronary artery disease', soc: S.cardiac, p: 0.08, verbatims: ['Coronary artery disease', 'CAD', 'Ischemic heart disease'], meds: ['ACETYLSALICYLIC ACID'], years: [1, 15] },
  { pt: 'Hypothyroidism', soc: S.endo, p: 0.1, verbatims: ['Hypothyroidism', 'Hypothyroidism secondary to immunotherapy', 'Underactive thyroid'], meds: ['LEVOTHYROXINE'], years: [0, 3] },
  { pt: 'Gastroesophageal reflux disease', soc: S.gi, p: 0.12, verbatims: ['GERD', 'Gastro-oesophageal reflux', 'Acid reflux'], meds: ['OMEPRAZOLE', 'PANTOPRAZOLE'], years: [1, 10] },
  { pt: 'Depression', soc: S.psych, p: 0.08, verbatims: ['Depression', 'Depressive disorder', 'depression'], meds: ['SERTRALINE'], years: [1, 10] },
  { pt: 'Anxiety', soc: S.psych, p: 0.07, verbatims: ['Anxiety', 'Anxiety disorder'], meds: ['LORAZEPAM'], years: [0, 5] },
  { pt: 'Osteoarthritis', soc: S.msk, p: 0.1, verbatims: ['Osteoarthritis', 'OA knees', 'Osteoarthritis of hip'], meds: ['PARACETAMOL'], years: [2, 15] },
  { pt: 'Atrial fibrillation', soc: S.cardiac, p: 0.05, verbatims: ['Atrial fibrillation', 'Paroxysmal AF', 'AF'], meds: ['APIXABAN', 'METOPROLOL'], years: [1, 8] },
  { pt: 'Benign prostatic hyperplasia', soc: S.repro, p: 0.12, male: true, verbatims: ['BPH', 'Benign prostatic hyperplasia', 'Enlarged prostate'], meds: ['TAMSULOSIN'], years: [1, 10] },
  { pt: 'Insomnia', soc: S.psych, p: 0.06, verbatims: ['Insomnia', 'Difficulty sleeping'], meds: ['ZOLPIDEM'], years: [0, 5] },
  { pt: 'Anemia', soc: S.blood, p: 0.1, verbatims: ['Anemia', 'Anaemia of chronic disease', 'Chemotherapy-induced anemia'], meds: [], years: [0, 2] },
  { pt: 'Neuropathy peripheral', soc: S.nerv, p: 0.08, verbatims: ['Peripheral neuropathy', 'Chemotherapy-induced peripheral neuropathy', 'Neuropathy after paclitaxel'], meds: [], years: [0, 2] },
  { pt: 'Cataract', soc: S.eye, p: 0.05, verbatims: ['Cataract', 'Bilateral cataracts'], meds: [], years: [1, 10] },
  { pt: 'Asthma', soc: S.resp, p: 0.03, verbatims: ['Asthma', 'Bronchial asthma'], meds: ['SALBUTAMOL'], years: [5, 40] },
  { pt: 'Chronic kidney disease', soc: S.renal, p: 0.03, verbatims: ['Chronic kidney disease', 'CKD stage 3'], meds: [], years: [1, 10] },
  { pt: 'Back pain', soc: S.msk, p: 0.08, verbatims: ['Chronic back pain', 'Lower back pain'], meds: ['PARACETAMOL'], years: [1, 15] },
];

/* ------------------------------------------------------------------ */
/* Concomitant / prior / subsequent medications (generic names)         */
/* ------------------------------------------------------------------ */

export interface CmDef {
  name: string;
  atc: string;
  verbatims: string[];
  dose: number | null;
  unit: string | null;
  route: string;
  freq: string | null;
}

export const CM_CATALOG: Record<string, CmDef> = Object.fromEntries(
  (
    [
      ['CARBOPLATIN', 'PLATINUM COMPOUNDS', ['Carboplatin', 'CARBOPLATIN AUC5', 'carboplatin'], null, null, 'IV', null],
      ['CISPLATIN', 'PLATINUM COMPOUNDS', ['Cisplatin', 'CISPLATIN 75MG/M2'], null, null, 'IV', null],
      ['PEMETREXED', 'FOLIC ACID ANALOGUES', ['Pemetrexed', 'PEMETREXED 500MG/M2', 'pemetrexed'], null, null, 'IV', null],
      ['PACLITAXEL', 'TAXANES', ['Paclitaxel', 'PACLITAXEL 200MG/M2'], null, null, 'IV', null],
      ['GEMCITABINE', 'PYRIMIDINE ANALOGUES', ['Gemcitabine', 'GEMCITABINE 1000MG/M2'], null, null, 'IV', null],
      ['VINORELBINE', 'VINCA ALKALOIDS AND ANALOGUES', ['Vinorelbine', 'VINORELBINE'], null, null, 'IV', null],
      ['PEMBROLIZUMAB', 'PD-1/PDL-1 (PROGRAMMED CELL DEATH PROTEIN 1/DEATH LIGAND 1) INHIBITORS', ['Pembrolizumab', 'PEMBROLIZUMAB 200MG', 'pembro'], null, null, 'IV', null],
      ['NIVOLUMAB', 'PD-1/PDL-1 (PROGRAMMED CELL DEATH PROTEIN 1/DEATH LIGAND 1) INHIBITORS', ['Nivolumab', 'NIVOLUMAB 240MG'], null, null, 'IV', null],
      ['ATEZOLIZUMAB', 'PD-1/PDL-1 (PROGRAMMED CELL DEATH PROTEIN 1/DEATH LIGAND 1) INHIBITORS', ['Atezolizumab', 'ATEZOLIZUMAB 1200MG'], null, null, 'IV', null],
      ['INVESTIGATIONAL DRUG', 'OTHER ANTINEOPLASTIC AGENTS', ['Investigational agent (phase 1 trial)', 'Study drug in another clinical trial'], null, null, 'PO', null],
      ['DEXAMETHASONE', 'GLUCOCORTICOIDS', ['Dexamethasone', 'DEXAMETHASONE', 'Dexamethasone premed'], 8, 'mg', 'PO', 'BID'],
      ['ONDANSETRON', 'SEROTONIN (5HT3) ANTAGONISTS', ['Ondansetron', 'ONDANSETRON'], 8, 'mg', 'PO', 'PRN'],
      ['LOPERAMIDE', 'ANTIPROPULSIVES', ['Loperamide', 'LOPERAMIDE', 'loperamide'], 2, 'mg', 'PO', 'PRN'],
      ['PEGFILGRASTIM', 'COLONY STIMULATING FACTORS', ['Pegfilgrastim', 'PEG-G-CSF', 'pegfilgrastim'], 6, 'mg', 'SC', 'once'],
      ['FILGRASTIM', 'COLONY STIMULATING FACTORS', ['Filgrastim', 'G-CSF'], 300, 'mcg', 'SC', 'once daily'],
      ['PARACETAMOL', 'ANILIDES', ['Paracetamol', 'Acetaminophen', 'Tylenol-type analgesic (paracetamol)'], 1000, 'mg', 'PO', 'PRN'],
      ['OMEPRAZOLE', 'PROTON PUMP INHIBITORS', ['Omeprazole', 'OMEPRAZOLE'], 20, 'mg', 'PO', 'once daily'],
      ['PANTOPRAZOLE', 'PROTON PUMP INHIBITORS', ['Pantoprazole'], 40, 'mg', 'PO', 'once daily'],
      ['AMLODIPINE', 'DIHYDROPYRIDINE DERIVATIVES', ['Amlodipine', 'AMLODIPINE'], 5, 'mg', 'PO', 'once daily'],
      ['LISINOPRIL', 'ACE INHIBITORS, PLAIN', ['Lisinopril'], 10, 'mg', 'PO', 'once daily'],
      ['LOSARTAN', 'ANGIOTENSIN II RECEPTOR BLOCKERS (ARBS), PLAIN', ['Losartan'], 50, 'mg', 'PO', 'once daily'],
      ['METOPROLOL', 'BETA BLOCKING AGENTS, SELECTIVE', ['Metoprolol', 'Metoprolol succinate'], 50, 'mg', 'PO', 'BID'],
      ['ATORVASTATIN', 'HMG COA REDUCTASE INHIBITORS', ['Atorvastatin', 'ATORVASTATIN'], 20, 'mg', 'PO', 'once daily'],
      ['METFORMIN', 'BIGUANIDES', ['Metformin', 'METFORMIN'], 1000, 'mg', 'PO', 'BID'],
      ['LEVOTHYROXINE', 'THYROID HORMONES', ['Levothyroxine', 'L-thyroxine'], 75, 'mcg', 'PO', 'once daily'],
      ['SALBUTAMOL', 'SELECTIVE BETA-2-ADRENORECEPTOR AGONISTS', ['Salbutamol inhaler', 'Albuterol inhaler'], 2, 'puff', 'Inhaled', 'PRN'],
      ['TIOTROPIUM', 'ANTICHOLINERGICS', ['Tiotropium'], 18, 'mcg', 'Inhaled', 'once daily'],
      ['ACETYLSALICYLIC ACID', 'PLATELET AGGREGATION INHIBITORS EXCL. HEPARIN', ['Aspirin', 'ASA 100mg'], 100, 'mg', 'PO', 'once daily'],
      ['SERTRALINE', 'SELECTIVE SEROTONIN REUPTAKE INHIBITORS', ['Sertraline'], 50, 'mg', 'PO', 'once daily'],
      ['LORAZEPAM', 'BENZODIAZEPINE DERIVATIVES', ['Lorazepam'], 1, 'mg', 'PO', 'PRN'],
      ['ZOLPIDEM', 'BENZODIAZEPINE RELATED DRUGS', ['Zolpidem'], 10, 'mg', 'PO', 'QHS'],
      ['TAMSULOSIN', 'ALPHA-ADRENORECEPTOR ANTAGONISTS', ['Tamsulosin'], 0.4, 'mg', 'PO', 'once daily'],
      ['APIXABAN', 'DIRECT FACTOR XA INHIBITORS', ['Apixaban'], 5, 'mg', 'PO', 'BID'],
      ['MORPHINE', 'NATURAL OPIUM ALKALOIDS', ['Morphine sulfate', 'MST (morphine)'], 10, 'mg', 'PO', 'PRN'],
      ['OXYCODONE', 'NATURAL OPIUM ALKALOIDS', ['Oxycodone'], 5, 'mg', 'PO', 'PRN'],
      ['AMOXICILLIN;CLAVULANIC ACID', 'COMBINATIONS OF PENICILLINS, INCL. BETA-LACTAMASE INHIBITORS', ['Amoxicillin-clavulanate', 'Co-amoxiclav'], 875, 'mg', 'PO', 'BID'],
      ['CEFTRIAXONE', 'THIRD-GENERATION CEPHALOSPORINS', ['Ceftriaxone'], 2, 'g', 'IV', 'once daily'],
      ['LEVOFLOXACIN', 'FLUOROQUINOLONES', ['Levofloxacin'], 500, 'mg', 'PO', 'once daily'],
      ['ENOXAPARIN', 'HEPARIN GROUP', ['Enoxaparin', 'LMWH (enoxaparin)'], 80, 'mg', 'SC', 'BID'],
      ['PREDNISONE', 'GLUCOCORTICOIDS', ['Prednisone'], 60, 'mg', 'PO', 'once daily'],
      ['METHYLPREDNISOLONE', 'GLUCOCORTICOIDS', ['Methylprednisolone IV'], 125, 'mg', 'IV', 'once daily'],
      ['POTASSIUM CHLORIDE', 'POTASSIUM', ['Potassium chloride', 'KCl supplement'], 20, 'mmol', 'PO', 'BID'],
      ['MAGNESIUM OXIDE', 'MAGNESIUM', ['Magnesium oxide'], 400, 'mg', 'PO', 'BID'],
      ['METOCLOPRAMIDE', 'PROPULSIVES', ['Metoclopramide'], 10, 'mg', 'PO', 'TID'],
      ['DOCUSATE SODIUM', 'SOFTENERS, EMOLLIENTS', ['Docusate'], 100, 'mg', 'PO', 'BID'],
      ['SENNA GLYCOSIDES', 'CONTACT LAXATIVES', ['Senna', 'Sennosides'], 15, 'mg', 'PO', 'once daily'],
      ['MEGESTROL', 'PROGESTOGENS', ['Megestrol acetate'], 160, 'mg', 'PO', 'once daily'],
      ['HYDROCORTISONE', 'CORTICOSTEROIDS, WEAK (GROUP I)', ['Hydrocortisone 1% cream'], null, null, 'Topical', 'BID'],
      ['DOXYCYCLINE', 'TETRACYCLINES', ['Doxycycline'], 100, 'mg', 'PO', 'BID'],
      ['CETIRIZINE', 'OTHER ANTIHISTAMINES FOR SYSTEMIC USE', ['Cetirizine'], 10, 'mg', 'PO', 'once daily'],
      ['OSIMERTINIB', 'EPIDERMAL GROWTH FACTOR RECEPTOR (EGFR) TYROSINE KINASE INHIBITORS', ['Osimertinib'], 80, 'mg', 'PO', 'once daily'],
    ] as [string, string, string[], number | null, string | null, string, string | null][]
  ).map(([name, atc, verbatims, dose, unit, route, freq]) => [name, { name, atc, verbatims, dose, unit, route, freq }]),
);

/** AE PT → rescue medication(s) (name, probability given the AE). */
export const AE_MEDS: Record<string, { med: string; p: number }[]> = {
  Diarrhea: [{ med: 'LOPERAMIDE', p: 0.8 }],
  Neutropenia: [{ med: 'FILGRASTIM', p: 0.35 }],
  'Febrile neutropenia': [{ med: 'FILGRASTIM', p: 0.7 }, { med: 'CEFTRIAXONE', p: 0.6 }],
  Nausea: [{ med: 'METOCLOPRAMIDE', p: 0.4 }],
  Vomiting: [{ med: 'METOCLOPRAMIDE', p: 0.3 }],
  Hypertension: [{ med: 'AMLODIPINE', p: 0.7 }],
  Pneumonia: [{ med: 'AMOXICILLIN;CLAVULANIC ACID', p: 0.5 }, { med: 'CEFTRIAXONE', p: 0.5 }, { med: 'LEVOFLOXACIN', p: 0.3 }],
  Sepsis: [{ med: 'CEFTRIAXONE', p: 0.9 }],
  'Urinary tract infection': [{ med: 'AMOXICILLIN;CLAVULANIC ACID', p: 0.7 }],
  'Pulmonary embolism': [{ med: 'ENOXAPARIN', p: 0.8 }, { med: 'APIXABAN', p: 0.4 }],
  Pneumonitis: [{ med: 'PREDNISONE', p: 0.8 }, { med: 'METHYLPREDNISOLONE', p: 0.3 }],
  Hypokalemia: [{ med: 'POTASSIUM CHLORIDE', p: 0.8 }],
  Hypomagnesemia: [{ med: 'MAGNESIUM OXIDE', p: 0.7 }],
  Constipation: [{ med: 'DOCUSATE SODIUM', p: 0.4 }, { med: 'SENNA GLYCOSIDES', p: 0.4 }],
  'Decreased appetite': [{ med: 'MEGESTROL', p: 0.15 }],
  Rash: [{ med: 'HYDROCORTISONE', p: 0.5 }, { med: 'DOXYCYCLINE', p: 0.2 }],
  Pruritus: [{ med: 'CETIRIZINE', p: 0.5 }],
  Pyrexia: [{ med: 'PARACETAMOL', p: 0.6 }],
  Headache: [{ med: 'PARACETAMOL', p: 0.6 }],
  Arthralgia: [{ med: 'PARACETAMOL', p: 0.5 }],
  'Back pain': [{ med: 'PARACETAMOL', p: 0.5 }, { med: 'OXYCODONE', p: 0.2 }],
  Insomnia: [{ med: 'ZOLPIDEM', p: 0.5 }],
};

/** Raw EDC text → CDISC CT for CM mapping. */
export const ROUTE_MAP: Record<string, string> = { PO: 'ORAL', IV: 'INTRAVENOUS', SC: 'SUBCUTANEOUS', Inhaled: 'RESPIRATORY (INHALATION)', Topical: 'TOPICAL' };
export const FREQ_MAP: Record<string, string> = { 'once daily': 'QD', BID: 'BID', TID: 'TID', PRN: 'PRN', QHS: 'QHS', once: 'ONCE', 'every 3 weeks': 'EVERY 3 WEEKS' };
export const UNIT_MAP: Record<string, string> = { mg: 'mg', mcg: 'ug', g: 'g', mmol: 'mmol', puff: 'PUFF' };
