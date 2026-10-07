import { useState } from 'react';
import { Link } from 'react-router';
import clsx from 'clsx';
import type { WidgetProps } from '../registry';
import { Badge, Segmented } from '../../ui';

type Cls = 'special' | 'interventions' | 'events' | 'findings' | 'trial' | 'relationship';

interface Domain {
  code: string;
  name: string;
  cls: Cls;
  structure: string;
  keys: string[];
  topic?: string;
  notes: string;
  dataset?: string;
}

const CLASSES: { id: Cls; label: string; blurb: string }[] = [
  { id: 'special', label: 'Special purpose', blurb: 'Subject-level or study-level datasets that do not fit the three general classes.' },
  { id: 'interventions', label: 'Interventions', blurb: 'Treatments and substances given to or taken by the subject — the topic variable is the treatment name (--TRT).' },
  { id: 'events', label: 'Events', blurb: 'Things that happened to the subject — the topic variable is the reported term (--TERM).' },
  { id: 'findings', label: 'Findings', blurb: 'Measurements and observations — the topic variable is the test (--TESTCD) and the answer lives in --ORRES / --STRESC / --STRESN.' },
  { id: 'trial', label: 'Trial design', blurb: 'The planned design of the study: arms, elements, visits, inclusion/exclusion criteria and trial summary parameters.' },
  { id: 'relationship', label: 'Relationship', blurb: 'Datasets that attach extra information or relate records to each other.' },
];

const DOMAINS: Domain[] = [
  { code: 'DM', name: 'Demographics', cls: 'special', structure: 'One record per subject', keys: ['STUDYID', 'USUBJID'], notes: 'The hub: every other domain joins to DM on USUBJID. Holds RFSTDTC/RFXSTDTC (reference dates used for --DY), ARM/ACTARM and ARMNRS, death flag and country.', dataset: 'oncology/sdtm/dm' },
  { code: 'CO', name: 'Comments', cls: 'special', structure: 'One record per comment', keys: ['STUDYID', 'USUBJID', 'COSEQ'], notes: 'Free-text comments, optionally linked to the record they refer to via RDOMAIN/IDVAR/IDVARVAL.' },
  { code: 'SE', name: 'Subject Elements', cls: 'special', structure: 'One record per element per subject', keys: ['STUDYID', 'USUBJID', 'ETCD', 'SESTDTC'], notes: 'Actual elements the subject passed through, derived from collected data and the trial design.' },
  { code: 'SV', name: 'Subject Visits', cls: 'special', structure: 'One record per visit per subject', keys: ['STUDYID', 'USUBJID', 'VISITNUM'], notes: 'When each visit actually occurred; useful for visit-window checks.' },
  { code: 'EX', name: 'Exposure', cls: 'interventions', structure: 'One record per constant dosing interval per subject', keys: ['STUDYID', 'USUBJID', 'EXTRT', 'EXSTDTC'], topic: 'EXTRT', notes: 'Study treatment actually administered. First and last dose dates here drive TRTSDT/TRTEDT in ADSL and therefore the treatment-emergent window.', dataset: 'oncology/sdtm/ex' },
  { code: 'CM', name: 'Concomitant Medications', cls: 'interventions', structure: 'One record per medication per subject', keys: ['STUDYID', 'USUBJID', 'CMTRT', 'CMSTDTC'], topic: 'CMTRT', notes: 'Prior and concomitant medications; coded with a dictionary (WHO Drug). Prior/concomitant status depends on dates relative to first dose.', dataset: 'oncology/sdtm/cm' },
  { code: 'AE', name: 'Adverse Events', cls: 'events', structure: 'One record per adverse event per subject', keys: ['STUDYID', 'USUBJID', 'AEDECOD', 'AESTDTC'], topic: 'AETERM', notes: 'Verbatim term (AETERM) plus dictionary-coded term (AEDECOD) and body system (AEBODSYS). Seriousness, severity/grade, relationship, action taken and outcome are qualifiers.', dataset: 'oncology/sdtm/ae' },
  { code: 'MH', name: 'Medical History', cls: 'events', structure: 'One record per condition per subject', keys: ['STUDYID', 'USUBJID', 'MHDECOD', 'MHSTDTC'], topic: 'MHTERM', notes: 'Conditions that started before the study. Start dates are frequently partial ("2019" or "2019-04").', dataset: 'oncology/sdtm/mh' },
  { code: 'DS', name: 'Disposition', cls: 'events', structure: 'One record per disposition status or protocol milestone per subject', keys: ['STUDYID', 'USUBJID', 'DSDECOD', 'DSSTDTC'], topic: 'DSTERM', notes: 'Both milestones (INFORMED CONSENT OBTAINED, RANDOMIZED) and disposition events (COMPLETED, ADVERSE EVENT, PROGRESSIVE DISEASE…). DSCAT separates them.', dataset: 'oncology/sdtm/ds' },
  { code: 'DV', name: 'Protocol Deviations', cls: 'events', structure: 'One record per deviation per subject', keys: ['STUDYID', 'USUBJID', 'DVTERM', 'DVSTDTC'], topic: 'DVTERM', notes: 'Important deviations feed the per-protocol population definition.', dataset: 'oncology/sdtm/dv' },
  { code: 'LB', name: 'Laboratory Test Results', cls: 'findings', structure: 'One record per test per visit per subject', keys: ['STUDYID', 'USUBJID', 'LBTESTCD', 'VISITNUM', 'LBDTC'], topic: 'LBTESTCD', notes: 'Original result and unit (LBORRES/LBORRESU) plus standardized result and unit (LBSTRESC/LBSTRESN/LBSTRESU). Reference ranges and LBNRIND support shift tables.', dataset: 'oncology/sdtm/lb' },
  { code: 'VS', name: 'Vital Signs', cls: 'findings', structure: 'One record per test per visit per subject', keys: ['STUDYID', 'USUBJID', 'VSTESTCD', 'VISITNUM', 'VSDTC'], topic: 'VSTESTCD', notes: 'Collected on a wide CRF form, stored long: one row per measurement, not one row per visit.', dataset: 'oncology/sdtm/vs' },
  { code: 'EG', name: 'ECG Test Results', cls: 'findings', structure: 'One record per test per time point per subject', keys: ['STUDYID', 'USUBJID', 'EGTESTCD', 'VISITNUM', 'EGDTC'], topic: 'EGTESTCD', notes: 'QTcF (EGTESTCD = "QTCFAG") and heart rate; used for cardiac safety analyses with category criteria (>450, >480, >500 ms).', dataset: 'oncology/sdtm/eg' },
  { code: 'RS', name: 'Disease Response and Clin Classification', cls: 'findings', structure: 'One record per assessment per visit per subject', keys: ['STUDYID', 'USUBJID', 'RSTESTCD', 'RSEVAL', 'VISITNUM'], topic: 'RSTESTCD', notes: 'RECIST 1.1 overall response (RSTESTCD = "OVRLRESP", RSCAT = "RECIST 1.1"), and clinical classifications such as ECOG (RSTESTCD = "ECOG101"). RSEVAL says who assessed it.', dataset: 'oncology/sdtm/rs' },
  { code: 'TR', name: 'Tumor/Lesion Results', cls: 'findings', structure: 'One record per measurement per lesion per visit', keys: ['STUDYID', 'USUBJID', 'TRTESTCD', 'TRLNKID', 'VISITNUM'], topic: 'TRTESTCD', notes: 'Lesion measurements; here simplified to the sum of diameters (TRTESTCD = "SUMDIAM") used for waterfall plots.', dataset: 'oncology/sdtm/tr' },
  { code: 'TU', name: 'Tumor/Lesion Identification', cls: 'findings', structure: 'One record per identified lesion per subject', keys: ['STUDYID', 'USUBJID', 'TULNKID'], topic: 'TUTESTCD', notes: 'Identifies target and non-target lesions; linked to TR through TULNKID. Omitted in this educational dataset.' },
  { code: 'TA', name: 'Trial Arms', cls: 'trial', structure: 'One record per planned element per arm', keys: ['STUDYID', 'ARMCD', 'TAETORD'], notes: 'The planned sequence of elements in each arm.' },
  { code: 'TS', name: 'Trial Summary', cls: 'trial', structure: 'One record per parameter (per value)', keys: ['STUDYID', 'TSPARMCD', 'TSSEQ'], notes: 'Study-level metadata: phase, indication, planned enrolment, randomization ratio. Expected in FDA submissions.' },
  { code: 'TI', name: 'Trial Inclusion/Exclusion Criteria', cls: 'trial', structure: 'One record per criterion', keys: ['STUDYID', 'IETESTCD'], notes: 'The criteria themselves; the IE domain records criteria a subject did not meet.' },
  { code: 'SUPP--', name: 'Supplemental Qualifiers', cls: 'relationship', structure: 'One record per non-standard variable value', keys: ['STUDYID', 'RDOMAIN', 'USUBJID', 'IDVAR', 'IDVARVAL', 'QNAM'], notes: 'Holds data that has no standard variable: QNAM names the variable, QLABEL describes it, QVAL holds the value (always character). Example here: AERELDOC, the relationship of an AE to docetaxel.' },
  { code: 'RELREC', name: 'Related Records', cls: 'relationship', structure: 'One record per related record or dataset pair', keys: ['STUDYID', 'RDOMAIN', 'IDVAR', 'IDVARVAL', 'RELID'], notes: 'Formally links records across domains, e.g. an AE record to the CM given to treat it.' },
];

export default function SdtmExplorer(_: WidgetProps) {
  void _;
  const [cls, setCls] = useState<Cls | 'all'>('all');
  const [active, setActive] = useState('DM');
  const domain = DOMAINS.find((d) => d.code === active)!;
  const shown = DOMAINS.filter((d) => cls === 'all' || d.cls === cls);

  return (
    <div className="stack gap-3">
      <Segmented
        ariaLabel="Observation class"
        value={cls}
        onChange={setCls}
        options={[{ value: 'all' as const, label: 'All' }, ...CLASSES.map((c) => ({ value: c.id, label: c.label }))]}
      />
      <div className="sdtm-map">
        {shown.map((d) => (
          <button key={d.code} type="button" className={clsx('sdtm-node', `sdtm-node--${d.cls}`, d.code === active && 'is-active')} onClick={() => setActive(d.code)}>
            <span className="sdtm-node__code">{d.code}</span>
            <span className="sdtm-node__name">{d.name}</span>
          </button>
        ))}
      </div>
      <div className="lifecycle__detail">
        <div className="lifecycle__headline">
          <h4>
            {domain.code} — {domain.name}
          </h4>
          <Badge tone="accent">{CLASSES.find((c) => c.id === domain.cls)?.label}</Badge>
        </div>
        <p className="lifecycle__blurb">{domain.notes}</p>
        <div className="lifecycle__cols">
          <div>
            <div className="eyebrow">Structure</div>
            <p style={{ fontSize: 12.5, marginTop: 6 }}>{domain.structure}</p>
          </div>
          <div>
            <div className="eyebrow">Natural key</div>
            <p className="mono" style={{ fontSize: 12, marginTop: 6 }}>
              {domain.keys.join(' · ')}
            </p>
          </div>
          <div>
            <div className="eyebrow">Topic variable</div>
            <p className="mono" style={{ fontSize: 12, marginTop: 6 }}>
              {domain.topic ?? '—'}
            </p>
          </div>
          {domain.dataset && (
            <div>
              <div className="eyebrow">In this study</div>
              <p style={{ fontSize: 12.5, marginTop: 6 }}>
                <Link to={`/data/${domain.dataset}`}>Open {domain.code} dataset</Link>
              </p>
            </div>
          )}
        </div>
      </div>
      <div className="w-explain">
        {CLASSES.find((c) => c.id === domain.cls)?.blurb} Every subject-level domain joins back to <b>DM</b> on <code>USUBJID</code>; within a domain,{' '}
        <code>--SEQ</code> makes each record uniquely identifiable so ADaM can point at it (<code>SRCDOM</code>/<code>SRCSEQ</code>) and SUPPQUAL can attach
        extra values to it.
      </div>
    </div>
  );
}
