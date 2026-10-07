/**
 * data/oncology/manifest.json — dataset + column metadata for every generated
 * file (validated against DatasetManifestSchema in src/content/schema.ts).
 * Column types are inferred from the data; labels, roles, origins, codelists
 * and derivations come from the dictionaries below.
 */
import type { Table, Cell } from './csv.ts';

interface Col {
  name: string;
  label: string;
  type: 'char' | 'num' | 'date' | 'datetime';
  role?: string;
  origin?: string;
  codelist?: string;
  derivation?: string;
  notes?: string;
}

const isISO = (v: string) => /^\d{4}-\d\d-\d\d$/.test(v);
const isISODT = (v: string) => /^\d{4}-\d\d-\d\dT\d\d:\d\d$/.test(v);

function inferType(name: string, values: Cell[]): Col['type'] {
  const vals = values.filter((v) => v !== null && v !== undefined && v !== '') as (string | number)[];
  if (!vals.length) return 'char';
  if (/^(SUBJID|SITEID|RECORD_ID|SUBJECT_ID|SITE_ID|KIT_NUMBER|RAND_NO|AE_LINE|CM_LINE|MH_LINE|CYCLE|BIRTH_YEAR|AGE_|IDVARVAL|SRCSEQ)$/.test(name)) {
    if (name === 'SRCSEQ') return 'num';
    return 'char';
  }
  const strs = vals.map(String);
  if (strs.every(isISO)) return 'date';
  if (strs.every((v) => isISODT(v) || isISO(v))) return 'datetime';
  if (vals.every((v) => typeof v === 'number' || (typeof v === 'string' && v !== '' && !Number.isNaN(Number(v))))) return 'num';
  return 'char';
}

/* ---------------- labels ---------------- */
const L: Record<string, string> = {
  STUDYID: 'Study Identifier', DOMAIN: 'Domain Abbreviation', USUBJID: 'Unique Subject Identifier', SUBJID: 'Subject Identifier for the Study',
  SITEID: 'Study Site Identifier', RFSTDTC: 'Subject Reference Start Date/Time', RFENDTC: 'Subject Reference End Date/Time', RFXSTDTC: 'Date/Time of First Study Treatment',
  RFXENDTC: 'Date/Time of Last Study Treatment', RFICDTC: 'Date/Time of Informed Consent', RFPENDTC: 'Date/Time of End of Participation', DTHDTC: 'Date/Time of Death',
  DTHFL: 'Subject Death Flag', BRTHDTC: 'Date/Time of Birth', AGE: 'Age', AGEU: 'Age Units', SEX: 'Sex', RACE: 'Race', ETHNIC: 'Ethnicity', ARMCD: 'Planned Arm Code',
  ARM: 'Description of Planned Arm', ACTARMCD: 'Actual Arm Code', ACTARM: 'Description of Actual Arm', ARMNRS: 'Reason Arm and/or Actual Arm is Null',
  ACTARMUD: 'Description of Unplanned Actual Arm', COUNTRY: 'Country', DMDTC: 'Date/Time of Collection', DMDY: 'Study Day of Collection',
  RDOMAIN: 'Related Domain Abbreviation', IDVAR: 'Identifying Variable', IDVARVAL: 'Identifying Variable Value', QNAM: 'Qualifier Variable Name',
  QLABEL: 'Qualifier Variable Label', QVAL: 'Data Value', QORIG: 'Origin', QEVAL: 'Evaluator',
  AESEQ: 'Sequence Number', AESPID: 'Sponsor-Defined Identifier', AETERM: 'Reported Term for the Adverse Event', AEDECOD: 'Dictionary-Derived Term',
  AEBODSYS: 'Body System or Organ Class', AESOC: 'Primary System Organ Class', AESER: 'Serious Event', AEACN: 'Action Taken with Study Treatment',
  AEREL: 'Causality', AEOUT: 'Outcome of Adverse Event', AESCONG: 'Congenital Anomaly or Birth Defect', AESDISAB: 'Persist or Signif Disability/Incapacity',
  AESDTH: 'Results in Death', AESHOSP: 'Requires or Prolongs Hospitalization', AESLIFE: 'Is Life Threatening', AESMIE: 'Other Medically Important Serious Event',
  AETOXGR: 'Standard Toxicity Grade', AESTDTC: 'Start Date/Time of Adverse Event', AEENDTC: 'End Date/Time of Adverse Event', AESTDY: 'Study Day of Start of Adverse Event',
  AEENDY: 'Study Day of End of Adverse Event', AEENRTPT: 'End Relative to Reference Time Point', AEENTPT: 'End Reference Time Point',
  CMSEQ: 'Sequence Number', CMSPID: 'Sponsor-Defined Identifier', CMTRT: 'Reported Name of Drug, Med, or Therapy', CMDECOD: 'Standardized Medication Name',
  CMCAT: 'Category for Medication', CMCLAS: 'Medication Class', CMINDC: 'Indication', CMDOSE: 'Dose per Administration', CMDOSU: 'Dose Units',
  CMDOSFRQ: 'Dosing Frequency per Interval', CMROUTE: 'Route of Administration', CMSTDTC: 'Start Date/Time of Medication', CMENDTC: 'End Date/Time of Medication',
  CMSTDY: 'Study Day of Start of Medication', CMENDY: 'Study Day of End of Medication', CMENRTPT: 'End Relative to Reference Time Point', CMENTPT: 'End Reference Time Point',
  MHSEQ: 'Sequence Number', MHSPID: 'Sponsor-Defined Identifier', MHTERM: 'Reported Term for the Medical History', MHDECOD: 'Dictionary-Derived Term',
  MHBODSYS: 'Body System or Organ Class', MHCAT: 'Category for Medical History', MHSTDTC: 'Start Date/Time of Medical History Event',
  MHENRTPT: 'End Relative to Reference Time Point', MHENTPT: 'End Reference Time Point', MHDTC: 'Date/Time of History Collection',
  EXSEQ: 'Sequence Number', EXREFID: 'Reference ID', EXTRT: 'Name of Treatment', EXDOSE: 'Dose per Administration', EXDOSU: 'Dose Units',
  EXDOSFRM: 'Dose Form', EXDOSFRQ: 'Dosing Frequency per Interval', EXROUTE: 'Route of Administration', EXADJ: 'Reason for Dose Adjustment',
  EXSTDTC: 'Start Date/Time of Treatment', EXENDTC: 'End Date/Time of Treatment', EXSTDY: 'Study Day of Start of Treatment', EXENDY: 'Study Day of End of Treatment',
  LBSEQ: 'Sequence Number', LBREFID: 'Specimen ID', LBTESTCD: 'Lab Test or Examination Short Name', LBTEST: 'Lab Test or Examination Name', LBCAT: 'Category for Lab Test',
  LBORRES: 'Result or Finding in Original Units', LBORRESU: 'Original Units', LBORNRLO: 'Reference Range Lower Limit in Orig Unit', LBORNRHI: 'Reference Range Upper Limit in Orig Unit',
  LBSTRESC: 'Character Result/Finding in Std Format', LBSTRESN: 'Numeric Result/Finding in Standard Units', LBSTRESU: 'Standard Units',
  LBSTNRLO: 'Reference Range Lower Limit-Std Units', LBSTNRHI: 'Reference Range Upper Limit-Std Units', LBNRIND: 'Reference Range Indicator', LBSTAT: 'Completion Status',
  LBREASND: 'Reason Test Not Done', LBNAM: 'Vendor Name', LBSPEC: 'Specimen Type', LBLOBXFL: 'Last Observation Before Exposure Flag', LBDTC: 'Date/Time of Specimen Collection',
  LBDY: 'Study Day of Specimen Collection',
  VSSEQ: 'Sequence Number', VSTESTCD: 'Vital Signs Test Short Name', VSTEST: 'Vital Signs Test Name', VSPOS: 'Vital Signs Position of Subject',
  VSORRES: 'Result or Finding in Original Units', VSORRESU: 'Original Units', VSSTRESC: 'Character Result/Finding in Std Format', VSSTRESN: 'Numeric Result/Finding in Standard Units',
  VSSTRESU: 'Standard Units', VSLOBXFL: 'Last Observation Before Exposure Flag', VSDTC: 'Date/Time of Measurements', VSDY: 'Study Day of Vital Signs',
  EGSEQ: 'Sequence Number', EGTESTCD: 'ECG Test or Examination Short Name', EGTEST: 'ECG Test or Examination Name', EGORRES: 'Result or Finding in Original Units',
  EGORRESU: 'Original Units', EGSTRESC: 'Character Result/Finding in Std Format', EGSTRESN: 'Numeric Result/Finding in Standard Units', EGSTRESU: 'Standard Units',
  EGLOBXFL: 'Last Observation Before Exposure Flag', EGDTC: 'Date/Time of ECG', EGDY: 'Study Day of ECG',
  RSSEQ: 'Sequence Number', RSLNKGRP: 'Link Group ID', RSTESTCD: 'Response Assessment Short Name', RSTEST: 'Response Assessment Name', RSCAT: 'Category for Response Assessment',
  RSORRES: 'Response Assessment Original Result', RSSTRESC: 'Character Result/Finding in Std Format', RSSTRESN: 'Numeric Finding in Standard Units', RSEVAL: 'Evaluator',
  RSLOBXFL: 'Last Observation Before Exposure Flag', RSDTC: 'Date/Time of Assessment', RSDY: 'Study Day of Assessment',
  TRSEQ: 'Sequence Number', TRLNKGRP: 'Link Group ID', TRTESTCD: 'Tumor/Lesion Assessment Short Name', TRTEST: 'Tumor/Lesion Assessment Name',
  TRORRES: 'Result or Finding in Original Units', TRORRESU: 'Original Units', TRSTRESC: 'Character Result/Finding in Std Format', TRSTRESN: 'Numeric Finding in Standard Units',
  TRSTRESU: 'Standard Units', TRSTAT: 'Completion Status', TRREASND: 'Reason Not Done', TRMETHOD: 'Method of Test or Examination', TREVAL: 'Evaluator',
  TRLOBXFL: 'Last Observation Before Exposure Flag', TRDTC: 'Date/Time of Tumor Measurement', TRDY: 'Study Day of Tumor Measurement',
  DSSEQ: 'Sequence Number', DSTERM: 'Reported Term for the Disposition Event', DSDECOD: 'Standardized Disposition Term', DSCAT: 'Category for Disposition Event',
  DSSCAT: 'Subcategory for Disposition Event', DSSTDTC: 'Start Date/Time of Disposition Event', DSSTDY: 'Study Day of Start of Disposition Event',
  DVSEQ: 'Sequence Number', DVREFID: 'Reference ID', DVTERM: 'Protocol Deviation Term', DVCAT: 'Category for Protocol Deviation', DVSCAT: 'Subcategory for Protocol Deviation',
  DVSTDTC: 'Start Date/Time of Deviation', DVSTDY: 'Study Day of Start of Deviation',
  DDSEQ: 'Sequence Number', DDTESTCD: 'Death Diagnosis Short Name', DDTEST: 'Death Diagnosis Name', DDORRES: 'Result or Finding in Original Units',
  DDSTRESC: 'Character Result/Finding in Std Format', DDDTC: 'Date/Time of Collection', DDDY: 'Study Day of Collection',
  SSSEQ: 'Sequence Number', SSTESTCD: 'Subject Status Short Name', SSTEST: 'Subject Status Name', SSORRES: 'Result or Finding in Original Units',
  SSSTRESC: 'Character Result/Finding in Std Format', SSDTC: 'Date/Time of Assessment', SSDY: 'Study Day of Assessment',
  VISITNUM: 'Visit Number', VISIT: 'Visit Name', EPOCH: 'Epoch', SVUPDES: 'Description of Unplanned Visit', SVSTDTC: 'Start Date/Time of Visit',
  SVENDTC: 'End Date/Time of Visit', SVSTDY: 'Study Day of Start of Visit', SVENDY: 'Study Day of End of Visit',
  SESEQ: 'Sequence Number', ETCD: 'Element Code', ELEMENT: 'Description of Element', SEUPDES: 'Description of Unplanned Element', TAETORD: 'Planned Order of Element within Arm',
  SESTDTC: 'Start Date/Time of Element', SEENDTC: 'End Date/Time of Element', SESTDY: 'Study Day of Start of Element', SEENDY: 'Study Day of End of Element',
  TABRANCH: 'Branch', TATRANS: 'Transition Rule', TESTRL: 'Rule for Start of Element', TEENRL: 'Rule for End of Element', TEDUR: 'Planned Duration of Element',
  TSSEQ: 'Sequence Number', TSPARMCD: 'Trial Summary Parameter Short Name', TSPARM: 'Trial Summary Parameter', TSVAL: 'Parameter Value',
};

/* ---------------- ADaM labels ---------------- */
const AL: Record<string, string> = {
  REGION1: 'Geographic Region 1', AGEGR1: 'Pooled Age Group 1', AGEGR1N: 'Pooled Age Group 1 (N)', HEIGHTBL: 'Baseline Height (cm)', WEIGHTBL: 'Baseline Weight (kg)',
  BMIBL: 'Baseline BMI (kg/m2)', BSABL: 'Baseline BSA (m2)', ECOGBL: 'Baseline ECOG Performance Status', HISTOL: 'Histology', PDL1CAT: 'PD-L1 TPS Category',
  PRIORIO: 'Prior Anti-PD-(L)1 Therapy', PRLINES: 'Number of Prior Lines of Therapy', BRAINMET: 'Brain Metastases at Baseline', SMOKSTAT: 'Smoking Status',
  STRAT1R: 'Stratum 1 as Randomized (ECOG PS)', STRAT2R: 'Stratum 2 as Randomized (Prior Anti-PD-(L)1)', TRT01P: 'Planned Treatment for Period 01',
  TRT01PN: 'Planned Treatment for Period 01 (N)', TRT01A: 'Actual Treatment for Period 01', TRT01AN: 'Actual Treatment for Period 01 (N)', RANDDT: 'Date of Randomization',
  TRTSDT: 'Date of First Exposure to Treatment', TRTSDTM: 'Datetime of First Exposure to Treatment', TRTEDT: 'Date of Last Exposure to Treatment',
  TRTDURD: 'Total Treatment Duration (days)', EOTSTT: 'End of Treatment Status', DCTREAS: 'Reason for Discontinuation of Treatment', DCTDT: 'Date of Treatment Discontinuation',
  EOSSTT: 'End of Study Status', DCSREAS: 'Reason for Discontinuation from Study', EOSDT: 'End of Study Date', DTHFL: 'Subject Death Flag', DTHDT: 'Date of Death',
  DTHCAUS: 'Cause of Death', LSTALVDT: 'Date Last Known Alive', RANDFL: 'Randomized Population Flag', ITTFL: 'Intent-To-Treat Population Flag',
  SAFFL: 'Safety Population Flag', EFFFL: 'Efficacy Population Flag', PPROTFL: 'Per-Protocol Population Flag', DCUTDT: 'Data Cutoff Date',
  TRTA: 'Actual Treatment', TRTAN: 'Actual Treatment (N)', TRTP: 'Planned Treatment', TRTPN: 'Planned Treatment (N)',
  ASTDT: 'Analysis Start Date', ASTDTF: 'Analysis Start Date Imputation Flag', AENDT: 'Analysis End Date', AENDTF: 'Analysis End Date Imputation Flag',
  ASTDY: 'Analysis Start Relative Day', AENDY: 'Analysis End Relative Day', ADURN: 'Analysis Duration (N)', ADURU: 'Analysis Duration Units',
  ATOXGR: 'Analysis Toxicity Grade', ATOXGRN: 'Analysis Toxicity Grade (N)', AREL: 'Analysis Causality', AERELDOC: 'Causality to Docetaxel', AEACNDOC: 'Action Taken with Docetaxel',
  TRTEMFL: 'Treatment Emergent Analysis Flag', AOCCFL: '1st Occurrence of Any TEAE Flag', AOCCSFL: '1st Occurrence of SOC Flag', AOCCPFL: '1st Occurrence of Preferred Term Flag',
  PARAM: 'Parameter', PARAMCD: 'Parameter Code', PARAMN: 'Parameter (N)', PARCAT1: 'Parameter Category 1', AVAL: 'Analysis Value', AVALC: 'Analysis Value (C)',
  AVALU: 'Analysis Value Unit', ADT: 'Analysis Date', ADTM: 'Analysis Datetime', ADY: 'Analysis Relative Day', AVISIT: 'Analysis Visit', AVISITN: 'Analysis Visit (N)',
  ABLFL: 'Baseline Record Flag', BASE: 'Baseline Value', CHG: 'Change from Baseline', PCHG: 'Percent Change from Baseline', ANRLO: 'Analysis Normal Range Lower Limit',
  ANRHI: 'Analysis Normal Range Upper Limit', ANRIND: 'Analysis Reference Range Indicator', BNRIND: 'Baseline Reference Range Indicator', BTOXGR: 'Baseline Toxicity Grade',
  BTOXGRN: 'Baseline Toxicity Grade (N)', ONTRTFL: 'On Treatment Record Flag', ANL01FL: 'Analysis Flag 01', SRCDOM: 'Source Data Domain', SRCVAR: 'Source Variable',
  SRCSEQ: 'Source Sequence Number', STARTDT: 'Time-to-Event Origin Date', CNSR: 'Censor', EVNTDESC: 'Event or Censoring Description', CNSDTDSC: 'Censor Date Description',
  MCRIT1: 'Analysis Multi-Response Criterion 1', MCRIT1ML: 'Multi-Response Criterion 1 Evaluation', MCRIT1MN: 'Multi-Response Criterion 1 Evaluation (N)',
  MCRIT2: 'Analysis Multi-Response Criterion 2', MCRIT2ML: 'Multi-Response Criterion 2 Evaluation', MCRIT2MN: 'Multi-Response Criterion 2 Evaluation (N)',
};

/* ---------------- raw labels ---------------- */
const RL: Record<string, string> = {
  RECORD_ID: 'Export record identifier (unique within file)', SITE_ID: 'Site number as entered', SUBJECT_ID: 'Subject number as entered (SITE-NNNN)',
  CONSENT_DATE: 'Date informed consent signed (EDC text date)', ICF_VERSION: 'Informed consent form version', ELIGIBLE: 'Eligible for randomization (Y/N)',
  SCREEN_FAIL_REASON: 'Screen failure reason (free text)', SCREEN_FAIL_DATE: 'Screen failure date', BIRTH_YEAR: 'Year of birth', AGE: 'Age at informed consent (years)',
  SEX: 'Sex as entered (site-specific coding)', RACE_WHITE: 'Race checkbox: White', RACE_ASIAN: 'Race checkbox: Asian', RACE_BLACK: 'Race checkbox: Black or African American',
  RACE_AMIND: 'Race checkbox: American Indian or Alaska Native', RACE_NHPI: 'Race checkbox: Native Hawaiian or Other Pacific Islander', RACE_OTHER: 'Race checkbox: Other',
  RACE_OTHER_SP: 'Race, other (specify)', RACE_NOT_REPORTED: 'Race checkbox: not reported / not permitted', ETHNICITY: 'Ethnicity as entered', COUNTRY: 'Country name as entered',
  HISTOLOGY: 'Histology as entered', STAGE: 'Disease stage at study entry', DIAG_DATE: 'Date of initial diagnosis (often partial)', PDL1_TPS: 'PD-L1 tumor proportion score (%)',
  PRIOR_LINES: 'Number of prior systemic therapy lines', PRIOR_IO: 'Prior anti-PD-(L)1 therapy (Y/N)', BRAIN_METS: 'Brain metastases (Y/N)', SMOKING: 'Smoking status',
  ECOG_SCREEN: 'ECOG performance status at screening', RAND_NO: 'IxRS randomization number', RAND_DATE: 'Randomization date (IxRS, ISO)', STRAT_ECOG: 'Stratum: ECOG PS entered in IxRS',
  STRAT_PRIOR_IO: 'Stratum: prior anti-PD-(L)1 entered in IxRS', ARM_ASSIGNED: 'Treatment arm assigned by IxRS', KIT_NUMBER: 'Kit number', KIT_CONTENT: 'Kit content',
  LOT_NUMBER: 'Lot number', CYCLE: 'Cycle number', DRUG_NAME_ENTERED: 'Study drug name as typed by the site (free text)', START_DATE: 'Dosing interval start date',
  START_TIME: 'Time of first dose (Cycle 1 only)', END_DATE: 'Dosing interval end date', DOSE_MG: 'Daily dose (mg)', DOSE_CHANGE_REASON: 'Reason for dose change / interruption',
  INFUSION_DATE: 'Docetaxel infusion date', INFUSION_START_TIME: 'Infusion start time', BSA: 'Body surface area used for dosing (m2)', PLANNED_DOSE_MG_M2: 'Planned docetaxel dose (mg/m2)',
  ACTUAL_DOSE_MG: 'Actual docetaxel dose administered (mg)', AE_LINE: 'AE log line number', AE_TERM: 'Adverse event verbatim term', AE_START: 'AE start date (EDC text, may be partial)',
  AE_END: 'AE end date (EDC text, may be partial)', AE_ONGOING: 'AE ongoing (Y/N)', AE_GRADE: 'CTCAE grade (1-5)', AE_SERIOUS: 'Serious adverse event (Y/N)',
  AE_SER_DEATH: 'Seriousness criterion: results in death', AE_SER_LIFE_THREAT: 'Seriousness criterion: life threatening', AE_SER_HOSP: 'Seriousness criterion: hospitalization',
  AE_SER_DISAB: 'Seriousness criterion: disability', AE_SER_CONG_ANOM: 'Seriousness criterion: congenital anomaly', AE_SER_MED_IMPORTANT: 'Seriousness criterion: other medically important',
  AE_REL_CBX: 'Causality to CBX-417/placebo as entered', AE_REL_DOC: 'Causality to docetaxel as entered', AE_ACTION_CBX: 'Action taken with CBX-417/placebo',
  AE_ACTION_DOC: 'Action taken with docetaxel', AE_OUTCOME: 'Outcome as entered', CODED_PT: 'Coded preferred term (MedDRA-like, illustrative)',
  CODED_SOC: 'Coded system organ class (MedDRA-like, illustrative)', CM_LINE: 'Medication log line number', CM_TERM: 'Medication verbatim term', CM_INDICATION: 'Indication as entered',
  CM_DOSE: 'Dose as entered', CM_UNIT: 'Dose unit as entered', CM_ROUTE: 'Route as entered', CM_FREQ: 'Frequency as entered', CM_START: 'Medication start date (may be partial)',
  CM_END: 'Medication end date (may be partial)', CM_ONGOING: 'Medication ongoing (Y/N)', CM_CATEGORY: 'Medication category', CODED_NAME: 'Coded generic drug name',
  CODED_ATC_CLASS: 'Coded ATC-like drug class text', MH_LINE: 'Medical history line number', MH_TERM: 'Medical history verbatim term', MH_START: 'Condition start date (often partial)',
  MH_ONGOING: 'Condition ongoing (Y/N)', VISIT_NAME: 'Visit name as recorded in the source system', COLLECTION_DATE: 'Sample collection date (vendor ISO date)',
  COLLECTION_TIME: 'Sample collection time', VENDOR_TEST_CODE: 'Laboratory vendor test code', TEST_NAME: 'Laboratory test name as reported', RESULT: 'Result as reported',
  UNIT: 'Unit as reported', REF_LOW: 'Reference range lower limit as reported', REF_HIGH: 'Reference range upper limit as reported', RESULT_COMMENT: 'Laboratory comment',
  LAB_SOURCE: 'Laboratory source (CENTRAL/LOCAL)', ACCESSION_NO: 'Laboratory accession number', VS_DATE: 'Vital signs date', VS_TIME: 'Vital signs time',
  SYSBP: 'Systolic blood pressure', DIABP: 'Diastolic blood pressure', PULSE: 'Pulse rate (beats/min)', TEMP: 'Temperature as recorded', TEMP_UNIT: 'Temperature unit (C/F)',
  WEIGHT: 'Weight as recorded', WEIGHT_UNIT: 'Weight unit (kg/lb)', HEIGHT: 'Height as recorded (screening only)', HEIGHT_UNIT: 'Height unit', ECOG: 'ECOG performance status',
  ECG_DATE: 'ECG date', ECG_TIME: 'ECG time', QTCF_MS: 'QTcF interval (ms)', HR_BPM: 'Heart rate (beats/min)', INTERPRETATION: 'Overall ECG interpretation',
  SCAN_DATE: 'Imaging date', SCAN_METHOD: 'Imaging method (CT/MRI)', TARGET_SLD_MM: 'Sum of diameters of target lesions (mm)', NONTARGET_RESP: 'Non-target lesion response',
  NEW_LESION: 'New lesion present (Y/N)', OVERALL_RESP: 'Overall response per RECIST 1.1 (investigator)', EOT_DATE: 'End of treatment date', LAST_DOSE_DATE: 'Date of last study drug dose',
  EOT_REASON: 'Reason study treatment ended (free text)', EOS_DATE: 'End of study date', EOS_REASON: 'Reason for study discontinuation', DEATH_DATE: 'Date of death',
  DEATH_CAUSE: 'Primary cause of death', DEATH_CAUSE_SPEC: 'Cause of death, specify', CONTACT_DATE: 'Survival contact date', CONTACT_METHOD: 'Contact method',
  STATUS: 'Survival status at contact', NEW_THERAPY: 'New anticancer therapy started (Y/N)', NEW_THERAPY_NAME: 'New anticancer therapy name', NEW_THERAPY_START: 'New anticancer therapy start date',
  DV_ID: 'Deviation identifier (CTMS)', CATEGORY: 'Deviation category', DESCRIPTION: 'Deviation description', DV_DATE: 'Deviation date', SEVERITY: 'Deviation severity (Major/Minor)',
  ISSUE_ID: 'Issue identifier', FILE: 'Raw file containing the issue', COLUMN: 'Column(s) affected', ISSUE_TYPE: 'Issue type', RAW_VALUE: 'Value in the raw export',
  RESOLUTION: 'How the issue was resolved (data-management note)', CORRECTED_VALUE: 'Value used in SDTM after resolution', PROBLEM_NO: 'Problem number in the study specification (section 3)',
  N_RECORDS: 'Number of raw records covered by this entry', RAW_FILE: 'Raw file the SDTM record came from', NOTE: 'Mapping note (conversions, corrections, derivations)',
  SEQ: 'Sequence number (--SEQ) of the SDTM record', NEWLIND: 'New lesion indicator',
};

/* ---------------- roles ---------------- */
function role(ds: string, c: string): string | undefined {
  const layer = ds.split('/')[1];
  if (layer === 'raw') return undefined;
  if (layer === 'adam') {
    if (['STUDYID', 'USUBJID', 'SUBJID', 'SITEID', 'ASEQ'].includes(c)) return 'Identifier';
    if (/FL$/.test(c) || c === 'CNSR') return 'Indicator/Flag';
    if (/^(PARAM|PARAMCD|PARAMN|PARCAT1)$/.test(c)) return 'Analysis Parameter';
    if (/^(AVAL|AVALC|AVALU|BASE|CHG|PCHG|ANRLO|ANRHI|ANRIND|BNRIND|ATOXGR|ATOXGRN|BTOXGR|BTOXGRN|MCRIT.*)$/.test(c)) return 'Analysis Descriptor';
    if (/^(ADT|ADTM|ADY|AVISIT|AVISITN|ASTDT|AENDT|ASTDY|AENDY|STARTDT|TRTSDT|TRTEDT|TRTSDTM|RANDDT|DTHDT|EOSDT|DCTDT|LSTALVDT|DCUTDT|ADURN|ADURU|ASTDTF|AENDTF)$/.test(c)) return 'Timing';
    if (/^(TRT|TRTA|TRTP)/.test(c) || /^(ARM|ACTARM)/.test(c)) return 'Treatment';
    if (/^SRC/.test(c)) return 'Trace';
    return 'Covariate/Descriptor';
  }
  if (['STUDYID', 'DOMAIN', 'USUBJID', 'SUBJID', 'SITEID', 'RDOMAIN', 'IDVAR', 'IDVARVAL'].includes(c) || /SEQ$|SPID$|REFID$|LNKGRP$|GRPID$/.test(c)) return 'Identifier';
  if (/TERM$|TRT$|TESTCD$|PARMCD$/.test(c) && c !== 'EXDOSFRM') return 'Topic';
  if (/DECOD$|TEST$|PARM$|BODSYS$|SOC$/.test(c)) return 'Synonym Qualifier';
  if (/ORRESU$|STRESU$|DOSU$|NRLO$|NRHI$|POS$|SPEC$|METHOD$|EVAL$|CLAS$/.test(c)) return 'Variable Qualifier';
  if (/ORRES$|STRESC$|STRESN$|VAL$|QVAL$/.test(c)) return 'Result Qualifier';
  if (/DTC$|DY$|^VISIT|^EPOCH$|ENRTPT$|ENTPT$|DUR$|TAETORD$/.test(c)) return 'Timing';
  if (/FL$/.test(c)) return 'Record Qualifier';
  return 'Record Qualifier';
}

/* ---------------- codelists ---------------- */
const CODELIST: Record<string, string> = {
  SEX: 'SEX (C66731)', RACE: 'Classic SDTM race values (see notes)', ETHNIC: 'Classic SDTM ethnicity values (see notes)', AGEU: 'AGEU (C66781)',
  ARMNRS: 'ARMNULRS (C142179)', COUNTRY: 'ISO 3166-1 alpha-3', EPOCH: 'EPOCH (C99079)', AEACN: 'ACN (C66767)', AEACNDOC: 'ACN (C66767)', AEOUT: 'OUT (C66768)',
  AESER: 'NY (C66742)', AESDTH: 'NY (C66742)', AESHOSP: 'NY (C66742)', AESLIFE: 'NY (C66742)', AESDISAB: 'NY (C66742)', AESCONG: 'NY (C66742)', AESMIE: 'NY (C66742)',
  AEENRTPT: 'STENRF (C66728)', CMENRTPT: 'STENRF (C66728)', MHENRTPT: 'STENRF (C66728)', CMDOSFRQ: 'FREQ (C71113)', EXDOSFRQ: 'FREQ (C71113)', CMROUTE: 'ROUTE (C66729)',
  EXROUTE: 'ROUTE (C66729)', EXDOSFRM: 'FRM (C66726)', CMDOSU: 'UNIT (C71620)', EXDOSU: 'UNIT (C71620)', LBTESTCD: 'LBTESTCD (C65047)', LBTEST: 'LBTEST (C67154)',
  LBORRESU: 'UNIT (C71620)', LBSTRESU: 'UNIT (C71620)', LBNRIND: 'NRIND (C78736)', LBSTAT: 'ND (C66789)', LBSPEC: 'SPECTYPE (C78734)', VSTESTCD: 'VSTESTCD (C66741)',
  VSTEST: 'VSTEST (C67153)', VSORRESU: 'VSRESU (C66770)', VSSTRESU: 'VSRESU (C66770)', VSPOS: 'POSITION (C71148)', EGTESTCD: 'EGTESTCD (C71153)', EGTEST: 'EGTEST (C71152)',
  EGORRESU: 'UNIT (C71620)', EGSTRESU: 'UNIT (C71620)', RSTESTCD: 'ONCRTSCD (C96782) / ECOG1TC (C101815)', RSTEST: 'ONCRTS (C96783) / ECOG1TN (C101816)',
  RSORRES: 'ONCRSR (C96785) / ECOG101OR (C179943)', RSSTRESC: 'ONCRSR (C96785) / ECOG101STR (C179944)', RSCAT: 'CCCAT (C118971) for ECOG; RECIST 1.1 (sponsor)',
  RSEVAL: 'EVAL (C78735)', TREVAL: 'EVAL (C78735)', TRTESTCD: 'TRTESTCD (C96779)', TRTEST: 'TRTEST (C96780)', TRMETHOD: 'METHOD (C85492)', TRSTAT: 'ND (C66789)',
  DSCAT: 'DSCAT (C74558)', DSSCAT: 'DSSCAT (C170443)', DSDECOD: 'NCOMPLT (C66727) / PROTMLST (C114118)', SSTESTCD: 'SSTESTCD (C124305)', SSTEST: 'SSTEST (C124306)',
  SSORRES: 'SSTATRS (C124304)', SSSTRESC: 'SSTATRS (C124304)', DDTESTCD: 'DTHDXCD (C116108)', DDTEST: 'DTHDX (C116109)', TSPARMCD: 'TSPARMCD (C66738)', TSPARM: 'TSPARM (C66734)',
  DTHFL: 'NY (C66742)', LBLOBXFL: 'NY (C66742)', VSLOBXFL: 'NY (C66742)', EGLOBXFL: 'NY (C66742)', TRLOBXFL: 'NY (C66742)', RSLOBXFL: 'NY (C66742)',
  ASTDTF: 'DATEFL (C81223)', AENDTF: 'DATEFL (C81223)', EOTSTT: 'SBJTSTAT (C124296)', EOSSTT: 'SBJTSTAT (C124296)', DCTREAS: 'NCOMPLT (C66727)', DCSREAS: 'NCOMPLT (C66727)',
  SAFFL: 'NY (C66742)', ITTFL: 'NY (C66742)', EFFFL: 'NY (C66742)', PPROTFL: 'NY (C66742)', RANDFL: 'NY (C66742)',
};

/* ---------------- origins ---------------- */
function origin(ds: string, c: string): string | undefined {
  const layer = ds.split('/')[1];
  if (layer === 'raw') return 'Collected';
  if (layer === 'adam') return /^(STUDYID|USUBJID|SUBJID|SITEID|AGE|SEX|RACE|ETHNIC|COUNTRY|ARM|ARMCD|ACTARM|ACTARMCD|AE|PARAM|SRC)/.test(c) ? 'Predecessor' : 'Derived';
  if (c === 'STUDYID' || c === 'DOMAIN') return 'Protocol';
  if (/DY$|LOBXFL$|^EPOCH$/.test(c)) return 'Derived';
  if (/^(RF|DTH|ARM|ACTARM)/.test(c) && ds.endsWith('/dm')) return 'Derived';
  if (/SEQ$/.test(c)) return 'Derived';
  if (/^(TA|TE|TS)/.test(c) || ds.endsWith('/ta') || ds.endsWith('/te') || ds.endsWith('/ts')) return 'Protocol';
  if (/STRESC$|STRESN$|STRESU$|STNRLO$|STNRHI$|DECOD$/.test(c)) return 'Derived';
  return 'Collected';
}

/* ---------------- derivations / notes ---------------- */
const DERIV: Record<string, string> = {
  'sdtm.USUBJID': 'STUDYID || "-" || SITEID || "-" || SUBJID (SUBJID itself is "SITEID-NNNN", e.g. 1012-0007).',
  'sdtm.EPOCH': 'From the subject elements (SE): SCREENING before the first dose datetime, TREATMENT from the first dose through the end-of-treatment visit (or last dose), FOLLOW-UP afterwards. Pre-dose samples on the day of first dose fall in SCREENING because collection times are compared with the first-dose time.',
  'sdtm.--DY': 'Study day = date - RFSTDTC date + 1 when the date is on/after RFSTDTC, otherwise date - RFSTDTC (no day 0).',
  'sdtm.--LOBXFL': 'Y on the last non-missing result for the subject and test with a collection datetime before the first exposure datetime (RFXSTDTC). Null for subjects who were never exposed. --BLFL (Permissible) is deliberately omitted; baseline selection is an ADaM decision (ABLFL).',
  'dm.RFSTDTC': 'First exposure to study treatment (datetime). Convention for the 4 randomized-but-never-treated subjects: the randomization date is used so that --DY can be computed; RFXSTDTC stays null.',
  'dm.RFENDTC': 'Date of the end-of-study disposition event, or the last contact date on or before the data cutoff for subjects still in follow-up. Null for screen failures.',
  'dm.RFXSTDTC': 'Datetime of the first dose of any study treatment (EX).',
  'dm.RFXENDTC': 'Date of the last dose of any study treatment (max EXENDTC).',
  'dm.RFPENDTC': 'End of participation: end-of-study date, last contact on/before the cutoff, or the screen-failure date.',
  'dm.DTHFL': 'Y when DTHDTC is populated.',
  'dm.AGE': 'Age in years at informed consent, as collected on the demographics form.',
  'dm.RACE': 'One checkbox ticked → that race; more than one → MULTIPLE (individual values in SUPPDM RACE1/RACE2); "not reported" checkbox → NOT REPORTED.',
  'dm.ARMNRS': 'SCREEN FAILURE for non-randomized subjects, ASSIGNED, NOT TREATED for randomized subjects who were never dosed, UNPLANNED TREATMENT when the treatment received does not match a planned arm (dispensing error).',
  'dm.ACTARMCD': 'Arm actually received, from the kit content in EX. Null with ARMNRS = UNPLANNED TREATMENT for the two subjects who received a mix of placebo and CBX-417 kits; ACTARMUD then describes what was received.',
  'lb.LBSTRESN': 'Result converted to standard (SI) units: local laboratories reporting conventional units are converted (bilirubin mg/dL x 17.1, creatinine mg/dL x 88.4, hemoglobin g/dL x 10); central results are already in SI units.',
  'lb.LBNRIND': 'LOW / NORMAL / HIGH by comparing LBSTRESN with LBSTNRLO and LBSTNRHI.',
  'vs.VSSTRESN': 'Standardized result: temperature recorded in F is converted to C ((F - 32) x 5/9) and weight recorded in lb to kg (x 0.45359237); VSORRES/VSORRESU keep the values as collected.',
  'ex.EXTRT': 'Actual content of the dispensed kit (kit number joined to the IxRS kit list) - not the arm the subject was randomized to.',
  'ex.EXADJ': 'Reason for dose reduction or interruption as recorded on the dosing page.',
  'rs.RSSTRESC': 'Investigator overall response per RECIST 1.1 (CR/PR/SD/PD/NE); ECOG records carry the numeric grade as character.',
  'tr.TRSTRESN': 'Sum of diameters of target lesions in mm, as measured by the investigator (SUMDIAM is collected on the CRF; individual lesions are not included - educational simplification).',
  'ds.DSDECOD': 'Standardized disposition term (NCOMPLT) or protocol milestone (PROTMLST).',
  'ss.SSORRES': 'Survival status at the contact; the raw status "Lost to follow-up" maps to UNKNOWN.',
  'sv.SVSTDTC': 'First date of any record collected at this VISITNUM; SVENDTC is the last date.',
  'se.SESTDTC': 'Element start: consent (SCRN), first dose datetime (treatment element), end of treatment (FU).',
};

const NOTES: Record<string, string> = {
  'sdtm.AEDECOD': 'Coding is MedDRA-like and illustrative (real-looking PT/SOC names, US spelling) with no MedDRA codes or LLT/HLT/HLGT levels - educational simplification.',
  'sdtm.AEBODSYS': 'MedDRA-like SOC name; no MedDRA codes (educational simplification).',
  'sdtm.CMDECOD': 'Generic drug name; no WHO Drug dictionary codes (educational simplification).',
  'sdtm.CMCLAS': 'ATC-like class text; no ATC codes (educational simplification).',
  'sdtm.MHDECOD': 'MedDRA-like preferred term, no codes (educational simplification).',
  'dm.RACE': 'Classic SDTM race values are used. In the NCI CT package dated 2026-03-27 there is no codelist named RACE; the values WHITE, ASIAN, BLACK OR AFRICAN AMERICAN, AMERICAN INDIAN OR ALASKA NATIVE and NOT REPORTED appear in RACEC (Race As Collected), which spells the Pacific Islander value NATIVE HAWAIIAN OR PACIFIC ISLANDER. MULTIPLE follows the SDTMIG convention for more than one race.',
  'dm.ETHNIC': 'HISPANIC OR LATINO / NOT HISPANIC OR LATINO / NOT REPORTED; in the 2026-03-27 CT these values live in ETHNICC (Ethnicity As Collected).',
  'sdtm.VISITNUM': 'Unscheduled visits use the preceding scheduled VISITNUM + 0.01, +0.02 ... within the same schedule (study convention, not a CDISC rule). Tumor-assessment visits are numbered 1000 + nominal week (convention).',
  'sdtm.AEENTPT': 'Reference time point for ongoing events: END OF STUDY for subjects who discontinued, DATA CUTOFF for subjects still in the study (convention).',
  'ds.DSSCAT': 'STUDY TREATMENT / STUDY PARTICIPATION from codelist DSSCAT (C170443).',
  'eg.EGSTRESU': 'The CDISC UNIT codelist submission value for milliseconds is "ms" (synonym "msec"), so EGORRESU/EGSTRESU = ms.',
  'adam.ANL01FL': 'One analysis record per subject, parameter and analysis visit: the scheduled record when present, otherwise the latest unscheduled record within the visit window.',
};

function colMeta(dsId: string, name: string, values: Cell[], extra?: Partial<Col>): Col {
  const layer = dsId.split('/')[1];
  const dom = dsId.split('/')[2];
  const label = extra?.label ?? (layer === 'raw' ? RL[name] : (L[name] ?? AL[name] ?? RL[name])) ?? name;
  const c: Col = { name, label, type: extra?.type ?? inferType(name, values) };
  const rl = extra?.role ?? role(dsId, name);
  if (rl) c.role = rl;
  const or = extra?.origin ?? origin(dsId, name);
  if (or) c.origin = or;
  const cl = extra?.codelist ?? (layer === 'raw' ? undefined : CODELIST[name]);
  if (cl) c.codelist = cl;
  const generic = name.length > 4 && /^(..)(SEQ|DTC|DY|STDTC|ENDTC|STDY|ENDY|LOBXFL)$/.test(name) ? `sdtm.--${name.slice(2)}` : null;
  const der = extra?.derivation ?? DERIV[`${dom}.${name}`] ?? DERIV[`${layer}.${name}`] ?? (generic ? DERIV[generic] : undefined);
  if (der) c.derivation = der;
  const nt = extra?.notes ?? NOTES[`${dom}.${name}`] ?? NOTES[`${layer}.${name}`];
  if (nt) c.notes = nt;
  return c;
}

const DESCRIPTIONS: Record<string, { label: string; structure: string; keys: string[]; description: string }> = {
  'raw/enrollment': { label: 'EDC: enrollment and screening outcome', structure: 'One record per screened subject', keys: ['SITE_ID', 'SUBJECT_ID'], description: 'Informed consent date, eligibility and screen-failure reason for all 468 screened subjects. EDC text dates ("07 MAR 2023").' },
  'raw/demographics': { label: 'EDC: demographics', structure: 'One record per screened subject', keys: ['SITE_ID', 'SUBJECT_ID'], description: 'Age, sex (site-specific coding), race checkboxes, ethnicity and country as entered in the EDC.' },
  'raw/baseline_disease': { label: 'EDC: baseline disease characteristics', structure: 'One record per screened subject', keys: ['SITE_ID', 'SUBJECT_ID'], description: 'Histology, stage, diagnosis date (often partial), PD-L1 TPS, prior lines, prior anti-PD-(L)1, brain metastases, smoking status and screening ECOG.' },
  'raw/randomization': { label: 'IxRS: randomization', structure: 'One record per randomized subject', keys: ['SUBJECT_ID'], description: 'Randomization number, date, stratification factors as entered in the IxRS and the assigned arm. Two records are missing from this export (IxRS transfer gap).' },
  'raw/kit_list': { label: 'IxRS: kit list', structure: 'One record per kit', keys: ['KIT_NUMBER'], description: 'Kit number to kit content (CBX-417 or placebo) - the only way to know what a subject actually received in this blinded study.' },
  'raw/ex_study_drug': { label: 'EDC: CBX-417 / placebo dosing', structure: 'One record per dosing interval', keys: ['SITE_ID', 'SUBJECT_ID', 'CYCLE', 'START_DATE'], description: 'Daily oral study drug by cycle with kit number, dose and reason for change; interruptions appear as gaps between intervals.' },
  'raw/ex_docetaxel': { label: 'EDC: docetaxel infusions', structure: 'One record per infusion', keys: ['SITE_ID', 'SUBJECT_ID', 'CYCLE'], description: 'Docetaxel infusion date/time, BSA, planned mg/m2 and actual mg administered.' },
  'raw/ae': { label: 'EDC: adverse events (with coding)', structure: 'One record per adverse event line', keys: ['SITE_ID', 'SUBJECT_ID', 'AE_LINE'], description: 'Verbatim term, dates (some partial), CTCAE grade, seriousness criteria, causality and action for each study drug, outcome and illustrative MedDRA-like coding.' },
  'raw/cm': { label: 'EDC: concomitant and prior medications', structure: 'One record per medication line', keys: ['SITE_ID', 'SUBJECT_ID', 'CM_LINE'], description: 'Prior cancer therapy, concomitant medications and subsequent anticancer therapy with generic-name coding and ATC-like class text.' },
  'raw/mh': { label: 'EDC: medical history', structure: 'One record per condition', keys: ['SITE_ID', 'SUBJECT_ID', 'MH_LINE'], description: 'Medical history conditions with (frequently partial) start dates and illustrative coding.' },
  'raw/labs': { label: 'Central/local laboratory export', structure: 'One record per test result', keys: ['SUBJECT_ID', 'ACCESSION_NO', 'VENDOR_TEST_CODE'], description: 'Vendor laboratory data with vendor test codes (different from CDISC LBTESTCD), local-laboratory results in conventional units and vendor ISO dates.' },
  'raw/vitals': { label: 'EDC: vital signs (wide form)', structure: 'One record per subject visit', keys: ['SITE_ID', 'SUBJECT_ID', 'VISIT_NAME', 'VS_DATE'], description: 'Wide vital-signs form (one column per measurement) including units as recorded and the ECOG performance status collected on the same page.' },
  'raw/ecg': { label: 'EDC: 12-lead ECG', structure: 'One record per ECG', keys: ['SITE_ID', 'SUBJECT_ID', 'VISIT_NAME', 'ECG_DATE'], description: 'QTcF, heart rate and overall interpretation at screening, Cycle 1 Day 1 (post-dose), Cycle 2/4 Day 1 and end of treatment.' },
  'raw/tumor_assessment': { label: 'EDC: tumor assessments (RECIST 1.1)', structure: 'One record per imaging assessment', keys: ['SITE_ID', 'SUBJECT_ID', 'VISIT_NAME', 'SCAN_DATE'], description: 'Sum of target-lesion diameters, non-target response, new-lesion indicator and investigator overall response.' },
  'raw/eot': { label: 'EDC: end of treatment', structure: 'One record per subject who stopped treatment', keys: ['SITE_ID', 'SUBJECT_ID'], description: 'End-of-treatment date, last dose date and free-text reason (including the four randomized-but-never-treated subjects).' },
  'raw/eos': { label: 'EDC: end of study', structure: 'One record per subject who left the study', keys: ['SITE_ID', 'SUBJECT_ID'], description: 'End-of-study date and reason (death, withdrawal of consent, lost to follow-up).' },
  'raw/death': { label: 'EDC: death report', structure: 'One record per death', keys: ['SITE_ID', 'SUBJECT_ID'], description: 'Date and primary cause of death as reported by the site.' },
  'raw/survival_followup': { label: 'EDC: survival follow-up contacts', structure: 'One record per contact', keys: ['SITE_ID', 'SUBJECT_ID', 'CONTACT_DATE'], description: 'Twelve-weekly survival contacts with status and any new anticancer therapy reported.' },
  'raw/deviations': { label: 'CTMS: protocol deviations', structure: 'One record per deviation', keys: ['DV_ID'], description: 'Protocol deviations with category, description, date and Major/Minor severity as classified by the study team.' },
};

const SDTM_DESC: Record<string, { label: string; structure: string; keys: string[]; description: string }> = {
  dm: { label: 'Demographics', structure: 'One record per subject', keys: ['USUBJID'], description: 'All 468 screened subjects, including screen failures (ARM/ACTARM null with ARMNRS = SCREEN FAILURE) and the four randomized-but-never-treated subjects.' },
  suppdm: { label: 'Supplemental Qualifiers for DM', structure: 'One record per subject per qualifier', keys: ['USUBJID', 'QNAM'], description: 'Baseline disease characteristics (histology, stage, PD-L1 TPS, prior lines, prior anti-PD-(L)1, brain metastases, smoking), randomization number and IxRS stratification factors. Educational simplification: a production study would put several of these in MH/SU or a findings domain.' },
  ae: { label: 'Adverse Events', structure: 'Events; one record per event per subject', keys: ['USUBJID', 'AESEQ'], description: 'Adverse events from consent to 30 days after the last dose (plus later serious events), graded with CTCAE v5-style grades. Coding is MedDRA-like and illustrative, without MedDRA codes.' },
  suppae: { label: 'Supplemental Qualifiers for AE', structure: 'One record per AE per qualifier', keys: ['USUBJID', 'IDVARVAL', 'QNAM'], description: 'Causality (AERELDOC) and action taken (AEACNDOC) for docetaxel, the second study treatment.' },
  cm: { label: 'Concomitant/Prior Medications', structure: 'Interventions; one record per medication per subject', keys: ['USUBJID', 'CMSEQ'], description: 'Prior cancer therapy, concomitant medications and subsequent anticancer therapy (used for the PFS censoring rule).' },
  mh: { label: 'Medical History', structure: 'Events; one record per condition per subject', keys: ['USUBJID', 'MHSEQ'], description: 'Primary NSCLC diagnosis (MHCAT = PRIMARY DIAGNOSIS) and general medical history, including one condition the site entered on the AE page and that was reclassified by query.' },
  ex: { label: 'Exposure', structure: 'Interventions; one record per constant-dose interval', keys: ['USUBJID', 'EXSEQ'], description: 'CBX-417/placebo (daily, by kit) and docetaxel (Day 1 of each cycle). EXTRT reflects the actual kit content, which is how the three dispensing errors become visible.' },
  lb: { label: 'Laboratory Test Results', structure: 'Findings; one record per test per visit', keys: ['USUBJID', 'LBTESTCD', 'VISITNUM'], description: 'Central and local laboratory results with original and SI-standardized values, reference ranges and the last-observation-before-exposure flag.' },
  vs: { label: 'Vital Signs', structure: 'Findings; one record per test per visit', keys: ['USUBJID', 'VSTESTCD', 'VISITNUM'], description: 'Blood pressure, pulse, temperature, weight and (screening) height, standardized to C and kg where sites recorded F or lb.' },
  eg: { label: 'ECG Test Results', structure: 'Findings; one record per test per visit', keys: ['USUBJID', 'EGTESTCD', 'VISITNUM'], description: 'QTcF (aggregate), mean heart rate and overall interpretation. The Cycle 1 Day 1 ECG is post-dose, so the screening ECG carries EGLOBXFL = Y.' },
  rs: { label: 'Disease Response and Clin Classification', structure: 'Findings; one record per assessment per subject', keys: ['USUBJID', 'RSCAT', 'RSTESTCD', 'RSDTC'], description: 'Investigator overall response per RECIST 1.1 (RSCAT = RECIST 1.1) and ECOG performance status (RSCAT = ECOG, RSTESTCD = ECOG101). Non-target response and new-lesion indicator stay in the raw export (educational simplification).' },
  tr: { label: 'Tumor/Lesion Results', structure: 'Findings; one record per assessment per subject', keys: ['USUBJID', 'TRTESTCD', 'TRDTC'], description: 'Sum of diameters (SUMDIAM) per assessment, linked to RS through TRLNKGRP/RSLNKGRP. Individual lesions and the TU domain are omitted (educational simplification).' },
  ds: { label: 'Disposition', structure: 'Events; one record per disposition event or milestone', keys: ['USUBJID', 'DSSEQ'], description: 'Protocol milestones (informed consent, randomization) and disposition events for study treatment and study participation.' },
  dv: { label: 'Protocol Deviations', structure: 'Events; one record per deviation', keys: ['USUBJID', 'DVSEQ'], description: 'Protocol deviations with category and Major/Minor subcategory; major deviations affecting efficacy drive PPROTFL in ADSL.' },
  dd: { label: 'Death Details', structure: 'Findings; one record per death', keys: ['USUBJID', 'DDSEQ'], description: 'Primary cause of death (DDTESTCD = PRCDTH) as reported on the death form.' },
  ss: { label: 'Subject Status', structure: 'Findings; one record per survival contact', keys: ['USUBJID', 'SSSEQ'], description: 'Survival status (ALIVE/DEAD/UNKNOWN) at each 12-weekly follow-up contact; feeds the last-known-alive date used for OS censoring.' },
  sv: { label: 'Subject Visits', structure: 'One record per subject per visit', keys: ['USUBJID', 'VISITNUM'], description: 'Derived visit dates (first and last record collected at each VISITNUM), including unscheduled visits.' },
  se: { label: 'Subject Elements', structure: 'One record per subject per element', keys: ['USUBJID', 'SESEQ'], description: 'Screening, treatment and follow-up elements with actual start/end datetimes; the basis for EPOCH on event and finding records.' },
  ta: { label: 'Trial Arms', structure: 'One record per planned element per arm', keys: ['ARMCD', 'TAETORD'], description: 'Planned sequence of elements for each arm.' },
  te: { label: 'Trial Elements', structure: 'One record per element', keys: ['ETCD'], description: 'Element definitions with start and end rules.' },
  ts: { label: 'Trial Summary', structure: 'One record per trial summary parameter value', keys: ['TSPARMCD', 'TSSEQ'], description: 'Key protocol facts: phase, blinding, control type, stratification factors, planned enrollment, endpoints, data cutoff and standards versions.' },
};

const ADAM_DESC: Record<string, { label: string; structure: string; keys: string[]; description: string }> = {
  adsl: { label: 'Subject-Level Analysis Dataset', structure: 'One record per randomized subject', keys: ['USUBJID'], description: 'All 420 randomized subjects (screen failures are excluded by design). Population flags, treatment variables, stratification factors as randomized, disposition and key baseline characteristics.' },
  adae: { label: 'Adverse Events Analysis Dataset (OCCDS)', structure: 'One record per adverse event per subject', keys: ['USUBJID', 'AESEQ'], description: 'All SDTM AE records for randomized subjects with imputed analysis dates, treatment-emergent flag and first-occurrence flags.' },
  adlb: { label: 'Laboratory Analysis Dataset (BDS)', structure: 'One record per subject, parameter and analysis visit', keys: ['USUBJID', 'PARAMCD', 'AVISITN', 'ADT'], description: 'Laboratory results in SI units with baseline, change, reference-range indicators and CTCAE v5-style toxicity grades.' },
  advs: { label: 'Vital Signs Analysis Dataset (BDS)', structure: 'One record per subject, parameter and analysis visit', keys: ['USUBJID', 'PARAMCD', 'AVISITN', 'ADT'], description: 'Vital-sign parameters with baseline and change from baseline.' },
  adeg: { label: 'ECG Analysis Dataset (BDS)', structure: 'One record per subject, parameter and analysis visit', keys: ['USUBJID', 'PARAMCD', 'AVISITN', 'ADTM'], description: 'QTcF and mean heart rate with baseline (last pre-dose value, using datetimes because the Cycle 1 Day 1 ECG is post-dose) and multi-response criteria for QTcF categories.' },
  adrs: { label: 'Response Analysis Dataset (BDS)', structure: 'One record per subject, parameter and assessment', keys: ['USUBJID', 'PARAMCD', 'ADT'], description: 'Per-visit investigator response (OVRLRESP) plus derived best overall response (BOR, unconfirmed) and confirmed best overall response (CBOR) used for ORR.' },
  adtr: { label: 'Tumor Results Analysis Dataset (BDS)', structure: 'One record per subject, parameter and assessment', keys: ['USUBJID', 'PARAMCD', 'ADT'], description: 'Sum of diameters by visit with baseline, change and percent change, plus the best percent change (BPCHG) used for waterfall plots.' },
  adtte: { label: 'Time-to-Event Analysis Dataset (BDS)', structure: 'One record per subject per time-to-event parameter', keys: ['USUBJID', 'PARAMCD'], description: 'Progression-free survival, overall survival and duration of response (responders only) with censoring reasons, stratification factors and subgroup covariates.' },
};

const ADAM_DERIV: Record<string, string> = {
  'adsl.TRTSDT': 'Date part of the earliest EX record start (any study treatment).',
  'adsl.TRTSDTM': 'Earliest EX start datetime (the Cycle 1 dosing record carries a time), used for ADEG baseline selection.',
  'adsl.TRTEDT': 'Latest EXENDTC across all EX records.',
  'adsl.TRTDURD': 'TRTEDT - TRTSDT + 1 (days).',
  'adsl.WEIGHTBL': 'Last VS WEIGHT (VSSTRESN, kg) on or before TRTSDT; RANDDT is used for subjects who were never treated.',
  'adsl.HEIGHTBL': 'Screening VS HEIGHT (cm).',
  'adsl.BMIBL': 'WEIGHTBL / (HEIGHTBL/100)^2, rounded to 1 decimal.',
  'adsl.BSABL': 'Mosteller: sqrt(HEIGHTBL x WEIGHTBL / 3600), rounded to 2 decimals.',
  'adsl.ECOGBL': 'Last RS ECOG101 (RSSTRESN) on or before TRTSDT (RANDDT if never treated).',
  'adsl.STRAT1R': 'ECOG stratum as entered in the IxRS at randomization (SUPPDM STRATECG) - not the CRF value in ECOGBL; eight subjects were stratified incorrectly and are analyzed as randomized.',
  'adsl.STRAT2R': 'Prior anti-PD-(L)1 stratum as entered in the IxRS (SUPPDM STRATIO).',
  'adsl.TRT01A': 'Actual treatment: CBX-417 + Docetaxel if any EX record has EXTRT = CBX-417, otherwise Placebo + Docetaxel; null for never-treated subjects (SAP rule: any exposure to active drug counts as active).',
  'adsl.LSTALVDT': 'Latest date on or before the data cutoff on which the subject was known to be alive: visit, assessment, dosing and disposition dates plus survival contacts with SSSTRESC = ALIVE (contacts recorded as DEAD or UNKNOWN are excluded).',
  'adsl.SAFFL': 'Y when TRTSDT is not missing (received at least one dose of any study treatment).',
  'adsl.EFFFL': 'Y for ITT subjects with a baseline tumor assessment (TR SUMDIAM on or before randomization) and at least one post-baseline response assessment, or death within 49 days of randomization (first scheduled assessment + window).',
  'adsl.PPROTFL': 'Y for treated subjects without a major deviation in the categories ELIGIBILITY CRITERIA, INVESTIGATIONAL PRODUCT, EFFICACY ASSESSMENT or PROHIBITED THERAPY (DV, DVSCAT = MAJOR).',
  'adsl.EOTSTT': 'DISCONTINUED when a DS record with DSSCAT = STUDY TREATMENT exists, otherwise ONGOING for treated subjects.',
  'adsl.EOSSTT': 'DISCONTINUED when a DS record with DSSCAT = STUDY PARTICIPATION exists, otherwise ONGOING.',
  'adae.ASTDT': 'AESTDTC when complete. Missing day: the first of the month, unless the month equals the month of TRTSDT, in which case TRTSDT is used. Missing month and day: 1 January, unless the year equals the year of TRTSDT, in which case TRTSDT is used. An imputed start is never later than AENDT. ASTDTF records the imputed component (D or M).',
  'adae.AENDT': 'AEENDTC when complete; missing day imputed to the last day of the month, missing month to 31 December, and capped at the death date and the data cutoff. AENDTF records the imputed component.',
  'adae.TRTEMFL': 'Y when ASTDT >= TRTSDT and ASTDT <= TRTEDT + 30 days.',
  'adae.AOCCFL': 'Y on the first treatment-emergent event per subject (chronological by ASTDT, then AESEQ).',
  'adae.AOCCSFL': 'Y on the first treatment-emergent event per subject and system organ class.',
  'adae.AOCCPFL': 'Y on the first treatment-emergent event per subject and preferred term.',
  'adae.AREL': 'AEREL when collected; missing causality is imputed as RELATED (conservative SAP rule) - three events have an unresolved causality query.',
  'adlb.ABLFL': 'Y on the last non-missing result on or before TRTSDT (RANDDT for never-treated subjects); records with LBSTAT = NOT DONE are excluded from ADLB.',
  'adlb.AVISIT': 'BASELINE for the ABLFL record; the collected VISIT for scheduled records; unscheduled records are windowed to the nearest cycle visit (Cycle 1 Day 8: study days 2-11; Cycle n Day 1: target day 1 + 21(n-1) +/- 10 days) and left blank after the treatment period.',
  'adlb.ATOXGR': 'CTCAE v5-style grade computed from AVAL and the reference limits (ALT/AST: >ULN, >3x, >5x, >20x; bilirubin: >ULN, >1.5x, >3x, >10x; neutrophils: <LLN, <1.5, <1.0, <0.5 x10^9/L; platelets: <LLN, <75, <50, <25 x10^9/L; hemoglobin: <LLN, <100, <80 g/L). Simplification: grading always uses the upper/lower limit of normal rather than the CTCAE baseline-abnormal rules.',
  'adlb.CHG': 'AVAL - BASE for post-baseline records.',
  'adlb.PCHG': '100 x (AVAL - BASE) / BASE for post-baseline records with a non-zero baseline.',
  'adlb.ONTRTFL': 'Y when TRTSDT < ADT <= TRTEDT + 30 days.',
  'adeg.ABLFL': 'Y on the last record with a datetime before TRTSDTM (the Cycle 1 Day 1 ECG is post-dose, so screening is normally the baseline); SDTM EGLOBXFL identifies the same record.',
  'adrs.AVAL': 'Numeric response code: CR = 1, PR = 2, SD = 3, PD = 4, NE = 5.',
  'adrs.ANL01FL': 'Y for assessments up to and including the first PD and on or before the start of new anticancer therapy.',
  'adrs.PARAMCD': 'OVRLRESP = investigator response at each assessment; BOR = best overall response (unconfirmed); CBOR = confirmed best overall response. CBOR: CR requires a second CR at least 28 days later, PR a subsequent CR/PR at least 28 days later; otherwise SD when a CR/PR/SD occurs at least 35 days after randomization, else PD, else NE.',
  'adtr.AVAL': 'Sum of target-lesion diameters (mm) for PARAMCD = SUMDIAM; best percent change from baseline for PARAMCD = BPCHG (minimum PCHG among analysis records).',
  'adtte.AVAL': 'ADT - STARTDT + 1 (days). Divide by 30.4375 for months.',
  'adtte.CNSR': 'PFS: 0 = event (documented progression or death), 1 = censored at the last adequate assessment, 2 = censored at randomization (no baseline or no adequate post-baseline assessment), 3 = censored at the last adequate assessment on or before new anticancer therapy, 4 = censored at the last adequate assessment before two or more consecutive missed assessments. OS: 0 = death, 1 = censored at the last known alive date.',
  'adtte.ADT': 'PFS: date of the first documented progression or death, or the censoring date given by CNSDTDSC (SAP rules, FDA oncology-endpoint guidance style - these are SAP rules, not regulations). OS: date of death or last known alive date. DOR: same event/censoring date as PFS, measured from the first confirmed response.',
  'adtte.STARTDT': 'Randomization date for PFS and OS; date of the first documented response (the first CR/PR of the confirmed sequence) for DOR.',
  'adtte.EVNTDESC': 'Event or censoring description (DISEASE PROGRESSION, DEATH, NEW ANTICANCER THERAPY BEFORE PD OR DEATH, PD OR DEATH AFTER >=2 MISSED ASSESSMENTS, NO BASELINE OR NO ADEQUATE POST-BASELINE ASSESSMENT, NO PD OR DEATH (ALIVE WITHOUT DOCUMENTED PROGRESSION), ALIVE AT LAST CONTACT).',
  'adtte.SRCSEQ': '--SEQ of the SDTM record that provided ADT (RS assessment, DS disposition record, or the record that provided the last known alive date).',
};

export interface ManifestInput {
  seed: number;
  raw: Table[];
  sdtm: Table[];
  adam: Table[];
  issues: Table;
  lineage: Table;
}

interface DatasetMeta {
  id: string; layer: string; name: string; label: string; file: string; rows: number; keys: string[]; structure: string; description: string; columns: Col[];
}

export function buildManifest(input: ManifestInput) {
  const datasets: DatasetMeta[] = [];
  const push = (layer: 'raw' | 'sdtm' | 'adam' | 'reference', t: Table, file: string, meta: { label: string; structure: string; keys: string[]; description: string }) => {
    const id = `oncology/${layer}/${t.name}`;
    const columns = t.columns.map((c) => {
      const values = t.rows.slice(0, 4000).map((r) => r[c]);
      const extra: Partial<Col> = {};
      const layerKey = layer === 'sdtm' ? `${t.name}.${c}` : `${t.name}.${c}`;
      if (layer === 'adam' && ADAM_DERIV[layerKey]) extra.derivation = ADAM_DERIV[layerKey];
      return colMeta(id, c, values, extra);
    });
    datasets.push({ id, layer, name: t.name, label: meta.label, file, rows: t.rows.length, keys: meta.keys, structure: meta.structure, description: meta.description, columns });
  };
  for (const t of input.raw) {
    const meta = DESCRIPTIONS[`raw/${t.name}`];
    push('raw', t, `raw/${t.name}.csv`, meta);
  }
  for (const t of input.sdtm) push('sdtm', t, `sdtm/${t.name}.csv`, SDTM_DESC[t.name]);
  for (const t of input.adam) push('adam', t, `adam/${t.name}.csv`, ADAM_DESC[t.name]);
  push('reference', { ...input.issues, name: 'data_issues' }, 'answer-key/data_issues.csv', {
    label: 'Answer key: injected data problems', structure: 'One record per issue (or per documented pattern)', keys: ['ISSUE_ID'],
    description: 'Every problem injected into the raw layer, how it was resolved and the value SDTM uses. Includes true findings (dispensing errors, stratification errors, genuine extreme values) that must NOT be "cleaned".',
  });
  push('reference', { ...input.lineage, name: 'sdtm_raw_map' }, 'lineage/sdtm_raw_map.csv', {
    label: 'Lineage: SDTM record to raw record map', structure: 'One record per SDTM record and contributing raw record', keys: ['DOMAIN', 'USUBJID', 'SEQ', 'RECORD_ID'],
    description: 'Traceability from every SDTM record back to the raw row(s) it came from, with notes on unit conversions, query corrections and derived records.',
  });
  return {
    study: 'oncology',
    title: 'CBX417-301 - CBX-417 + docetaxel versus placebo + docetaxel in previously treated advanced NSCLC (synthetic)',
    description:
      'Flagship synthetic Phase 2/3 oncology trial: 468 screened, 420 randomized 1:1, data cutoff 2025-03-31. Three layers (raw EDC/vendor exports with documented data problems, SDTM built from the corrected data, ADaM derived from SDTM) plus an answer key, record-level lineage and a SQLite database of all SDTM and ADaM tables. Everything is fictional; no real subjects, sites, sponsors or products.',
    synthetic: true as const,
    generator: 'scripts/data/oncology/generate.ts',
    seed: input.seed,
    datasets,
  };
}
