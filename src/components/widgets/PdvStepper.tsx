/**
 * Program Data Vector stepper: executes small SAS DATA steps statement by
 * statement (hand-written simulations of SAS semantics) and shows the PDV,
 * automatic variables and the output dataset after every statement.
 */
import { useMemo, useState, useEffect } from 'react';
import clsx from 'clsx';
import { ChevronLeft, ChevronRight, RotateCcw, Play, Pause } from 'lucide-react';
import type { WidgetProps } from './registry';
import { Button, Segmented } from '../ui';
import { CodeBlock } from '../code/CodeBlock';

type V = string | number | null;
type Row = Record<string, V>;

interface Step {
  /** 1-based program line being executed */
  line: number;
  phase: 'compile' | 'execute' | 'output' | 'end';
  note: string;
  pdv: Row;
  output: Row[];
  /** Variables whose value just changed */
  changed?: string[];
}

interface Example {
  id: string;
  label: string;
  program: string;
  inputName: string;
  input: Row[];
  input2?: { name: string; rows: Row[] };
  pdvVars: string[];
  keep: string[];
  steps: () => Step[];
}

const miss = (v: V) => v === null;
const fmt = (v: V) => (v === null ? '.' : typeof v === 'number' ? String(Number.isInteger(v) ? v : Number(v.toFixed(2))) : v === '' ? "' '" : v);

function snapshot(pdv: Row): Row {
  return { ...pdv };
}

/* ------------------------------ Examples ------------------------------ */

const BASIC: Example = {
  id: 'basic',
  label: 'Compile & execute',
  inputName: 'DM',
  input: [
    { USUBJID: 'S-01', AGE: 72, WEIGHT: 80, HEIGHT: 175 },
    { USUBJID: 'S-02', AGE: 45, WEIGHT: null, HEIGHT: 160 },
    { USUBJID: 'S-03', AGE: 65, WEIGHT: 70, HEIGHT: 168 },
  ],
  program: `data adsl_age;
  set dm;
  length AGEGR1 $4;
  if AGE >= 65 then AGEGR1 = '>=65';
  else AGEGR1 = '<65';
  BMI = WEIGHT / (HEIGHT/100)**2;
run;`,
  pdvVars: ['_N_', '_ERROR_', 'USUBJID', 'AGE', 'WEIGHT', 'HEIGHT', 'AGEGR1', 'BMI'],
  keep: ['USUBJID', 'AGE', 'WEIGHT', 'HEIGHT', 'AGEGR1', 'BMI'],
  steps() {
    const out: Row[] = [];
    const steps: Step[] = [];
    const pdv: Row = { _N_: null, _ERROR_: null, USUBJID: null, AGE: null, WEIGHT: null, HEIGHT: null, AGEGR1: null, BMI: null };
    steps.push({ line: 1, phase: 'compile', note: 'Compile phase: SAS reads the whole step, checks syntax and builds the PDV. Variables come from DM (via SET), LENGTH and assignment statements. No data is read yet.', pdv: snapshot(pdv), output: [] });
    this.input.forEach((row, i) => {
      pdv._N_ = i + 1;
      pdv._ERROR_ = 0;
      pdv.AGEGR1 = null;
      pdv.BMI = null;
      steps.push({ line: 1, phase: 'execute', note: `Iteration ${i + 1} starts. _N_ = ${i + 1}. Variables created in this step (AGEGR1, BMI) are reset to missing; variables read by SET keep their values until overwritten.`, pdv: snapshot(pdv), output: [...out], changed: ['_N_', 'AGEGR1', 'BMI'] });
      Object.assign(pdv, row);
      steps.push({ line: 2, phase: 'execute', note: `SET reads observation ${i + 1} of DM into the PDV.`, pdv: snapshot(pdv), output: [...out], changed: ['USUBJID', 'AGE', 'WEIGHT', 'HEIGHT'] });
      steps.push({ line: 3, phase: 'execute', note: 'LENGTH is a compile-time statement: it set AGEGR1 to 4 characters when the PDV was built. Nothing happens at execution.', pdv: snapshot(pdv), output: [...out] });
      if ((row.AGE as number) >= 65) {
        pdv.AGEGR1 = '>=65';
        steps.push({ line: 4, phase: 'execute', note: `AGE = ${row.AGE} ≥ 65 is true, so AGEGR1 = '>=65'. The ELSE on line 5 is skipped.`, pdv: snapshot(pdv), output: [...out], changed: ['AGEGR1'] });
      } else {
        steps.push({ line: 4, phase: 'execute', note: `AGE = ${row.AGE} ≥ 65 is false.`, pdv: snapshot(pdv), output: [...out] });
        pdv.AGEGR1 = '<65';
        steps.push({ line: 5, phase: 'execute', note: "ELSE branch: AGEGR1 = '<65'.", pdv: snapshot(pdv), output: [...out], changed: ['AGEGR1'] });
      }
      if (miss(row.WEIGHT)) {
        pdv.BMI = null;
        steps.push({ line: 6, phase: 'execute', note: 'WEIGHT is missing, so the arithmetic result is missing. The log will say "Missing values were generated as a result of performing an operation on missing values" — check whether that is expected.', pdv: snapshot(pdv), output: [...out], changed: ['BMI'] });
      } else {
        pdv.BMI = (row.WEIGHT as number) / ((row.HEIGHT as number) / 100) ** 2;
        steps.push({ line: 6, phase: 'execute', note: `BMI = ${row.WEIGHT} / (${row.HEIGHT}/100)² = ${fmt(pdv.BMI)}.`, pdv: snapshot(pdv), output: [...out], changed: ['BMI'] });
      }
      out.push(Object.fromEntries(this.keep.map((k) => [k, pdv[k]])));
      steps.push({ line: 7, phase: 'output', note: 'RUN: the implicit OUTPUT writes the PDV (minus automatic variables) to ADSL_AGE, then control returns to the top of the step.', pdv: snapshot(pdv), output: [...out] });
    });
    steps.push({ line: 2, phase: 'end', note: 'Iteration 4: SET tries to read a 4th observation, finds end of file, and the step stops. Note: the step ends at the SET statement, not at RUN.', pdv: snapshot(pdv), output: [...out] });
    return steps;
  },
};

const FIRST_LAST: Example = {
  id: 'first-last',
  label: 'BY groups: FIRST./LAST.',
  inputName: 'AE (sorted by USUBJID ASTDT)',
  input: [
    { USUBJID: 'S-001', ASTDT: '2023-01-10', AETOXGR: 1 },
    { USUBJID: 'S-001', ASTDT: '2023-02-03', AETOXGR: 3 },
    { USUBJID: 'S-001', ASTDT: '2023-02-20', AETOXGR: 2 },
    { USUBJID: 'S-002', ASTDT: '2023-03-05', AETOXGR: 2 },
    { USUBJID: 'S-002', ASTDT: '2023-03-15', AETOXGR: 1 },
    { USUBJID: 'S-003', ASTDT: '2023-01-22', AETOXGR: 2 },
  ],
  program: `data subj_ae;
  set ae;
  by USUBJID;
  retain N_AE MAXGR;
  if first.USUBJID then do; N_AE = 0; MAXGR = .; end;
  N_AE = N_AE + 1;
  MAXGR = max(MAXGR, AETOXGR);
  if last.USUBJID then output;
run;`,
  pdvVars: ['_N_', 'USUBJID', 'ASTDT', 'AETOXGR', 'FIRST.USUBJID', 'LAST.USUBJID', 'N_AE', 'MAXGR'],
  keep: ['USUBJID', 'ASTDT', 'AETOXGR', 'N_AE', 'MAXGR'],
  steps() {
    const out: Row[] = [];
    const steps: Step[] = [];
    const rows = this.input;
    const pdv: Row = { _N_: null, USUBJID: null, ASTDT: null, AETOXGR: null, 'FIRST.USUBJID': null, 'LAST.USUBJID': null, N_AE: null, MAXGR: null };
    steps.push({ line: 1, phase: 'compile', note: 'Compile: BY USUBJID adds the temporary variables FIRST.USUBJID and LAST.USUBJID to the PDV. RETAIN marks N_AE and MAXGR so they are NOT reset between iterations.', pdv: snapshot(pdv), output: [] });
    rows.forEach((row, i) => {
      pdv._N_ = i + 1;
      Object.assign(pdv, row);
      const first = i === 0 || rows[i - 1].USUBJID !== row.USUBJID ? 1 : 0;
      const last = i === rows.length - 1 || rows[i + 1].USUBJID !== row.USUBJID ? 1 : 0;
      pdv['FIRST.USUBJID'] = first;
      pdv['LAST.USUBJID'] = last;
      steps.push({
        line: 2,
        phase: 'execute',
        note: `SET reads row ${i + 1}. SAS compares USUBJID with the previous row (FIRST. = ${first}) and looks ahead to the next row (LAST. = ${last}). Retained N_AE and MAXGR keep their values.`,
        pdv: snapshot(pdv),
        output: [...out],
        changed: ['_N_', 'USUBJID', 'ASTDT', 'AETOXGR', 'FIRST.USUBJID', 'LAST.USUBJID'],
      });
      if (first) {
        pdv.N_AE = 0;
        pdv.MAXGR = null;
        steps.push({ line: 5, phase: 'execute', note: 'FIRST.USUBJID = 1: a new subject starts, so the accumulators are reset.', pdv: snapshot(pdv), output: [...out], changed: ['N_AE', 'MAXGR'] });
      } else {
        steps.push({ line: 5, phase: 'execute', note: 'FIRST.USUBJID = 0: same subject — the DO block is skipped and the retained values carry on.', pdv: snapshot(pdv), output: [...out] });
      }
      pdv.N_AE = (pdv.N_AE as number) + 1;
      steps.push({ line: 6, phase: 'execute', note: `N_AE becomes ${pdv.N_AE}.`, pdv: snapshot(pdv), output: [...out], changed: ['N_AE'] });
      const prevMax = pdv.MAXGR;
      pdv.MAXGR = prevMax === null ? (row.AETOXGR as number) : Math.max(prevMax as number, row.AETOXGR as number);
      steps.push({ line: 7, phase: 'execute', note: `max(${fmt(prevMax)}, ${row.AETOXGR}) = ${pdv.MAXGR} — MAX ignores missing arguments.`, pdv: snapshot(pdv), output: [...out], changed: ['MAXGR'] });
      if (last) {
        out.push(Object.fromEntries(this.keep.map((k) => [k, pdv[k]])));
        steps.push({ line: 8, phase: 'output', note: `LAST.USUBJID = 1: explicit OUTPUT writes one row for ${row.USUBJID}. Because the step contains an OUTPUT statement, there is no implicit output at RUN.`, pdv: snapshot(pdv), output: [...out] });
      } else {
        steps.push({ line: 8, phase: 'execute', note: 'LAST.USUBJID = 0: nothing is written for this row.', pdv: snapshot(pdv), output: [...out] });
      }
    });
    steps.push({ line: 2, phase: 'end', note: 'End of file on SET: the step stops. One output row per subject.', pdv: snapshot(pdv), output: [...out] });
    return steps;
  },
};

const RETAIN: Example = {
  id: 'retain',
  label: 'RETAIN vs no RETAIN',
  inputName: 'EX (dosing records)',
  input: [
    { USUBJID: 'S-01', EXDOSE: 200 },
    { USUBJID: 'S-01', EXDOSE: 200 },
    { USUBJID: 'S-01', EXDOSE: 150 },
  ],
  program: `data cumdose;
  set ex;
  retain CUMDOSE 0;
  CUMDOSE = CUMDOSE + EXDOSE;
  NORETAIN = sum(NORETAIN, EXDOSE);
run;`,
  pdvVars: ['_N_', 'USUBJID', 'EXDOSE', 'CUMDOSE', 'NORETAIN'],
  keep: ['USUBJID', 'EXDOSE', 'CUMDOSE', 'NORETAIN'],
  steps() {
    const out: Row[] = [];
    const steps: Step[] = [];
    const pdv: Row = { _N_: null, USUBJID: null, EXDOSE: null, CUMDOSE: 0, NORETAIN: null };
    steps.push({ line: 3, phase: 'compile', note: 'Compile: RETAIN CUMDOSE 0 sets CUMDOSE’s initial value to 0 and stops it being reset each iteration. NORETAIN is an ordinary variable: reset to missing at the top of every iteration.', pdv: snapshot(pdv), output: [] });
    this.input.forEach((row, i) => {
      pdv._N_ = i + 1;
      pdv.NORETAIN = null;
      steps.push({ line: 1, phase: 'execute', note: `Top of iteration ${i + 1}: NORETAIN is reset to missing; CUMDOSE keeps ${pdv.CUMDOSE}.`, pdv: snapshot(pdv), output: [...out], changed: ['_N_', 'NORETAIN'] });
      Object.assign(pdv, row);
      steps.push({ line: 2, phase: 'execute', note: `SET reads EXDOSE = ${row.EXDOSE}.`, pdv: snapshot(pdv), output: [...out], changed: ['USUBJID', 'EXDOSE'] });
      pdv.CUMDOSE = (pdv.CUMDOSE as number) + (row.EXDOSE as number);
      steps.push({ line: 4, phase: 'execute', note: `CUMDOSE accumulates: now ${pdv.CUMDOSE}.`, pdv: snapshot(pdv), output: [...out], changed: ['CUMDOSE'] });
      pdv.NORETAIN = row.EXDOSE;
      steps.push({ line: 5, phase: 'execute', note: `sum(., ${row.EXDOSE}) = ${row.EXDOSE}: without RETAIN the "running total" restarts every row.`, pdv: snapshot(pdv), output: [...out], changed: ['NORETAIN'] });
      out.push(Object.fromEntries(this.keep.map((k) => [k, pdv[k]])));
      steps.push({ line: 6, phase: 'output', note: 'Implicit OUTPUT at RUN.', pdv: snapshot(pdv), output: [...out] });
    });
    steps.push({ line: 2, phase: 'end', note: 'End of file: CUMDOSE ends at 550, NORETAIN never accumulated.', pdv: snapshot(pdv), output: [...out] });
    return steps;
  },
};

const LAG: Example = {
  id: 'lag',
  label: 'The conditional LAG trap',
  inputName: 'VS (sorted)',
  input: [
    { USUBJID: 'S-01', VISIT: 'BASELINE', SYSBP: 150 },
    { USUBJID: 'S-01', VISIT: 'WEEK 2', SYSBP: 146 },
    { USUBJID: 'S-02', VISIT: 'BASELINE', SYSBP: 138 },
    { USUBJID: 'S-02', VISIT: 'WEEK 2', SYSBP: 131 },
  ],
  program: `data vs2;
  set vs;
  by USUBJID;
  if not first.USUBJID then PREV = lag(SYSBP);
  PREV_OK = lag(SYSBP);
  if first.USUBJID then PREV_OK = .;
run;`,
  pdvVars: ['_N_', 'USUBJID', 'VISIT', 'SYSBP', 'FIRST.USUBJID', 'PREV', 'PREV_OK', 'queue(line 4)', 'queue(line 5)'],
  keep: ['USUBJID', 'VISIT', 'SYSBP', 'PREV', 'PREV_OK'],
  steps() {
    const out: Row[] = [];
    const steps: Step[] = [];
    const rows = this.input;
    let q4: V = null; // queue for the LAG call on line 4 (only updated when executed)
    let q5: V = null; // queue for the LAG call on line 5 (updated every row)
    const pdv: Row = { _N_: null, USUBJID: null, VISIT: null, SYSBP: null, 'FIRST.USUBJID': null, PREV: null, PREV_OK: null, 'queue(line 4)': null, 'queue(line 5)': null };
    steps.push({ line: 1, phase: 'compile', note: 'Each LAG() call in the code gets its OWN queue. A queue only updates when that LAG call executes — which is why a LAG inside an IF misbehaves.', pdv: snapshot(pdv), output: [] });
    rows.forEach((row, i) => {
      pdv._N_ = i + 1;
      pdv.PREV = null;
      pdv.PREV_OK = null;
      Object.assign(pdv, row);
      const first = i === 0 || rows[i - 1].USUBJID !== row.USUBJID ? 1 : 0;
      pdv['FIRST.USUBJID'] = first;
      steps.push({ line: 2, phase: 'execute', note: `Row ${i + 1}: ${row.USUBJID} ${row.VISIT}, SYSBP = ${row.SYSBP}.`, pdv: snapshot(pdv), output: [...out], changed: ['_N_', 'USUBJID', 'VISIT', 'SYSBP', 'FIRST.USUBJID'] });
      if (!first) {
        pdv.PREV = q4;
        q4 = row.SYSBP;
        pdv['queue(line 4)'] = q4;
        steps.push({
          line: 4,
          phase: 'execute',
          note: `LAG on line 4 executes: returns what its queue held (${fmt(pdv.PREV)}) and stores ${row.SYSBP}. ${pdv.PREV === (rows[i - 1]?.SYSBP ?? null) ? '' : 'That is NOT the previous row’s SYSBP — the queue last updated on an earlier executed row.'}`,
          pdv: snapshot(pdv),
          output: [...out],
          changed: ['PREV', 'queue(line 4)'],
        });
      } else {
        steps.push({ line: 4, phase: 'execute', note: 'FIRST.USUBJID = 1, so the LAG on line 4 does not execute — its queue is NOT updated with this row’s SYSBP.', pdv: snapshot(pdv), output: [...out] });
      }
      pdv.PREV_OK = q5;
      q5 = row.SYSBP;
      pdv['queue(line 5)'] = q5;
      steps.push({ line: 5, phase: 'execute', note: `LAG on line 5 runs on every row: returns ${fmt(pdv.PREV_OK)} (the previous row’s value) and queues ${row.SYSBP}.`, pdv: snapshot(pdv), output: [...out], changed: ['PREV_OK', 'queue(line 5)'] });
      if (first) {
        pdv.PREV_OK = null;
        steps.push({ line: 6, phase: 'execute', note: 'First row of the subject: blank out the value that belonged to the previous subject.', pdv: snapshot(pdv), output: [...out], changed: ['PREV_OK'] });
      }
      out.push(Object.fromEntries(this.keep.map((k) => [k, pdv[k]])));
      steps.push({ line: 7, phase: 'output', note: 'Implicit OUTPUT.', pdv: snapshot(pdv), output: [...out] });
    });
    steps.push({ line: 2, phase: 'end', note: 'Compare PREV and PREV_OK for S-02 WEEK 2: the conditional LAG returned 146 (from S-01), not 138. Call LAG unconditionally, then decide what to keep.', pdv: snapshot(pdv), output: [...out] });
    return steps;
  },
};

const MERGE: Example = {
  id: 'merge',
  label: 'One-to-many MERGE',
  inputName: 'ADSL',
  input: [
    { USUBJID: 'S-01', TRT01A: 'CBX' },
    { USUBJID: 'S-02', TRT01A: 'PBO' },
  ],
  input2: {
    name: 'AE',
    rows: [
      { USUBJID: 'S-01', AEDECOD: 'Nausea' },
      { USUBJID: 'S-01', AEDECOD: 'Rash' },
      { USUBJID: 'S-02', AEDECOD: 'Fatigue' },
      { USUBJID: 'S-03', AEDECOD: 'Cough' },
    ],
  },
  program: `data ae_trt;
  merge adsl(in=inadsl) ae(in=inae);
  by USUBJID;
  if inae;
run;`,
  pdvVars: ['_N_', 'USUBJID', 'TRT01A', 'AEDECOD', 'INADSL', 'INAE'],
  keep: ['USUBJID', 'TRT01A', 'AEDECOD'],
  steps() {
    const out: Row[] = [];
    const steps: Step[] = [];
    const pdv: Row = { _N_: null, USUBJID: null, TRT01A: null, AEDECOD: null, INADSL: null, INAE: null };
    steps.push({ line: 1, phase: 'compile', note: 'Compile: the PDV holds variables from both datasets plus the IN= flags (temporary, not output).', pdv: snapshot(pdv), output: [] });
    const adsl = this.input;
    const ae = this.input2!.rows;
    const ids = [...new Set([...adsl.map((r) => r.USUBJID), ...ae.map((r) => r.USUBJID)])].sort() as string[];
    let n = 0;
    for (const id of ids) {
      const a = adsl.filter((r) => r.USUBJID === id);
      const e = ae.filter((r) => r.USUBJID === id);
      const count = Math.max(a.length, e.length);
      // Variables are reset to missing when a new BY group starts.
      pdv.TRT01A = null;
      pdv.AEDECOD = null;
      for (let k = 0; k < count; k++) {
        n++;
        pdv._N_ = n;
        pdv.USUBJID = id;
        if (a[k]) Object.assign(pdv, a[k]);
        if (e[k]) Object.assign(pdv, e[k]);
        pdv.INADSL = a.length ? 1 : 0;
        pdv.INAE = e.length ? 1 : 0;
        const retainedNote = !a[k] && a.length ? ` ADSL has only one row for ${id}, so TRT01A = '${pdv.TRT01A}' is RETAINED from the previous iteration — that is how one-to-many merges fill in subject-level values.` : '';
        steps.push({
          line: 2,
          phase: 'execute',
          note: `BY group ${id}, iteration ${k + 1}: MERGE reads ${a[k] ? 'an ADSL row' : 'no ADSL row'} and ${e[k] ? 'an AE row' : 'no AE row'}. INADSL = ${pdv.INADSL}, INAE = ${pdv.INAE}.${retainedNote}${!a.length ? ' No ADSL match: TRT01A is missing.' : ''}`,
          pdv: snapshot(pdv),
          output: [...out],
          changed: ['_N_', 'USUBJID', 'TRT01A', 'AEDECOD', 'INADSL', 'INAE'],
        });
        if (pdv.INAE === 1) {
          out.push(Object.fromEntries(this.keep.map((key) => [key, pdv[key]])));
          steps.push({ line: 4, phase: 'output', note: 'Subsetting IF INAE is true: the row is written.', pdv: snapshot(pdv), output: [...out] });
        } else {
          steps.push({ line: 4, phase: 'execute', note: 'INAE = 0 (subject in ADSL without AEs): the subsetting IF stops this iteration — no output.', pdv: snapshot(pdv), output: [...out] });
        }
      }
    }
    steps.push({ line: 2, phase: 'end', note: 'S-03 has an AE but no ADSL record, so TRT01A is missing — a data issue a QC programmer must catch (check the log and counts; consider IF INADSL AND INAE).', pdv: snapshot(pdv), output: [...out] });
    return steps;
  },
};

const SUM: Example = { ...RETAIN, id: 'sum' };
const EXAMPLES: Example[] = [BASIC, FIRST_LAST, RETAIN, LAG, MERGE];

export default function PdvStepper({ props }: WidgetProps) {
  const initial = EXAMPLES.find((e) => e.id === props.example) ?? (props.example === 'sum' ? SUM : BASIC);
  const [exId, setExId] = useState(initial.id === 'sum' ? 'retain' : initial.id);
  const ex = EXAMPLES.find((e) => e.id === exId) ?? BASIC;
  const steps = useMemo(() => ex.steps(), [ex]);
  const [i, setI] = useState(0);
  const [playing, setPlaying] = useState(false);
  useEffect(() => setI(0), [exId]);
  useEffect(() => {
    if (!playing) return;
    if (i >= steps.length - 1) {
      setPlaying(false);
      return;
    }
    const t = window.setTimeout(() => setI((x) => x + 1), 1400);
    return () => window.clearTimeout(t);
  }, [playing, i, steps.length]);
  const step = steps[Math.min(i, steps.length - 1)];

  return (
    <div className="pdv">
      <div className="w-toolbar">
        <Segmented ariaLabel="Example" value={exId} onChange={setExId} options={EXAMPLES.map((e) => ({ value: e.id, label: e.label }))} />
      </div>
      <div className="pdv__grid">
        <div style={{ minWidth: 0 }}>
          <CodeBlock code={ex.program} lang="sas" highlight={new Set([step.line])} compact download={false} lineNumbers />
          <div className={clsx('pdv__note', `pdv__note--${step.phase}`)}>
            <span className="pdv__phase">{step.phase === 'compile' ? 'Compile' : step.phase === 'end' ? 'Stop' : step.phase === 'output' ? 'Output' : 'Execute'}</span>
            {step.note}
          </div>
          <div className="row gap-2" style={{ marginTop: 10 }}>
            <Button size="sm" icon={<ChevronLeft />} onClick={() => setI((x) => Math.max(0, x - 1))} disabled={i === 0}>
              Back
            </Button>
            <Button size="sm" variant="primary" iconRight={<ChevronRight />} onClick={() => setI((x) => Math.min(steps.length - 1, x + 1))} disabled={i >= steps.length - 1}>
              Next statement
            </Button>
            <Button size="sm" variant="ghost" icon={playing ? <Pause /> : <Play />} onClick={() => setPlaying((p) => !p)}>
              {playing ? 'Pause' : 'Auto-play'}
            </Button>
            <Button size="sm" variant="ghost" icon={<RotateCcw />} onClick={() => setI(0)}>
              Restart
            </Button>
            <span className="muted num" style={{ fontSize: 12 }}>
              {i + 1}/{steps.length}
            </span>
          </div>
        </div>
        <div className="stack gap-3" style={{ minWidth: 0 }}>
          <div>
            <div className="eyebrow" style={{ marginBottom: 6 }}>
              Input: {ex.inputName}
            </div>
            <table className="w-table">
              <thead>
                <tr>
                  {Object.keys(ex.input[0]).map((k) => (
                    <th key={k}>{k}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ex.input.map((r, ri) => (
                  <tr key={ri} className={clsx(step.pdv._N_ === ri + 1 && ex.id !== 'merge' && 'is-active')}>
                    {Object.values(r).map((v, vi) => (
                      <td key={vi}>{fmt(v)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {ex.input2 && (
              <>
                <div className="eyebrow" style={{ margin: '10px 0 6px' }}>
                  Input: {ex.input2.name}
                </div>
                <table className="w-table">
                  <thead>
                    <tr>
                      {Object.keys(ex.input2.rows[0]).map((k) => (
                        <th key={k}>{k}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {ex.input2.rows.map((r, ri) => (
                      <tr key={ri}>
                        {Object.values(r).map((v, vi) => (
                          <td key={vi}>{fmt(v)}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </div>
          <div>
            <div className="eyebrow" style={{ marginBottom: 6 }}>
              Program Data Vector
            </div>
            <div className="pdv__vector">
              {ex.pdvVars.map((v) => (
                <div key={v} className={clsx('pdv__cell', step.changed?.includes(v) && 'is-changed', (v.startsWith('_') || v.includes('.') || v.startsWith('queue') || v.startsWith('IN')) && 'is-auto')}>
                  <span className="pdv__var">{v}</span>
                  <span className="pdv__val">{fmt(step.pdv[v] ?? null)}</span>
                </div>
              ))}
            </div>
            <div className="w-note" style={{ marginTop: 6 }}>
              Shaded cells are automatic or temporary variables — they are never written to the output dataset.
            </div>
          </div>
          <div>
            <div className="eyebrow" style={{ marginBottom: 6 }}>
              Output dataset ({step.output.length} row{step.output.length === 1 ? '' : 's'})
            </div>
            {step.output.length ? (
              <table className="w-table">
                <thead>
                  <tr>
                    {ex.keep.map((k) => (
                      <th key={k}>{k}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {step.output.map((r, ri) => (
                    <tr key={ri}>
                      {ex.keep.map((k) => (
                        <td key={k}>{fmt(r[k] ?? null)}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="w-note">Nothing written yet.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
