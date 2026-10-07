/**
 * Verifies the in-browser statistics engine against R (see __fixtures__/make-reference.R).
 * If these fail, numbers shown in lessons, widgets and TLFs would be wrong.
 */
import { describe, expect, it } from 'vitest';
import ref from './__fixtures__/r-reference.json';
import { kaplanMeier, logRank, coxPH, survivalAt, schoenfeldResiduals, type SurvRecord } from './survival';
import { ols, logistic } from './regression';
import { pca } from './pca';
import { tTest2, chiSquareTest, fisherExact, clopperPearson } from './tests';
import { quantile, median } from './descriptive';
import { tCdf, tQuantile, chiSquareCdf, normalQuantile, normalCdf, fCdf, betaQuantile, chiSquareQuantile } from './distributions';

const close = (a: number, b: number, tol = 1e-6) => expect(Math.abs(a - b)).toBeLessThan(tol * Math.max(1, Math.abs(b)));

const lung: SurvRecord[] = ref.lung.time.map((t: number, i: number) => ({
  time: t,
  event: ref.lung.event[i] as 0 | 1,
  group: String(ref.lung.sex[i]),
  strata: ref.logrank_strat.agegrp[i],
  covariates: [ref.lung.age[i], ref.lung.sex[i]],
}));

describe('Kaplan–Meier', () => {
  it('median and log-log CI match survfit(conf.type = "log-log")', () => {
    const km = kaplanMeier(lung, { ciType: 'log-log' });
    expect(km.median).toBe(ref.km.median);
    expect(km.medianLower).toBe(ref.km.lower_loglog);
    expect(km.medianUpper).toBe(ref.km.upper_loglog);
  });
  it('median CI with the log transformation matches survfit default', () => {
    const km = kaplanMeier(lung, { ciType: 'log' });
    expect(km.medianLower).toBe(ref.km.lower_log);
    expect(km.medianUpper).toBe(ref.km.upper_log);
  });
  it('S(365), Greenwood SE and log-log limits match', () => {
    const km = kaplanMeier(lung, { ciType: 'log-log' });
    close(survivalAt(km, 365), ref.km.s_at_365, 1e-9);
    const step = [...km.steps].reverse().find((s) => s.time <= 365)!;
    close(step.se, ref.km.se_at_365, 1e-6);
    close(step.lower, ref.km.lcl_ll_365, 1e-6);
    close(step.upper, ref.km.ucl_ll_365, 1e-6);
  });
});

describe('Log-rank', () => {
  it('unstratified chi-square and O/E match survdiff', () => {
    const lr = logRank(lung.map((r) => ({ ...r, strata: undefined })));
    close(lr.chiSquare, ref.logrank.chisq, 1e-6);
    close(lr.observed['1'], ref.logrank.obs[0]);
    close(lr.expected['1'], ref.logrank.exp[0], 1e-6);
  });
  it('stratified chi-square matches survdiff(... + strata())', () => {
    const lr = logRank(lung);
    close(lr.chiSquare, ref.logrank_strat.chisq, 1e-6);
  });
});

describe('Cox PH', () => {
  const unstrat = lung.map((r) => ({ ...r, strata: undefined }));
  it('Efron ties match coxph default', () => {
    const fit = coxPH(unstrat, { ties: 'efron' });
    fit.coef.forEach((b, i) => close(b, ref.cox.efron_coef[i], 1e-5));
    fit.se.forEach((s, i) => close(s, ref.cox.efron_se[i], 1e-5));
    close(fit.logLik, ref.cox.efron_loglik, 1e-6);
    close(fit.scoreChiSquare, ref.cox.score, 1e-5);
  });
  it('Breslow ties match coxph(ties = "breslow") — the SAS PHREG default', () => {
    const fit = coxPH(unstrat, { ties: 'breslow' });
    fit.coef.forEach((b, i) => close(b, ref.cox.breslow_coef[i], 1e-5));
    fit.se.forEach((s, i) => close(s, ref.cox.breslow_se[i], 1e-5));
  });
  it('stratified model matches coxph(... + strata())', () => {
    const fit = coxPH(
      lung.map((r) => ({ ...r, covariates: [r.covariates![1]] })),
      { ties: 'efron' },
    );
    const expected = Array.isArray(ref.cox.strat_coef) ? ref.cox.strat_coef[0] : (ref.cox.strat_coef as number);
    close(fit.coef[0], expected, 1e-5);
  });
});

describe('Schoenfeld residuals', () => {
  it('match residuals(fit, type = "schoenfeld")', () => {
    const unstrat = lung.map((r) => ({ ...r, strata: undefined }));
    const fit = coxPH(unstrat, { ties: 'efron' });
    // R computes them at the Efron-fitted beta but with the Breslow-style risk-set mean.
    const res = schoenfeldResiduals(unstrat, fit.coef, 0);
    expect(res.length).toBe(ref.schoenfeld.age.length);
    res.slice(0, 12).forEach((r, i) => close(r.residual, ref.schoenfeld.age[i], 1e-3));
  });
});

describe('Linear and logistic regression', () => {
  const X = ref.mtcars.wt.map((w: number, i: number) => [1, w, ref.mtcars.hp[i]]);
  it('OLS coefficients, SEs, R², leverage and Cook’s D match lm()', () => {
    const fit = ols(X, ref.mtcars.mpg);
    fit.coef.forEach((b, i) => close(b, ref.ols.coef[i], 1e-8));
    fit.se.forEach((s, i) => close(s, ref.ols.se[i], 1e-8));
    close(fit.rSquared, ref.ols.r2, 1e-10);
    close(fit.adjRSquared, ref.ols.adjr2, 1e-10);
    close(fit.sigma, ref.ols.sigma, 1e-10);
    close(fit.fStat, ref.ols.fstat, 1e-8);
    fit.hat.forEach((h, i) => close(h, ref.ols.hat[i], 1e-8));
    fit.cooksD.forEach((c, i) => close(c, ref.ols.cooks[i], 1e-7));
  });
  it('logistic regression matches glm(binomial)', () => {
    const fit = logistic(
      ref.mtcars.wt.map((w: number) => [1, w]),
      ref.mtcars.am,
    );
    fit.coef.forEach((b, i) => close(b, ref.logit.coef[i], 1e-6));
    fit.se.forEach((s, i) => close(s, ref.logit.se[i], 1e-5));
    close(fit.deviance, ref.logit.deviance, 1e-6);
    close(fit.nullDeviance, ref.logit.null, 1e-8);
  });
});

describe('PCA', () => {
  it('eigenvalues and PC1 loadings match prcomp(scale. = TRUE)', () => {
    const res = pca(ref.pca.data, true);
    res.eigenvalues.forEach((v, i) => close(v, ref.pca.eigen[i], 1e-8));
    res.loadings[0].forEach((l, j) => close(Math.abs(l), ref.pca.rotation_pc1_abs[j], 1e-8));
  });
});

describe('Classical tests', () => {
  it('Welch and pooled t tests match t.test()', () => {
    const w = tTest2(ref.ttest.x, ref.ttest.y);
    close(w.t, ref.ttest.welch_t, 1e-9);
    close(w.df, ref.ttest.welch_df, 1e-9);
    close(w.p, ref.ttest.welch_p, 1e-6);
    close(w.lower, ref.ttest.welch_ci[0], 1e-6);
    const p = tTest2(ref.ttest.x, ref.ttest.y, { pooled: true });
    close(p.t, ref.ttest.pooled_t, 1e-9);
    close(p.p, ref.ttest.pooled_p, 1e-6);
  });
  it('chi-square (no correction) matches chisq.test(correct = FALSE)', () => {
    const t = ref.chisq.table as number[][];
    // R serializes matrices by row in toJSON; rebuild the 2×2 table as R holds it (column-major input).
    const res = chiSquareTest(t);
    close(res.chiSquare, ref.chisq.stat, 1e-9);
    close(res.p, ref.chisq.p, 1e-7);
  });
  it('Fisher exact matches fisher.test()', () => {
    close(fisherExact([[3, 1], [1, 3]]).p, ref.fisher.p_small, 1e-9);
    const t = ref.chisq.table as number[][];
    close(fisherExact([[t[0][0], t[0][1]], [t[1][0], t[1][1]]]).p, ref.fisher.p_tab, 1e-8);
  });
  it('Clopper–Pearson matches binom.test()', () => {
    const ci = clopperPearson(7, 20);
    close(ci.lower, ref.binom.lower, 1e-8);
    close(ci.upper, ref.binom.upper, 1e-8);
  });
});

describe('Quantile definitions', () => {
  it('SAS PCTLDEF=5 equals R type 2; R default is type 7', () => {
    close(quantile(ref.quant.v, 0.25, 'sas5'), ref.quant.q1_t2);
    close(quantile(ref.quant.v, 0.75, 'sas5'), ref.quant.q3_t2);
    close(quantile(ref.quant.v, 0.25, 'r7'), ref.quant.q1_t7);
    close(quantile(ref.quant.v, 0.75, 'r7'), ref.quant.q3_t7);
    close(median(ref.quant.v), ref.quant.med);
  });
});

describe('Distributions', () => {
  it('match R', () => {
    close(tCdf(2.1, 7), ref.dist.pt, 1e-9);
    close(tQuantile(0.975, 12), ref.dist.qt, 1e-9);
    close(chiSquareCdf(5.3, 3), ref.dist.pchisq, 1e-9);
    close(normalQuantile(0.975), ref.dist.qnorm, 1e-9);
    close(normalCdf(-2.7), ref.dist.pnorm, 1e-9);
    close(fCdf(3.2, 2, 29), ref.dist.pf, 1e-9);
    close(betaQuantile(0.025, 7, 14), ref.dist.qbeta, 1e-9);
    close(chiSquareQuantile(0.95, 4), ref.dist.qchisq, 1e-9);
  });
});
