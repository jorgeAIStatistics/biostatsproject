## What problem are we trying to solve?

The ADSL specification for CBX417-301 asks for two simple derivations:

- `BMIBL` — baseline body-mass index, `WEIGHTBL / (HEIGHTBL/100)**2`;
- `AGEGR1` — `"<65"` or `">=65"`.

You write six lines of code, run them, and the log says all is well. Then QC finds that one subject has no BMI, another has an age group although you expected otherwise, and a colleague's version of the same step produced **zero** observations in one of its datasets.

None of these is a SAS bug. Each follows directly from **how the DATA step executes** — a model so central that interviewers routinely ask candidates to explain it. Once you can "run the DATA step in your head", surprises like these become predictable, and so do RETAIN, LAG, MERGE and BY-group behaviour in later lessons.

## Intuition

The DATA step is **a loop you never write**.

1. Before anything runs, SAS reads your whole step once to plan it: which variables will exist, whether each is character or numeric, how long it is. It lays out a single working row with one slot per variable. That working row is the **Program Data Vector (PDV)**.
2. Then SAS loops: **read one observation into the PDV → run your statements top to bottom on that one row → write the row out → go back to the top.**
3. At the top of each loop, variables that your statements *create* are wiped to missing, because each row must be computed fresh. Variables that come from the input dataset are simply overwritten by the next read.
4. The loop ends when the `SET` statement tries to read and there is nothing left.

Everything you write between `data` and `run` describes what happens to **one row**. The looping, the reading and the writing happen automatically.

::widget{name="pdv-stepper" example="basic"}

## Clinical context

Almost every subject-level and record-level derivation in ADaM is row-wise DATA step logic: `AGEGR1`, `BMIBL`, `TRTDURD = TRTEDT - TRTSDT + 1`, study days, flags such as `ANL01FL`, windowed visits. The PDV model explains the most common derivation defects before they reach QC:

| Symptom seen in QC | PDV explanation |
|---|---|
| A derived value is missing for some rows | an operand was missing on that row, and arithmetic on missing gives missing |
| A derived variable is missing on **every** row | it depends on a variable that does not exist (a typo) — SAS created an empty one |
| A counter or running total never grows | new variables are reset to missing at the top of every iteration |
| A dataset has 0 observations | an explicit `OUTPUT` elsewhere in the step switched off the automatic one |
| A value "leaks" from one row into the next | the variable was retained (explicitly, or because it came from `SET`) |

Reviewers and interviewers use the PDV vocabulary — "compile phase", "execution phase", "implicit output", "reset to missing" — so you should too.

## Formal concept

### Compile phase

When you submit a DATA step, SAS first **compiles** it:

- checks syntax (errors here stop the step before any data is read);
- creates the **PDV**, one slot per variable, in the order variables are *first mentioned*: variables from the descriptor of every dataset named in `SET`/`MERGE`, then variables created by `LENGTH`, assignment statements, `INPUT`, `RETAIN` and so on;
- fixes each variable's **type** (character or numeric) and **length** from that first mention;
- adds two **automatic variables**, `_N_` and `_ERROR_`, which exist in the PDV but are never written to the output;
- creates the **descriptor** (metadata) of the output dataset(s).

Some statements act only at compile time and apply to the whole step wherever they appear: `KEEP`, `DROP`, `RENAME`, `LABEL`, `FORMAT`, `INFORMAT`, `ATTRIB`. Others are partly compile-time and their position matters: `LENGTH` only controls a variable's length if it comes **before** the variable's first mention.

### Execution phase

For every iteration:

1. `_N_` increases by 1 (it counts iterations, starting at 1). `_ERROR_` is set back to 0.
2. Variables **created in the step** (by assignment or `INPUT`) are reset to missing — unless they are retained (`RETAIN`, a sum statement, or `_TEMPORARY_` array elements).
3. Executable statements run in order. `SET` copies the next observation into the PDV slots of the input variables. If there is no next observation, **the step stops right there**.
4. At the end of the step (`run;`), the **implicit OUTPUT** writes the current PDV (minus automatic, dropped and temporary variables) as a new observation — *unless the step contains an explicit `OUTPUT` statement anywhere*, in which case rows are written only where you execute `OUTPUT`.
5. Control returns to the top.

Variables read by `SET` are **not** reset to missing between iterations. They do not need to be: the next `SET` overwrites them. The difference becomes important with `MERGE` and BY groups, where a dataset may not supply a new observation on every iteration.

:::why[Why does a DATA step with 4 input rows run 5 iterations?]
The loop has no way of knowing the data has ended until `SET` tries to read a fifth observation. So iteration 5 starts (`_N_` becomes 5), new variables are reset, `SET` finds end-of-file, and the step stops immediately — before any statement after `SET` executes and before any output. Statements placed **before** `SET` do run on that last iteration, which is occasionally useful and occasionally a surprise.
:::

### `_N_` and `_ERROR_`

- `_N_` is the iteration counter, **not** a row number in the input dataset. With a `WHERE` statement, only the qualifying rows are read, so `_N_ = 3` means "the third row that passed the WHERE", not row 3 of the source. `if _N_ = 1 then …` is the standard way to run something once, on the first iteration.
- `_ERROR_` is set to 1 when a **data error** occurs on the current iteration — for example invalid data read by `INPUT`/`INPUT()` or a mathematical error such as division by zero. When that happens, SAS also writes the whole PDV to the log so you can see the offending row. Missing values produced by ordinary arithmetic on missing operands are **not** errors and do not set `_ERROR_`.

### Looking into the PDV yourself

`putlog _all_;` writes every PDV variable, including `_N_` and `_ERROR_`, to the log in `NAME=value` form. `putlog USUBJID= BMIBL=;` writes selected ones. Placed inside an `if` (for example `if USUBJID = 'CBX417-301-1012-0002' then putlog _all_;`), it is the fastest way to debug a single suspicious subject.

## Worked example

Four subjects, with baseline height (cm) and weight (kg). Subject 1012-0002 has no recorded baseline weight.

| USUBJID | AGE | HEIGHTBL | WEIGHTBL |
|---|---:|---:|---:|
| CBX417-301-1012-0001 | 64 | 172 | 81.5 |
| CBX417-301-1012-0002 | 71 | 160 | . |
| CBX417-301-2031-0001 | 58 | 181 | 95.2 |
| CBX417-301-3044-0001 | 66 | 158 | 54.6 |

```sas
data adsl;
  set adsl_in;
  length AGEGR1 $4;
  BMIBL = WEIGHTBL / (HEIGHTBL / 100)**2;
  if AGE >= 65 then AGEGR1 = '>=65';
  else AGEGR1 = '<65';
  format BMIBL 5.1;
run;
```

**Compile phase.** The PDV is laid out in order of first mention: `USUBJID AGE HEIGHTBL WEIGHTBL` (from the descriptor of `ADSL_IN`), then `AGEGR1` (character, length 4, from `LENGTH`), then `BMIBL` (numeric, from the assignment), plus `_N_` and `_ERROR_`.

**Execution phase.** The PDV *after* the statements of each iteration have run:

| `_N_` | USUBJID | AGE | HEIGHTBL | WEIGHTBL | AGEGR1 | BMIBL (stored) | `_ERROR_` | Written? |
|---:|---|---:|---:|---:|---|---:|:-:|:-:|
| 1 | …1012-0001 | 64 | 172 | 81.5 | `<65` | 27.5487 | 0 | yes |
| 2 | …1012-0002 | 71 | 160 | . | `>=65` | . | 0 | yes |
| 3 | …2031-0001 | 58 | 181 | 95.2 | `<65` | 29.0589 | 0 | yes |
| 4 | …3044-0001 | 66 | 158 | 54.6 | `>=65` | 21.8715 | 0 | yes |
| 5 | *(SET finds no more rows — the step stops)* | | | | | | | no |

:::number[Where does BMIBL = 27.5487 come from?]
Height 172 cm is 1.72 m, and 1.72² = 2.9584. Then 81.5 / 2.9584 = 27.5487 (to 4 decimals). With the `5.1` format it *prints* as 27.5, but the stored value keeps full precision. The other two: 95.2 / 1.81² = 95.2 / 3.2761 = 29.0589 → prints 29.1; 54.6 / 1.58² = 54.6 / 2.4964 = 21.8715 → prints 21.9.
:::

:::number[Why is BMIBL missing for subject 1012-0002 — and why is `_ERROR_` still 0?]
`WEIGHTBL` is missing, and any arithmetic operator with a missing operand returns missing: `. / 2.56 = .`. SAS notes it in the log ("Missing values were generated…") but it is not a data error, so `_ERROR_` stays 0. Whether a missing BMI is acceptable is a specification question, not a SAS one.
:::

Now look at the PDV at the **top of iteration 2**, after the automatic reset but *before* `SET` executes:

| USUBJID | AGE | HEIGHTBL | WEIGHTBL | AGEGR1 | BMIBL | `_N_` |
|---|---:|---:|---:|---|---:|---:|
| …1012-0001 | 64 | 172 | 81.5 | *(blank)* | . | 2 |

The input variables still hold subject 1012-0001's values (they are only overwritten when `SET` reads the next row), while the created variables `AGEGR1` and `BMIBL` have been reset to missing. That asymmetry — **input variables keep their values, created variables are reset** — is the single most useful fact about the PDV.

:::why[Why does SAS reset created variables at all?]
Because each output row should depend only on its own input row unless you explicitly say otherwise. If `AGEGR1` were not reset and your IF/ELSE forgot a case, the previous subject's age group would silently appear on the next subject. Resetting to missing makes an unhandled case show up as a blank — visible — instead of a plausible-looking wrong value. When you *do* want to carry a value forward (running totals, last value carried forward), you ask for it with `RETAIN`.
:::

## Data example

In the CBX417-301 ADSL, `HEIGHTBL`, `WEIGHTBL`, `BMIBL` and `AGEGR1` are exactly this kind of row-wise derivation from the raw vitals and demographics:

::dataset{id="oncology/adam/adsl" cols="USUBJID,AGE,AGEGR1,HEIGHTBL,WEIGHTBL,BMIBL,TRT01P" rows="10" caption="ADSL — one row per subject; each derived column is computed within its own row"}

When you open the full dataset, look for subjects with a missing `WEIGHTBL` or `HEIGHTBL`: their `BMIBL` should be missing too. If it is not, the derivation used something other than the baseline values — worth a question to the specification author.

## Code

The complete program, including the input data and a debugging line:

```sas title="pdv_basics.sas"
data adsl_in;
  input USUBJID :$20. AGE HEIGHTBL WEIGHTBL;
  datalines;
CBX417-301-1012-0001 64 172 81.5
CBX417-301-1012-0002 71 160 .
CBX417-301-2031-0001 58 181 95.2
CBX417-301-3044-0001 66 158 54.6
;
run;

data adsl;
  set adsl_in;
  length AGEGR1 $4;
  BMIBL = WEIGHTBL / (HEIGHTBL / 100)**2;
  if AGE >= 65 then AGEGR1 = '>=65';
  else AGEGR1 = '<65';
  format BMIBL 5.1;
  if USUBJID = 'CBX417-301-1012-0002' then putlog _all_;
run;
```

:::lines
1-9: Creates `WORK.ADSL_IN` from in-stream data. The `.` on the second data line is read as a missing numeric value.
11: Starts the step that creates `WORK.ADSL`. At compile time SAS builds the PDV from the statements below.
12: At compile time: adds `USUBJID AGE HEIGHTBL WEIGHTBL` to the PDV from the dataset's descriptor. At execution time: copies the next observation into those slots, or stops the step when none is left.
13: Compile-time only: declares `AGEGR1` as character with length 4 before its first use, so `'>=65'` fits.
14: An assignment statement, executed on every iteration. `**` is exponentiation. If either operand is missing, the result is missing.
15-16: IF-THEN/ELSE: exactly one branch runs. Note the ELSE also catches a missing `AGE` (the missing-values lesson shows why that matters).
17: Compile-time: a display format — one decimal place when printed. The stored value is unchanged.
18: Debugging: for one subject only, writes the whole PDV to the log.
19: End of the step: implicit OUTPUT writes the PDV, then control returns to the top of the step.
:::

## Output

Expected log (line:column positions and timings will differ in your session):

```log
USUBJID=CBX417-301-1012-0002 AGE=71 HEIGHTBL=160 WEIGHTBL=. AGEGR1=>=65 BMIBL=. _ERROR_=0 _N_=2
NOTE: Missing values were generated as a result of performing an operation on missing values.
      Each place is given by: (Number of times) at (Line):(Column).
      1 at 14:20
NOTE: There were 4 observations read from the data set WORK.ADSL_IN.
NOTE: The data set WORK.ADSL has 4 observations and 6 variables.
```

:::number[Why "4 observations and 6 variables"?]
4 observations: one written per iteration that got past `SET` (iterations 1–4). 6 variables: the 4 input variables plus `AGEGR1` and `BMIBL`. `_N_` and `_ERROR_` are in the PDV (the PUTLOG line shows them) but are never written.
:::

:::number[What does "1 at 14:20" mean?]
One missing value was generated, at line 14, column 20 of the submitted code — the division operator in the BMI formula. The count (1) matches the one subject with a missing weight. If the count were 4, *every* BMI would be missing, pointing to a problem with the formula or its inputs rather than with one subject's data.
:::

Expected `proc print data=adsl noobs; run;` output:

```output
USUBJID                 AGE    HEIGHTBL    WEIGHTBL    AGEGR1    BMIBL

CBX417-301-1012-0001     64       172        81.5       <65       27.5
CBX417-301-1012-0002     71       160          .        >=65        .
CBX417-301-2031-0001     58       181        95.2       <65       29.1
CBX417-301-3044-0001     66       158        54.6       >=65      21.9
```

## Interpretation

- **Row independence is the default.** Each output row was computed only from its own input row. Anything that needs information from *other* rows — a count per subject, a previous visit's value, a baseline — requires deliberately breaking that independence (RETAIN, LAG, BY groups, MERGE), which is what the next lessons cover.
- **A missing result is information.** `BMIBL = .` for 1012-0002 faithfully reflects missing input. Imputing a weight, or taking it from another visit, is an analysis decision that belongs in the specification.
- **The log counts are a derivation check.** "4 read, 4 written" is exactly what a record-preserving derivation must show. A derivation step that changes the number of rows when it should not is broken, no matter how correct the values look.

## Common mistakes

:::mistake[A typo creates a new, empty variable]
`BMIBL = WIEGHTBL / (HEIGHTBL/100)**2;` compiles without error: SAS adds `WIEGHTBL` to the PDV as a new numeric variable that is never given a value. Every BMI is missing, the log says `NOTE: Variable WIEGHTBL is uninitialized.`, and the output dataset has one extra (empty) column. Treat "uninitialized" as an error.
:::

:::mistake[One explicit OUTPUT switches off all implicit output]
```sas
data adsl elderly;
  set adsl_in;
  if AGE >= 65 then output elderly;
run;
```
`WORK.ELDERLY` gets the 2 older subjects, and `WORK.ADSL` gets **0** observations: the explicit `OUTPUT` means SAS no longer writes a row automatically at `run;`. Add `output adsl;` for every row you want in ADSL.
:::

:::mistake[Expecting a created variable to remember its value]
`if _N_ = 1 then STUDYDAY0 = TRTSDT;` sets the variable on the first row only; on every later row it is reset to missing at the top of the iteration. Use `RETAIN` when a value must carry across rows.
:::

:::mistake[Setting a length after the first use]
If `AGEGR1 = '<65';` appears before `length AGEGR1 $4;`, the length is already fixed at 3 (the length of `'<65'`), SAS writes a warning that the length has already been set, and `'>=65'` is stored as `'>=6'`. Put LENGTH statements near the top of the step.
:::

:::mistake[Reading `_N_` as a row number]
With `where SAFFL = 'Y';`, `_N_ = 1` is the first *safety* subject, not the first row of ADSL. Use `_N_` for "first iteration" logic, not to identify records.
:::

## Knowledge check

::quiz{ids="sas.data-step-and-pdv.iterations-numeric,sas.data-step-and-pdv.compile-exec-classify,sas.data-step-and-pdv.reset-mcq,sas.data-step-and-pdv.pdv-order-mcq"}

## Hands-on exercise

::practice{ids="sas.data-step-and-pdv.derive-code,sas.data-step-and-pdv.explicit-output-mcq,sas.data-step-and-pdv.error-flag-multi" title="Practice: row-wise derivations in the PDV"}

## Challenge exercise

::practice{ids="sas.data-step-and-pdv.uninit-log,sas.data-step-and-pdv.output-hotspot" title="Debug: read the PDV back from the log"}

## Industry note

- **"Explain the PDV" is a standard screening question** for statistical programmer roles. A strong answer covers both phases, the automatic variables, what is reset versus retained, and when output happens — and then uses the model to explain a real behaviour (why RETAIN is needed, why LAG misbehaves in an IF, why a merge "remembers" values).
- **Debug by printing the PDV, not by staring at code.** `putlog` for one subject, `OBS=` to run on the first few rows, and comparing "observations read" with "observations written" solve most DATA step problems quickly.
- **R and Python think in columns, SAS thinks in rows.** `mutate(BMIBL = WEIGHTBL / (HEIGHTBL/100)^2)` in R and `df["BMIBL"] = df.WEIGHTBL / (df.HEIGHTBL/100)**2` in pandas compute the whole column at once; the DATA step computes one row at a time. The results agree for row-wise derivations (missing values propagate as `NA`/`NaN` in both), but anything that depends on neighbouring rows is written very differently in each language.

:::interview[Walk me through what happens when SAS runs a DATA step.]
"There are two phases. At compile time SAS checks syntax, builds the program data vector — one slot per variable in order of first mention, with each variable's type and length fixed there — adds the automatic variables `_N_` and `_ERROR_`, and creates the descriptor of the output dataset. Then at execution time it loops: `_N_` goes up by one, variables created in the step are reset to missing unless retained, the SET statement reads the next observation into the PDV, my statements run top to bottom, and at the end of the step the implicit OUTPUT writes the PDV unless I've used an explicit OUTPUT. The loop stops when SET tries to read past the last observation. That model explains, for example, why a counter needs RETAIN and why a typo in a variable name gives an 'uninitialized' note instead of an error."
:::

:::ai[If an AI assistant writes a DATA step for you…]
Run it on a handful of rows and read the log before trusting it. Generated code commonly places `LENGTH` after the first assignment, mixes an explicit `OUTPUT` into a step that relied on implicit output, and misspells variable names in ways that only show up as "uninitialized" notes. Check the observation counts, not just the absence of ERRORs.
:::
