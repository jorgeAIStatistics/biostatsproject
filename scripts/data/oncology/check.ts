/**
 * Consistency checks run against the written CSV files (not the in-memory
 * objects), so they test what a learner actually gets.
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { parseCsv } from './csv.ts';

type Rows = Record<string, string>[];

function read(dir: string, name: string): Rows {
  const p = join(dir, name);
  if (!existsSync(p)) return [];
  const { header, rows } = parseCsv(readFileSync(p, 'utf8'));
  return rows.map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ''])));
}

export function runChecks(out: string): string[] {
  const bad: string[] = [];
  const add = (msg: string) => bad.push(msg);
  const sdtm = (n: string) => read(out, `sdtm/${n}.csv`);
  const adam = (n: string) => read(out, `adam/${n}.csv`);
  const dm = sdtm('dm');
  const adsl = adam('adsl');
  const DCO = '2025-03-31';

  // subject flow
  if (dm.length !== 468) add(`DM has ${dm.length} subjects (expected 468)`);
  if (adsl.length !== 420) add(`ADSL has ${adsl.length} subjects (expected 420)`);
  const sf = dm.filter((d) => d.ARMNRS === 'SCREEN FAILURE').length;
  if (sf !== 48) add(`${sf} screen failures in DM (expected 48)`);
  for (const a of ['CBX+DOC', 'PBO+DOC']) {
    const n = adsl.filter((s) => s.ARMCD === a).length;
    if (n !== 210) add(`${n} subjects randomized to ${a} (expected 210)`);
    const nt = adsl.filter((s) => s.ARMCD === a && s.SAFFL === 'N').length;
    if (nt !== 2) add(`${nt} randomized-not-treated in ${a} (expected 2)`);
  }
  const saf = adsl.filter((s) => s.SAFFL === 'Y').length;
  if (saf !== 416) add(`safety population is ${saf} (expected 416)`);
  const disp = adsl.filter((s) => s.SAFFL === 'Y' && s.TRT01A !== (s.ARMCD === 'CBX+DOC' ? 'CBX-417 + Docetaxel' : 'Placebo + Docetaxel')).length;
  if (disp !== 3) add(`${disp} subjects with planned != actual treatment (expected 3 dispensing errors)`);

  // unique keys
  const uniq = (rows: Rows, key: (r: Record<string, string>) => string, what: string) => {
    const seen = new Set<string>();
    for (const r of rows) {
      const k = key(r);
      if (seen.has(k)) {
        add(`${what}: duplicate key ${k}`);
        return;
      }
      seen.add(k);
    }
  };
  uniq(dm, (r) => r.USUBJID, 'DM USUBJID');
  uniq(adsl, (r) => r.USUBJID, 'ADSL USUBJID');
  const seqDomains = readdirSync(join(out, 'sdtm')).map((f) => f.replace('.csv', ''));
  const sdtmRows = new Map<string, Rows>();
  for (const d of seqDomains) {
    const rows = sdtm(d);
    sdtmRows.set(d.toUpperCase(), rows);
    const seqVar = `${d.toUpperCase()}SEQ`;
    if (!rows.length || !(seqVar in rows[0]) || !('USUBJID' in rows[0])) continue;
    uniq(rows, (r) => `${r.USUBJID}|${r[seqVar]}`, `${d.toUpperCase()} ${seqVar}`);
  }

  // no --DY equal to 0 and no dates after the cutoff
  for (const [dom, rows] of sdtmRows) {
    if (!rows.length) continue;
    for (const col of Object.keys(rows[0])) {
      if (/DY$/.test(col) && col !== 'STUDY') {
        const z = rows.filter((r) => r[col] === '0').length;
        if (z) add(`${dom}.${col}: ${z} record(s) with study day 0`);
      }
      if (/DTC$/.test(col)) {
        const late = rows.filter((r) => /^\d{4}-\d\d-\d\d/.test(r[col]) && r[col].slice(0, 10) > DCO).length;
        if (late) add(`${dom}.${col}: ${late} date(s) after the data cutoff ${DCO}`);
      }
    }
  }
  for (const ds of ['adsl', 'adae', 'adlb', 'advs', 'adeg', 'adrs', 'adtr', 'adtte']) {
    const rows = adam(ds);
    if (!rows.length) continue;
    for (const col of Object.keys(rows[0]))
      if (/^(ADT|ASTDT|AENDT|TRTSDT|TRTEDT|RANDDT|DTHDT|EOSDT|LSTALVDT|STARTDT|DCTDT)$/.test(col)) {
        const late = rows.filter((r) => /^\d{4}-\d\d-\d\d$/.test(r[col]) && r[col] > DCO).length;
        if (late) add(`${ds.toUpperCase()}.${col}: ${late} date(s) after ${DCO}`);
      }
  }

  // lineage covers every SDTM record
  const lin = read(out, 'lineage/sdtm_raw_map.csv');
  const qnamOf = (note: string) => (note.match(/QNAM=(\w+)/) ?? [])[1] ?? '';
  const covered = new Set(lin.map((r) => `${r.DOMAIN}|${r.USUBJID}|${r.SEQ}${r.DOMAIN.startsWith('SUPP') ? `|${qnamOf(r.NOTE)}` : ''}`));
  for (const [dom, rows] of sdtmRows) {
    if (!rows.length) continue;
    const seqVar = `${dom}SEQ`;
    let missing = 0;
    for (const r of rows) {
      if (dom.startsWith('SUPP')) {
        if (!covered.has(`${dom}|${r.USUBJID}|${r.IDVARVAL}|${r.QNAM}`)) missing++;
        continue;
      }
      const seq = seqVar in r ? r[seqVar] : dom === 'SV' ? r.VISITNUM : dom === 'TA' ? r.TAETORD : dom === 'TS' ? r.TSSEQ : '';
      if (!covered.has(`${dom}|${r.USUBJID ?? ''}|${seq}`)) missing++;
    }
    if (missing) add(`${dom}: ${missing} record(s) missing from lineage/sdtm_raw_map.csv`);
  }
  // lineage record ids exist in the raw files
  const rawIds = new Set<string>();
  for (const f of readdirSync(join(out, 'raw'))) for (const r of read(out, `raw/${f}`)) rawIds.add(r.RECORD_ID);
  const badIds = lin.filter((r) => r.RECORD_ID && !rawIds.has(r.RECORD_ID)).length;
  if (badIds) add(`lineage: ${badIds} RECORD_ID value(s) not found in raw/`);
  const issues = read(out, 'answer-key/data_issues.csv');
  const badIssue = issues.filter((r) => r.RECORD_ID && r.RECORD_ID !== 'MULTIPLE' && r.RECORD_ID !== '(missing)' && !rawIds.has(r.RECORD_ID)).length;
  if (badIssue) add(`answer key: ${badIssue} RECORD_ID value(s) not found in raw/`);

  // ADaM traceability
  const lb = sdtmRows.get('LB')!;
  const lbKeys = new Set(lb.map((r) => `${r.USUBJID}|${r.LBSEQ}`));
  const adlb = adam('adlb');
  const lbMiss = adlb.filter((r) => !lbKeys.has(`${r.USUBJID}|${r.SRCSEQ}`)).length;
  if (lbMiss) add(`ADLB: ${lbMiss} SRCSEQ value(s) with no matching LB record`);
  const srcKeys = new Map<string, Set<string>>();
  for (const [dom, rows] of sdtmRows) {
    const seqVar = `${dom}SEQ`;
    if (!rows.length || !(seqVar in rows[0])) continue;
    srcKeys.set(dom, new Set(rows.map((r) => `${r.USUBJID}|${r[seqVar]}`)));
  }
  const adtte = adam('adtte');
  const tteMiss = adtte.filter((r) => r.SRCSEQ && !(srcKeys.get(r.SRCDOM)?.has(`${r.USUBJID}|${r.SRCSEQ}`) ?? false)).length;
  if (tteMiss) add(`ADTTE: ${tteMiss} SRCSEQ value(s) with no matching SDTM record`);
  const tteBad = adtte.filter((r) => Number(r.AVAL) !== Math.round((Date.parse(r.ADT) - Date.parse(r.STARTDT)) / 86400000) + 1).length;
  if (tteBad) add(`ADTTE: ${tteBad} record(s) where AVAL != ADT - STARTDT + 1`);
  const cnsrBad = adtte.filter((r) => !['0', '1', '2', '3', '4'].includes(r.CNSR)).length;
  if (cnsrBad) add(`ADTTE: ${cnsrBad} record(s) with an unexpected CNSR value`);
  for (const p of ['PFS', 'OS']) {
    const n = adtte.filter((r) => r.PARAMCD === p).length;
    if (n !== 420) add(`ADTTE: ${n} ${p} records (expected 420)`);
  }

  // TRTEMFL logic
  const adae = adam('adae');
  const day = (s: string) => Date.parse(s) / 86400000;
  const temBad = adae.filter((r) => {
    const expect = r.TRTSDT && r.ASTDT && day(r.ASTDT) >= day(r.TRTSDT) && day(r.ASTDT) <= day(r.TRTEDT) + 30;
    return (r.TRTEMFL === 'Y') !== !!expect;
  }).length;
  if (temBad) add(`ADAE: ${temBad} record(s) where TRTEMFL does not match TRTSDT <= ASTDT <= TRTEDT + 30`);
  const aeKeys = new Set(sdtmRows.get('AE')!.map((r) => `${r.USUBJID}|${r.AESEQ}`));
  const aeMiss = adae.filter((r) => !aeKeys.has(`${r.USUBJID}|${r.AESEQ}`)).length;
  if (aeMiss) add(`ADAE: ${aeMiss} record(s) with no matching AE record`);

  // BDS: one baseline per subject/parameter, CHG = AVAL - BASE
  for (const ds of ['adlb', 'advs', 'adeg', 'adtr']) {
    const rows = adam(ds);
    const blc = new Map<string, number>();
    let chgBad = 0;
    let baseBad = 0;
    for (const r of rows) {
      const k = `${r.USUBJID}|${r.PARAMCD}`;
      if (r.ABLFL === 'Y') blc.set(k, (blc.get(k) ?? 0) + 1);
      if (r.CHG !== '' && r.BASE !== '' && Math.abs(Number(r.CHG) - (Number(r.AVAL) - Number(r.BASE))) > 1e-6) chgBad++;
      if (r.CHG !== '' && r.BASE === '') baseBad++;
    }
    for (const [k, n] of blc) if (n !== 1) add(`${ds.toUpperCase()}: ${n} baseline records for ${k}`);
    if (chgBad) add(`${ds.toUpperCase()}: ${chgBad} record(s) where CHG != AVAL - BASE`);
    if (baseBad) add(`${ds.toUpperCase()}: ${baseBad} record(s) with CHG but no BASE`);
    // every parameter with a pre-treatment value must have a baseline record
    const params = new Set(rows.map((r) => `${r.USUBJID}|${r.PARAMCD}`));
    for (const k of params) if (!blc.has(k) && rows.some((r) => r.USUBJID === k.split('|')[0] && r.PARAMCD === k.split('|')[1] && r.ADY !== '' && Number(r.ADY) <= 1)) add(`${ds.toUpperCase()}: no ABLFL record for ${k} despite a pre-treatment value`);
  }
  return bad;
}
