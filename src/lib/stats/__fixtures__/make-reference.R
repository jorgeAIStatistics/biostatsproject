# Generates reference values for src/lib/stats/*.test.ts using base R + survival.
# Run: Rscript src/lib/stats/__fixtures__/make-reference.R
suppressMessages(library(survival)); suppressMessages(library(jsonlite))
out <- list()
lung2 <- na.omit(survival::lung[, c("time", "status", "sex", "age")])
lung2$event <- as.integer(lung2$status == 2)
out$lung <- list(time = lung2$time, event = lung2$event, sex = lung2$sex, age = lung2$age)
fit_ll <- survfit(Surv(time, event) ~ 1, data = lung2, conf.type = "log-log")
fit_log <- survfit(Surv(time, event) ~ 1, data = lung2, conf.type = "log")
q_ll <- quantile(fit_ll, 0.5); q_log <- quantile(fit_log, 0.5)
out$km <- list(median = unname(q_ll$quantile), lower_loglog = unname(q_ll$lower), upper_loglog = unname(q_ll$upper),
  lower_log = unname(q_log$lower), upper_log = unname(q_log$upper),
  s_at_365 = summary(fit_ll, times = 365)$surv, se_at_365 = summary(fit_ll, times = 365)$std.err,
  lcl_ll_365 = summary(fit_ll, times = 365)$lower, ucl_ll_365 = summary(fit_ll, times = 365)$upper)
lr <- survdiff(Surv(time, event) ~ sex, data = lung2)
out$logrank <- list(chisq = unname(lr$chisq), obs = unname(lr$obs), exp = unname(lr$exp))
lung2$agegrp <- ifelse(lung2$age >= 65, "old", "young")
lrs <- survdiff(Surv(time, event) ~ sex + strata(agegrp), data = lung2)
out$logrank_strat <- list(chisq = unname(lrs$chisq), agegrp = lung2$agegrp)
ce <- coxph(Surv(time, event) ~ age + sex, data = lung2, ties = "efron")
cb <- coxph(Surv(time, event) ~ age + sex, data = lung2, ties = "breslow")
cs <- coxph(Surv(time, event) ~ sex + strata(agegrp), data = lung2, ties = "efron")
out$cox <- list(efron_coef = unname(coef(ce)), efron_se = unname(sqrt(diag(vcov(ce)))), breslow_coef = unname(coef(cb)),
  breslow_se = unname(sqrt(diag(vcov(cb)))), strat_coef = unname(coef(cs)), efron_loglik = ce$loglik[2], score = unname(ce$score))
sch <- residuals(ce, type = "schoenfeld")
out$schoenfeld <- list(times = as.numeric(rownames(sch)), age = unname(sch[, "age"]), sex = unname(sch[, "sex"]))
m <- lm(mpg ~ wt + hp, data = mtcars)
out$mtcars <- list(mpg = mtcars$mpg, wt = mtcars$wt, hp = mtcars$hp, am = mtcars$am)
out$ols <- list(coef = unname(coef(m)), se = unname(summary(m)$coefficients[, 2]), r2 = summary(m)$r.squared,
  adjr2 = summary(m)$adj.r.squared, sigma = summary(m)$sigma, hat = unname(hatvalues(m)), cooks = unname(cooks.distance(m)),
  fstat = unname(summary(m)$fstatistic[1]))
g <- glm(am ~ wt, data = mtcars, family = binomial, control = glm.control(epsilon = 1e-14, maxit = 100))
out$logit <- list(coef = unname(coef(g)), se = unname(summary(g)$coefficients[, 2]), deviance = g$deviance, null = g$null.deviance)
pc <- prcomp(USArrests, scale. = TRUE)
out$pca <- list(data = unname(as.matrix(USArrests)), eigen = unname(pc$sdev^2), rotation_pc1_abs = unname(abs(pc$rotation[, 1])))
x <- sleep$extra[sleep$group == 1]; y <- sleep$extra[sleep$group == 2]
tw <- t.test(x, y); tp <- t.test(x, y, var.equal = TRUE)
out$ttest <- list(x = x, y = y, welch_t = unname(tw$statistic), welch_df = unname(tw$parameter), welch_p = tw$p.value,
  welch_ci = unname(tw$conf.int), pooled_t = unname(tp$statistic), pooled_p = tp$p.value)
tab <- matrix(c(12, 5, 7, 16), nrow = 2)
out$chisq <- list(table = tab, stat = unname(chisq.test(tab, correct = FALSE)$statistic), p = chisq.test(tab, correct = FALSE)$p.value)
ft <- fisher.test(matrix(c(3, 1, 1, 3), 2)); ft2 <- fisher.test(tab)
out$fisher <- list(p_small = ft$p.value, p_tab = ft2$p.value)
bt <- binom.test(7, 20)
out$binom <- list(lower = bt$conf.int[1], upper = bt$conf.int[2])
v <- c(1, 3, 3, 4, 7, 8, 10, 12, 15, 21)
out$quant <- list(v = v, q1_t2 = unname(quantile(v, 0.25, type = 2)), q3_t2 = unname(quantile(v, 0.75, type = 2)),
  q1_t7 = unname(quantile(v, 0.25, type = 7)), q3_t7 = unname(quantile(v, 0.75, type = 7)), med = median(v))
out$dist <- list(pt = pt(2.1, 7), qt = qt(0.975, 12), pchisq = pchisq(5.3, 3), qnorm = qnorm(0.975), pnorm = pnorm(-2.7),
  pf = pf(3.2, 2, 29), qbeta = qbeta(0.025, 7, 14), qchisq = qchisq(0.95, 4))
writeLines(toJSON(out, digits = NA, auto_unbox = TRUE), "src/lib/stats/__fixtures__/r-reference.json")
cat("ok\n")
