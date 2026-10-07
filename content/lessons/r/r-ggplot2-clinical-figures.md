## What problem are we trying to solve?

A reviewer asks you to zoom in on a box plot of change from baseline, because the outliers are squashing the boxes. You add one line:

```r
ggplot(w12, aes(TRTP, CHG)) + geom_boxplot() + ylim(-30, 10)
```

The figure looks better. It is also **no longer a picture of your data**:

```text
Warning message:
Removed 27 rows containing non-finite outside the scale range
(`stat_boxplot()`).
```

Twenty-seven subjects were deleted before the quartiles were computed. The boxes you are now looking at are the quartiles of the 211 subjects who happened to fall inside the window:

| Arm | Q1 → median → Q3, all 238 | Q1 → median → Q3, after `ylim()` |
|---|---|---|
| Placebo | −11.7 → −4.3 → **+5.3** | −12.25 → −5.0 → **+2.6** |
| VTX-221 20 mg | −19.7 → −12.7 → −6.0 | −17.3 → −12.0 → −7.3 |

The placebo arm's upper quartile moved from +5.3 mmHg to +2.6 mmHg. **The cosmetic change made placebo look better.** Nobody did anything dishonest; a scale limit in ggplot2 is a filter, and the warning scrolled past.

This lesson is the grammar of graphics as it applies to figures that go into a clinical study report: which layer does statistics, which layer only changes the viewport, and what makes a figure survive a regulatory reviewer, a photocopier and a colourblind reader.

## Intuition

A ggplot is not a picture. It is a **specification** evaluated in a fixed order:

$$
\text{data} \rightarrow \text{aes} \rightarrow \text{stat} \rightarrow \text{geom} \rightarrow \text{scale} \rightarrow \text{coord} \rightarrow \text{facet} \rightarrow \text{theme}
$$

Every clinical figure bug worth knowing comes from misreading that order.

- **`aes()` maps a column to a visual property.** `colour = TRTP` maps; `colour = "blue"` sets. Putting a constant inside `aes()` is the classic first-week error: ggplot creates a one-level legend labelled `"blue"`.
- **The `stat` computes.** `geom_boxplot()` silently runs `stat_boxplot()`, which computes quartiles from whatever rows reached it. `geom_smooth()` fits a model. `stat_summary()` computes means. If you have ever wondered where the numbers in a figure came from, this is the layer.
- **`scale_*` filters, `coord_*` zooms.** This is the distinction that opens the lesson, and it is the single most consequential thing in the whole grammar.

:::why[Why does a scale limit delete rows instead of just cropping?]
Because scales run **before** the stats. The scale's job is to convert data values into positions, and a value outside the limits has no position, so it becomes `NA` and the stat never sees it.

The coordinate system runs **after** the stats. `coord_cartesian(ylim = ...)` computes the quartiles on all 238 rows and then chooses which part of the panel to display.

| | Rows used by the stat | Effect |
|---|---|---|
| `ylim(a, b)` / `scale_y_continuous(limits = ...)` | only rows inside `[a, b]` | **subsets the data** |
| `coord_cartesian(ylim = c(a, b))` | all rows | zooms the viewport |

The rule that follows: **`coord_cartesian()` is the default for clinical work**, and `scale_*(limits = )` is what you reach for when you genuinely mean "restrict to this range", which in a CSR figure is almost never.

It matters for every stat-bearing geom — box plots, smoothers, `stat_summary()` means, histograms, density curves. It does not change anything for a plain `geom_point()` or `geom_line()`, where the "statistic" is the identity, which is why people learn the habit on scatter plots and then carry it into a box plot.
:::

## Clinical context

| CSR deliverable | ggplot2 skeleton |
|---|---|
| Mean change from baseline by visit | `geom_line()` + `geom_point()` + `geom_errorbar()`, dodged |
| Kaplan–Meier curve | `geom_step()` on `survfit` output, plus a risk-table panel |
| Subgroup forest plot | `geom_pointrange()` + `scale_x_log10()` + `geom_vline(xintercept = 1)` |
| Waterfall of best response | `geom_col()` on subjects sorted by value |
| Lab shift, baseline vs worst on-treatment | `geom_tile()` + `geom_text()`, faceted by arm |
| Spaghetti / individual profiles | `geom_line(aes(group = USUBJID))` |
| Box plot by arm and visit | `geom_boxplot()` — with `coord_cartesian()`, never `ylim()` |

**Four properties separate a figure a reviewer accepts from one they send back**, and none of them are about aesthetics:

1. **Every axis carries its unit.** "Change from baseline" is not a label; "Mean change from baseline in seated SBP (mmHg)" is.
2. **Every denominator is visible.** The n contributing at each visit belongs on the figure, because it falls over time and the reader cannot otherwise tell whether the last point rests on 80 subjects or 8.
3. **No truncated axis on a ratio or a change.** A y-axis that starts at −5 instead of 0 makes a 2 mmHg difference look like a treatment effect.
4. **It works in greyscale and for a colourblind reader.** Figures get photocopied, printed by reviewers and read by roughly 1 in 12 men with a red–green deficiency. Colour must never be the *only* thing distinguishing two arms.

:::mistake[Encoding the arm with colour alone]
`aes(colour = TRTP)` and nothing else. In greyscale the two curves become two grey lines of identical weight, and the figure is unreadable — which is how it arrives on a reviewer's desk after being printed.

**Redundant encoding is the fix**: map the arm to `colour` *and* `linetype` (for lines) or *and* `shape` (for points). The figure then carries the same information twice, and either channel alone is sufficient.

```r
ggplot(chg, aes(AVISIT, mean, colour = TRTP, shape = TRTP, linetype = TRTP, group = TRTP))
```

For the palette, R ≥ 4.0 ships the Okabe–Ito colourblind-safe set in base:

```r
palette.colors(palette = "Okabe-Ito")
#> "#000000" "#E69F00" "#56B4E9" "#009E73" "#F0E442" "#0072B2" "#D55E00" "#CC79A7" "#999999"
```

`scale_colour_manual(values = palette.colors(palette = "Okabe-Ito")[c(6, 7)])` gives a blue and a vermilion that are distinguishable under every common form of colour vision deficiency and differ in lightness, so they also survive greyscale. ggplot2's default `scale_colour_hue()` does not: its colours are equal-lightness by construction, which is exactly what makes them collapse to the same grey.
:::

## Formal concept

### `stat_summary()` versus pre-computing

Two ways to put a mean on a figure:

```r
# (a) let the plot compute it
ggplot(sbp, aes(AVISIT, CHG, colour = TRTP)) +
  stat_summary(fun = mean, geom = "point")

# (b) compute it, then plot it
chg <- sbp |> summarise(mean = mean(CHG, na.rm = TRUE), .by = c(TRTP, AVISIT))
ggplot(chg, aes(AVISIT, mean, colour = TRTP)) + geom_point()
```

**For a CSR figure, always (b).** The summarised data frame is the thing a QC programmer compares against the corresponding table, and it is the thing you can assert on. A figure whose numbers exist only inside a `stat_` layer cannot be checked against anything without redrawing it.

### Error bars: decide what they mean, then say so

`geom_errorbar()` draws whatever you hand it. Three common choices, on the same Week 12 data (VTX-221 20 mg, $n = 80$, mean change $-12.28$ mmHg):

| Bar | Half-width | Interval |
|---|---:|---|
| $\pm 1$ SD | 11.50 | −23.77 to −0.78 |
| $\pm 1$ SE | 1.29 | −13.56 to −10.99 |
| 95% CI | 2.56 | −14.84 to −9.72 |

They differ by a factor of nine. **SD describes the spread of subjects; SE and CI describe the precision of the mean.** Neither is wrong, and a figure that does not say which one it drew is uninterpretable. The convention in efficacy figures is SE or a 95% CI, stated in the subtitle or footnote.

:::number[Where do these three numbers come from?]
From `advs.csv`, systolic records at Week 12 with `ANL01FL = "Y"`, VTX-221 20 mg arm:

$$n = 80, \qquad \bar{x} = -12.276, \qquad s = 11.497$$

$$\mathrm{SE} = \frac{s}{\sqrt{n}} = \frac{11.497}{\sqrt{80}} = 1.285$$

The 95% CI half-width is $t_{0.975,\,79} \times \mathrm{SE} = 1.9905 \times 1.285 = 2.558$.

These are **observed-case** summaries, not the model-based LS means from the ANCOVA. The two differ — the figure's arithmetic mean is −12.28 while the ANCOVA LS mean at the analysis-set mean baseline is −11.77 — because the LS mean adjusts for baseline. **A figure showing raw means beside a table showing LS means is a QC finding waiting to be raised**, and the honest fix is to label the figure "observed" and say so in the footnote, or to plot the LS means.
:::

### Forest plots need a log axis

Hazard ratios are multiplicative: 0.5 and 2.0 are the same size of effect in opposite directions. On a linear axis 0.5 sits 0.5 units from the null and 2.0 sits 1.0 units away, so the figure literally draws harm as twice as large as the equivalent benefit.

```r
scale_x_log10(breaks = c(0.25, 0.5, 1, 2, 4))
```

Confidence intervals become visually symmetric about the point estimate, which is what they are on the log scale, and that is where the Cox model computed them.

:::standard{kind="convention"}
Reporting subgroup hazard ratios as a forest plot with the overall estimate at the top, a reference line at 1, and n and event counts printed beside each row is a **widespread industry convention**, not a regulatory requirement. ICH E9 section 5.7 discusses subgroup analyses and cautions about interpreting them; it does not prescribe a figure format. Journal and sponsor templates differ on details such as whether box areas are weighted by precision.
:::

## Worked example

**Mean change from baseline in seated SBP by visit, VTX221-201.** Every element on the figure is there for a reason.

```r
library(ggplot2); library(dplyr)

chg <- advs |>
  filter(PARAMCD == "SYSBP", ANL01FL == "Y", AVISITN > 0) |>
  summarise(n    = sum(!is.na(CHG)),
            mean = mean(CHG, na.rm = TRUE),
            se   = sd(CHG, na.rm = TRUE) / sqrt(sum(!is.na(CHG))),
            .by  = c(TRTP, AVISIT, AVISITN)) |>
  mutate(AVISIT = factor(AVISIT,
                         levels = c("WEEK 2", "WEEK 4", "WEEK 8", "WEEK 12"),
                         labels = c("Week 2", "Week 4", "Week 8", "Week 12")),
         TRTP   = factor(TRTP, levels = c("Placebo", "VTX-221 10 mg", "VTX-221 20 mg")))

pal   <- unname(palette.colors(palette = "Okabe-Ito")[c(9, 6, 7)])
dodge <- position_dodge(width = 0.55)

ggplot(chg, aes(AVISIT, mean, colour = TRTP, shape = TRTP,
                linetype = TRTP, group = TRTP)) +
  geom_hline(yintercept = 0, linewidth = 0.3, colour = "grey50") +
  geom_line(linewidth = 0.6, position = dodge) +
  geom_errorbar(aes(ymin = mean - se, ymax = mean + se),
                width = 0.25, linewidth = 0.45, linetype = 1, position = dodge) +
  geom_point(size = 2.2, position = dodge) +
  geom_text(aes(y = -17.8, label = n), position = dodge, size = 2.7,
            show.legend = FALSE, colour = "grey25") +
  scale_y_continuous(breaks = seq(-15, 5, 5)) +
  coord_cartesian(ylim = c(-18.5, 2)) +
  scale_colour_manual(values = pal) +
  labs(x = NULL, y = "Mean change from baseline in seated SBP (mmHg)",
       colour = NULL, shape = NULL, linetype = NULL,
       title    = "Mean change from baseline in seated systolic blood pressure",
       subtitle = "ITT population, observed cases; error bars are +/- 1 standard error",
       caption  = "n below each visit = subjects with a non-missing change at that visit.") +
  theme_classic(base_size = 11) +
  theme(legend.position = "top", plot.caption = element_text(hjust = 0, size = 8))
```

**The summarised data first.** Four lines of dplyr produce a twelve-row data frame that a QC programmer can compare against the table without opening the figure.

**`AVISIT` as an ordered factor, not `AVISITN`.** Weeks 2, 4, 8 and 12 are not equally spaced in time, and plotting them on a continuous axis draws a gap between Week 4 and Week 8 that encodes nothing the study measured. Categorical spacing is the convention for a by-visit figure; a continuous time axis is right when the x value is an actual elapsed time.

**`position_dodge()` on every layer.** Points, lines, error bars and the n labels all need the same dodge or they separate from each other. Forgetting it on one layer is the commonest cause of an error bar floating beside its point.

**`linetype = 1` inside `geom_errorbar()`.** Without it the error bars inherit the dashed line type from the arm mapping, and a dashed error bar is illegible at print size. Setting an aesthetic inside a geom overrides the inherited mapping for that layer only.

**`geom_text()` for the n row.** A denominator that appears in the figure itself, not in a caption a reader has to cross-reference. It falls from 87 to 77 in the placebo arm over twelve weeks, and that decline is information about the trial.

**`coord_cartesian()`, not `ylim()`.** Because of everything in the opening.

### Output

```text
            TRTP AVISITN  n    mean     se
1        Placebo       2 87  -1.925 0.8427
2  VTX-221 10 mg       2 85  -5.719 0.8832
3  VTX-221 20 mg       2 85  -7.869 0.7189
4        Placebo       4 84  -3.052 1.0724
5  VTX-221 10 mg       4 85  -6.711 0.9313
6  VTX-221 20 mg       4 81 -10.802 0.9254
7        Placebo       8 82  -3.282 1.1283
8  VTX-221 10 mg       8 79  -7.877 1.1650
9  VTX-221 20 mg       8 82 -12.270 1.1247
10       Placebo      12 77  -3.300 1.3231
11 VTX-221 10 mg      12 81  -8.828 1.2760
12 VTX-221 20 mg      12 80 -12.276 1.2854
```

## Data example

::dataset{id="cardio/adam/advs" cols="USUBJID,TRTP,PARAMCD,AVISIT,AVISITN,AVAL,BASE,CHG,ANL01FL" rows="8" caption="ADVS — the figure above is twelve rows summarised from these 3,082"}

### The Kaplan–Meier figure and its risk table

A KM curve without a number-at-risk table is incomplete, because a curve resting on four subjects looks exactly like one resting on four hundred. `survfit` objects are not data frames, so the first job is to get the curve out.

```r
library(survival); library(cowplot)

pfs <- adtte |>
  filter(PARAMCD == "PFS") |>
  mutate(event = as.integer(CNSR == 0), months = AVAL / 30.4375)
pfs$TRTP <- relevel(factor(pfs$TRTP), ref = "Placebo + Docetaxel")

km   <- survfit(Surv(months, event) ~ TRTP, data = pfs, conf.type = "log-log")
arms <- sub("^TRTP=", "", names(km$strata))

curve <- rbind(
  data.frame(time = 0, surv = 1, n.censor = 0, arm = arms),
  data.frame(time = km$time, surv = km$surv, n.censor = km$n.censor,
             arm  = rep(arms, km$strata)))

brk  <- seq(0, 24, by = 3)
s    <- summary(km, times = brk, extend = TRUE)
risk <- data.frame(arm  = sub("^TRTP=", "", as.character(s$strata)),
                   time = s$time, n.risk = s$n.risk)
```

:::number[Why the extra row at time 0, and why `extend = TRUE`?]
**`survfit` does not store a row at $t = 0$.** Its `time` vector starts at the first event or censoring time, so `geom_step()` would begin the curve partway down the panel. Binding on a row with `surv = 1` per arm is what makes the curve start at 100%.

**`summary(km, times = brk)` silently drops any requested time beyond the last observed follow-up in a stratum.** Maximum follow-up here is 29.67 months on placebo and 31.87 on CBX-417, so asking for `seq(0, 36, by = 6)` without `extend = TRUE` returns **five rows for placebo and six for CBX-417** — the 30-month placebo row simply does not exist. The risk table then has a different number of columns per arm and the two rows stop lining up under the axis, a defect that is invisible until someone counts the columns. With `extend = TRUE` every requested time gets a row.

The resulting risk table, at three-month intervals:

| Months | 0 | 3 | 6 | 9 | 12 | 15 | 18 | 21 | 24 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Placebo + Docetaxel | 210 | 115 | 63 | 37 | 28 | 23 | 11 | 6 | 4 |
| CBX-417 + Docetaxel | 210 | 125 | 92 | 65 | 40 | 32 | 20 | 11 | 7 |

By month 21 the placebo curve is supported by **six** subjects. Every step in that region moves the curve by a sixth of its remaining height, and the eye reads it as a flattening plateau.
:::

Two panels, aligned by sharing one x scale and one coordinate range:

```r
xsc <- scale_x_continuous(breaks = brk, expand = expansion(mult = 0.02))

p_km <- ggplot(curve, aes(time, surv, colour = arm, linetype = arm)) +
  geom_step(linewidth = 0.7) +
  geom_point(data = subset(curve, n.censor > 0), shape = 3, size = 1.6,
             show.legend = FALSE) +
  xsc +
  scale_y_continuous(labels = scales::percent_format(accuracy = 1),
                     expand = expansion(mult = c(0.01, 0.03))) +
  coord_cartesian(xlim = c(0, 24), ylim = c(0, 1)) +
  scale_colour_manual(
    values = unname(palette.colors(palette = "Okabe-Ito")[c(6, 7)])) +
  labs(x = NULL, y = "Progression-free survival (%)",
       colour = NULL, linetype = NULL,
       title    = "Kaplan-Meier estimates of progression-free survival",
       subtitle = "ITT population (N = 420); investigator assessment per RECIST 1.1") +
  theme_classic(base_size = 11) +
  theme(legend.position = "top",
        axis.text.x = element_blank(), axis.ticks.x = element_blank())

p_risk <- ggplot(risk, aes(time, factor(arm, levels = rev(arms)))) +
  geom_text(aes(label = n.risk), size = 3.1) +
  xsc + coord_cartesian(xlim = c(0, 24)) +
  labs(x = "Months from randomization", y = NULL, title = "Number at risk") +
  theme_classic(base_size = 11) +
  theme(axis.line.y = element_blank(), axis.ticks.y = element_blank(),
        plot.title  = element_text(size = 9.5))

plot_grid(p_km, p_risk, ncol = 1, align = "v", axis = "lr",
          rel_heights = c(3.4, 1))
```

**`align = "v", axis = "lr"`** is what makes the two panels line up. Without it, the longer y-axis labels on the top panel push its plotting area right and the risk numbers sit under the wrong times — a figure that is wrong in a way that looks like a rendering artefact.

**`shape = 3` on censored times** draws the plus-mark tick a reader expects. `n.censor > 0` selects them; there are 62 such times in this fit.

**`coord_cartesian(xlim = c(0, 24))` again.** Using `scale_x_continuous(limits = c(0, 24))` here warns `Removed 11 rows containing missing values or values outside the scale range (geom_step())` and clips the curve at the boundary rather than drawing it up to it.

::widget{name="km-study" endpoint="PFS"}

### Subgroup forest and lab shift

The same habit — pre-compute, then plot — covers the other two figures in a standard package. Subgroup hazard ratios for PFS, one `coxph` fit per subgroup:

| Subgroup | n | Events | HR | 95% CI |
|---|---:|---:|---:|---|
| All subjects | 420 | 332 | 0.685 | 0.551 to 0.851 |
| Female | 170 | 136 | 0.741 | 0.527 to 1.041 |
| Male | 250 | 196 | 0.643 | 0.484 to 0.853 |
| ECOG 0 | 159 | 121 | 0.655 | 0.456 to 0.942 |
| ECOG 1 | 246 | 196 | 0.701 | 0.527 to 0.932 |
| ECOG 2 | 15 | 15 | 0.997 | 0.348 to 2.858 |
| PD-L1 ≥ 50% | 94 | 75 | 0.506 | 0.315 to 0.811 |

**The ECOG 2 row is why a forest plot prints its n.** Fifteen subjects give an interval from 0.35 to 2.86 — compatible with a large benefit and a large harm at once. Without the n beside it, a reader can take the point estimate of 1.00 as "no effect in this subgroup" rather than as no information.

::widget{name="forest-plot" endpoint="PFS"}

A shift figure is a two-way count rendered as tiles. Baseline versus worst post-baseline neutrophil grade, safety population:

| Baseline grade | Worst 0 | 1 | 2 | 3 | 4 |
|---|---:|---:|---:|---:|---:|
| CBX-417 + Docetaxel, grade 0 | 95 | 23 | 28 | 29 | 33 |
| CBX-417 + Docetaxel, grade 1 | 0 | 1 | 0 | 0 | 0 |
| Placebo + Docetaxel, grade 0 | 92 | 25 | 38 | 28 | 24 |

`geom_tile(aes(fill = n)) + geom_text(aes(label = n))` is the whole figure. **Print the counts on the tiles** — a fill gradient alone makes the reader estimate from a colour key — and take the gradient from `scale_fill_viridis_c()` or a ColorBrewer sequential palette rather than ggplot2's default, which is not colourblind-safe.

## Code

::::tabs
:::tab[SAS]
```sas
data chg;
  set chg;                      /* trtp avisit mean se, one row per arm/visit */
  lcl = mean - se;
  ucl = mean + se;
run;

proc sgplot data=chg noautolegend;
  styleattrs datacontrastcolors=(gray 'CX0072B2' 'CXD55E00')
             datalinepatterns=(solid dot dash);
  series  x=avisit y=mean  / group=trtp markers
                             markerattrs=(symbol=circlefilled);
  scatter x=avisit y=mean  / group=trtp yerrorlower=lcl yerrorupper=ucl;
  refline 0 / axis=y lineattrs=(color=gray);
  yaxis label="Mean change from baseline in seated SBP (mmHg)"
        values=(-15 to 5 by 5);
  xaxis display=(nolabel) discreteorder=data;
  keylegend / position=top noborder;
run;
```

:::lines
8: `STYLEATTRS` is where the palette is pinned. The hex values are Okabe–Ito blue and vermilion, so the SAS and R versions of the same figure use the same colours — worth doing when production is SAS and a figure is redrawn in R for a publication.
9: `DATALINEPATTERNS` supplies the redundant encoding. Without it, the three arms differ only by colour and the figure fails in greyscale exactly as the R version would.
13: `REFLINE 0` marks no-change. On a change-from-baseline figure the zero line is not decoration; it is the comparator.
15: `VALUES=` fixes the displayed range and the tick positions. Note that this figure plots **pre-computed** means and limits from an input dataset, so no statistic is being derived from whatever the axis shows — which is the general reason to pre-compute rather than to rely on a plotting procedure's range semantics in any language.
16: `DISCRETEORDER=DATA` keeps the visits in dataset order instead of sorting them alphabetically, which would put Week 12 before Week 2 — the SAS version of R's factor-level problem.
:::
:::

:::tab[R]
```r
library(ggplot2); library(dplyr)

chg <- advs |>
  filter(PARAMCD == "SYSBP", ANL01FL == "Y", AVISITN > 0) |>
  summarise(n    = sum(!is.na(CHG)),
            mean = mean(CHG, na.rm = TRUE),
            se   = sd(CHG, na.rm = TRUE) / sqrt(sum(!is.na(CHG))),
            .by  = c(TRTP, AVISIT, AVISITN))

stopifnot(nrow(chg) == 12, all(chg$n > 0))

p <- ggplot(chg, aes(AVISIT, mean, colour = TRTP, shape = TRTP,
                     linetype = TRTP, group = TRTP)) +
  geom_hline(yintercept = 0, linewidth = 0.3, colour = "grey50") +
  geom_line(position = position_dodge(0.55)) +
  geom_errorbar(aes(ymin = mean - se, ymax = mean + se),
                width = 0.25, linetype = 1, position = position_dodge(0.55)) +
  geom_point(size = 2.2, position = position_dodge(0.55)) +
  coord_cartesian(ylim = c(-18.5, 2)) +
  labs(y = "Mean change from baseline in seated SBP (mmHg)")

ggsave("f-sbp-chg.pdf", p, width = 7, height = 4.6, device = cairo_pdf)
```

:::lines
5: `sum(!is.na(CHG))` rather than `n()` — the denominator must be the number of subjects contributing a change, not the number of records reaching the summarise.
10: The assertion. Twelve rows is three arms by four visits; a thirteenth row means a stray visit label or an arm value the factor did not anticipate, and it is far easier to catch here than in the rendered figure.
17: `linetype = 1` set inside the geom overrides the inherited mapping for the error bars only, so they stay solid while the connecting lines stay dashed.
19: `coord_cartesian()` zooms. `ylim()` would filter.
22: `ggsave()` takes the dimensions in inches and writes the device from the file extension. `cairo_pdf` embeds fonts, which is what stops a figure re-rendering with substituted glyphs on someone else's machine.
:::
:::

:::tab[Python]
```python
import matplotlib.pyplot as plt

chg = (advs.query("PARAMCD == 'SYSBP' and ANL01FL == 'Y' and AVISITN > 0")
          .groupby(["TRTP", "AVISIT"], observed=True)
          .agg(n=("CHG", "count"), mean=("CHG", "mean"), sd=("CHG", "std"))
          .reset_index())
chg["se"] = chg["sd"] / chg["n"] ** 0.5

fig, ax = plt.subplots(figsize=(7, 4.6))
for (arm, d), style in zip(chg.groupby("TRTP"), ["-o", ":^", "--s"]):
    ax.errorbar(d.AVISIT, d["mean"], yerr=d.se, fmt=style, capsize=3, label=arm)
ax.set_ylim(-18.5, 2)
ax.set_ylabel("Mean change from baseline in seated SBP (mmHg)")
fig.savefig("f-sbp-chg.pdf")
```

:::lines
5: `.agg(n=("CHG", "count"))` counts non-null values, matching `sum(!is.na(CHG))`. `.size()` would count rows including missing ones.
7: pandas `.std()` uses `ddof = 1`, matching R's `sd()`. NumPy's `np.std()` defaults to `ddof = 0` and gives a different standard error.
12: **`ax.set_ylim()` in matplotlib zooms; it does not drop data.** matplotlib has no equivalent of ggplot2's filtering scale limits, which is why this particular trap is R-specific.
:::
:::
::::

## Output

```text
> summary(km, times = c(0, 6, 12, 18, 24), extend = TRUE)$n.risk
 [1] 210  63  28  11   4 210  92  40  20   7
```

:::number[Why does the risk count fall so much faster than the event count?]
Because subjects leave the risk set for **two** reasons: they have an event, or they are censored.

Of the 210 placebo subjects, 176 had an event within 24 months and **30 were censored within 24 months**, leaving the 4 still at risk. Those 30 left through administrative censoring at the 31 March 2025 cut-off, a new anticancer therapy, or missed assessments — not through progression.

**This is precisely what makes the risk table indispensable.** The curve at month 24 is drawn from 4 and 7 subjects. Nothing in the curve's appearance says so, and a reader without the table will treat the tail as if it carried the same weight as the first six months.
:::

## Interpretation

> Mean change from baseline in seated systolic blood pressure at Week 12 was **−3.30 mmHg (SE 1.32, n = 77)** on placebo, **−8.83 mmHg (SE 1.28, n = 81)** on VTX-221 10 mg and **−12.28 mmHg (SE 1.29, n = 80)** on VTX-221 20 mg. The separation was apparent by Week 2 and the dose ordering was maintained at every visit.

:::clinical
The figure shows three things the corresponding table does not.

**The time course.** Most of the 20 mg effect is present by Week 4 (−10.8 mmHg of the eventual −12.3) and the curve is flat from Week 8 onward. That is a plateau, and it is the kind of statement a table of four separate visits makes a reader assemble for themselves.

**The dose ordering is consistent, not just present at the endpoint.** The 20 mg arm sits below the 10 mg arm at all four visits. Non-overlapping error bars are not a test and a figure is never where a comparison is made — but a *reversal* at one visit would need explaining, and there is none.

**The denominators fall**: placebo 87, 84, 82, 77. Subjects who discontinue for lack of efficacy leave the observed-case mean and are not a random subset, which is the argument for the pre-specified analysis being a model that uses all the data rather than a mean at one visit.
:::

## Common mistakes

:::mistake[`ylim()` or `scale_*(limits = )` on a figure with a stat]
Scale limits run before the stats, so out-of-range rows are deleted before the quartiles, means or smoothers are computed. Twenty-seven dropped subjects moved a placebo upper quartile from +5.3 to +2.6. Use `coord_cartesian()` to zoom.
:::

:::mistake[Encoding the treatment arm with colour alone]
The figure becomes unreadable in greyscale and for a colourblind reader. Map the arm to `linetype` or `shape` as well, and take the palette from `palette.colors(palette = "Okabe-Ito")` rather than ggplot2's default hue scale, whose colours have equal lightness by construction.
:::

:::mistake[A Kaplan–Meier figure with no number-at-risk table]
The tail of the curve carries no information about how many subjects support it. Here the placebo curve rests on 6 subjects at month 21 and 4 at month 24, and the curve looks identical to one based on hundreds.
:::

:::mistake[Error bars with no stated meaning]
SD, SE and 95% CI differ by a factor of nine on this data. The subtitle or footnote must say which was drawn, and an efficacy figure normally shows SE or a CI rather than SD.
:::

:::mistake[Putting a constant inside `aes()`]
`aes(colour = "red")` maps the literal string `"red"` to the colour scale and produces a one-level legend in ggplot2's default palette — usually pink. Constants go outside `aes()`: `geom_line(colour = "red")`.
:::

:::mistake[Dodging some layers and not others]
`position_dodge()` must be passed to every layer that should move together. A dodged point with an undodged error bar looks like a rendering bug and is a specification bug.
:::

## Knowledge check

::quiz{ids="r.ggplot.scale-vs-coord,r.ggplot.aes-constant,r.ggplot.errorbar-meaning,r.ggplot.greyscale"}

## Hands-on exercise

::practice{ids="r.ggplot.summarise-first,r.ggplot.risk-table-n,r.ggplot.forest-axis,r.ggplot.chg-figure-code" title="Practice: building a by-visit efficacy figure"}

## Challenge exercise

::practice{ids="r.ggplot.truncated-axis,r.ggplot.km-panel-code,r.ggplot.open" title="Challenge: the figure that flattered the control arm"}

## Industry note

**Figures are deliverables with specifications, like tables.** The figure shell states the title, the axis labels and units, the population, what the error bars are, the footnotes and the physical size. Your job is to match it, not to improve on it — a figure that is prettier than the shell is a deviation.

**Size and resolution are part of the spec.** `ggsave(width =, height =, dpi =)` takes inches, and text scales with `base_size` rather than with the file dimensions — so enlarging a figure shrinks its apparent text. Vector output (PDF or SVG) is preferred over PNG, and `device = cairo_pdf` embeds the fonts so the figure does not re-render differently elsewhere.

**`survminer::ggsurvplot()` produces a KM figure with a risk table in one call** and is a reasonable choice for exploratory work. For a deliverable, building the two panels yourself is usually less effort in the end, because the shell will specify something the wrapper does not expose.

:::standard{kind="convention"}
The four properties listed in this lesson — units on axes, visible denominators, untruncated axes on changes and ratios, and greyscale/colourblind safety — are **good practice and common sponsor requirements**, not CDISC or FDA rules. No ICH guideline or FDA guidance prescribes figure colours or axis ranges. What regulators do require is that a submitted result be reproducible and traceable to the data that produced it, which is an argument for the pre-compute-then-plot habit rather than for any particular aesthetic.
:::

**Accessibility is increasingly a procurement requirement** rather than a courtesy, particularly for material that will be published. Redundant encoding and a safe palette cost one extra aesthetic mapping and one `scale_colour_manual()` call, and are far cheaper to build in than to retrofit across a figure package.

:::interview[How would you check that a figure is telling the truth about the data?]
Four checks, and the first one is the one most people skip.

"**Did anything get dropped?** In ggplot2 a scale limit is a filter — `ylim()` deletes rows before the stat runs, so a box plot's quartiles or a smoother's fit can be computed on a subset. The symptom is a `Removed n rows containing non-finite outside the scale range` warning, and in a long script that warning is easy to lose. I'd look for scale limits on any stat-bearing geom and replace them with `coord_cartesian()`. On the study I've been working with, a −30 to +10 window on a change-from-baseline box plot dropped 27 of 238 subjects and moved the placebo upper quartile by nearly 3 mmHg in the direction that flattered the control arm.

**Do the numbers in the figure match the table?** They should be the same summarised data frame. If the figure computes its means inside a `stat_summary()` layer there is nothing to compare, so I'd pre-compute, assert the row count, and feed the same object to both.

**Are the denominators visible?** An observed-case mean at the last visit can rest on 60% of the randomized subjects, and a KM tail on four. The n row and the risk table are what stop a reader over-reading the right-hand side of the figure.

**Is the axis honest?** No truncated axis on a change or a ratio, a reference line at the null, and a log scale on a forest plot so a hazard ratio of 0.5 and one of 2.0 sit the same distance from 1.

And one about the reader rather than the data: does it survive greyscale? If colour is the only thing separating two arms, the figure stops working the moment someone prints it."
:::
