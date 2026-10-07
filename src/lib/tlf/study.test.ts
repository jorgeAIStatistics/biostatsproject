/**
 * Guards the flagship study's headline numbers: the values the app displays
 * must equal what R's survival package computes from the same ADaM files.
 *
 * Reference values (regenerate after changing the data generator):
 *   Rscript -e 'library(survival); d <- read.csv("data/oncology/adam/adtte.csv");
 *     p <- subset(d, PARAMCD == "PFS"); p$m <- p$AVAL/30.4375; p$ev <- as.integer(p$CNSR == 0);
 *     print(summary(survfit(Surv(m, ev) ~ TRTP, data = p, conf.type = "log-log"))$table);
 *     print(coxph(Surv(m, ev) ~ TRTP + strata(STRAT1R, STRAT2R), data = p))'
 */
import { readFileSync, existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import Papa from 'papaparse';
import { kaplanMeier, coxPH, logRank, type SurvRecord } from '../stats/survival';

const FILE = 'data/oncology/adam/adtte.csv';
const ADSL = 'data/oncology/adam/adsl.csv';
const have = existsSync(FILE) && existsSync(ADSL);

interface Rec {
  PARAMCD: string;
  AVAL: string;
  CNSR: string;
  TRTP: string;
  STRAT1R: string;
  STRAT2R: string;
}

const read = <T,>(f: string): T[] => Papa.parse<T>(readFileSync(f, 'utf8'), { header: true, skipEmptyLines: true }).data;

describe.skipIf(!have)('CBX417-301 headline numbers match R', () => {
  const rows = read<Rec>(FILE).filter((r) => r.PARAMCD === 'PFS');
  const arms = ['CBX-417 + Docetaxel', 'Placebo + Docetaxel'];
  const surv = (arm?: string): SurvRecord[] =>
    rows
      .filter((r) => !arm || r.TRTP === arm)
      .map((r) => ({
        time: Number(r.AVAL) / 30.4375,
        event: Number(r.CNSR) === 0 ? 1 : 0,
        group: r.TRTP,
        strata: `${r.STRAT1R}|${r.STRAT2R}`,
        covariates: [r.TRTP === arms[0] ? 1 : 0],
      }));

  it('subject flow', () => {
    const adsl = read<Record<string, string>>(ADSL);
    expect(adsl.length).toBe(420);
    expect(adsl.filter((r) => r.ITTFL === 'Y').length).toBe(420);
    expect(adsl.filter((r) => r.SAFFL === 'Y').length).toBe(416);
    for (const a of arms) expect(adsl.filter((r) => r.TRT01P === a).length).toBe(210);
  });

  it('Kaplan–Meier medians and events (R: 155/177 events, medians 6.9322 / 4.1725)', () => {
    const km0 = kaplanMeier(surv(arms[0]), { ciType: 'log-log' });
    const km1 = kaplanMeier(surv(arms[1]), { ciType: 'log-log' });
    expect(km0.events).toBe(155);
    expect(km1.events).toBe(177);
    expect(km0.median!).toBeCloseTo(6.932238, 4);
    expect(km1.median!).toBeCloseTo(4.172485, 4);
    // 95% CI for the median (log-log), R: 5.552361–8.279261 and 3.975359–5.486653
    expect(km0.medianLower!).toBeCloseTo(5.552361, 4);
    expect(km0.medianUpper!).toBeCloseTo(8.279261, 4);
    expect(km1.medianLower!).toBeCloseTo(3.975359, 4);
    expect(km1.medianUpper!).toBeCloseTo(5.486653, 4);
  });

  it('stratified Cox hazard ratio (R efron 0.68059, breslow 0.68460)', () => {
    // R fits TRTP with "CBX-417 + Docetaxel" as the reference level, so coxph reports
    // placebo-vs-CBX (HR 1.469320 efron). The app codes CBX as 1, giving the reciprocal.
    const efron = coxPH(surv(), { ties: 'efron' });
    const breslow = coxPH(surv(), { ties: 'breslow' });
    expect(efron.hr[0]).toBeCloseTo(0.680587, 4);
    expect(breslow.hr[0]).toBeCloseTo(0.684603, 4);
    // R's CI for placebo-vs-CBX is 1.177869–1.832887; inverted and swapped for CBX-vs-placebo.
    expect(efron.hrLower[0]).toBeCloseTo(0.545588, 4);
    expect(efron.hrUpper[0]).toBeCloseTo(0.848991, 4);
  });

  it('stratified log-rank p-value (R: 0.00064224, chi-square 11.649379)', () => {
    const lr = logRank(surv());
    expect(lr.chiSquare).toBeCloseTo(11.649379, 4);
    expect(lr.p).toBeCloseTo(0.00064224, 7);
  });
});
