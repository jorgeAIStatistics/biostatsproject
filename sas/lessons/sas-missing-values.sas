/*============================================================================
  Program : sas-missing-values.sas
  Lesson  : Missing values - representation, comparison and propagation
  Purpose : Missing in comparisons, IF-THEN/ELSE, operators vs functions,
            special missing values, and missing values in procedures.
  NOTE    : This program was NOT executed in this environment (SAS is not
            available here). Written for SAS 9.4 / SAS OnDemand for Academics.
            Expected results are described in the lesson.
  Data    : In-stream (DATALINES) only.
============================================================================*/

data dm;
  input SUBJ AGE;
  datalines;
1 64
2 71
3 .
4 58
5 66
6 49
7 .
8 77
9 55
10 69
;
run;

/* 1. The trap: missing is smaller than any number.
      Expected: WORK.UNDERAGE_BAD has 2 obs (subjects 3 and 7).            */
data underage_bad;
  set dm;
  if AGE < 18;
run;

/* 2. Naive vs correct age groups. Expected PROC FREQ:
      naive  : <65 6, >=65 4
      correct: blank 2 (20%), <65 4 (40%), >=65 4 (40%)                   */
data agegrp;
  set dm;
  length AGEGR_NAIVE AGEGR1 $4;
  if AGE >= 65 then AGEGR_NAIVE = '>=65';
  else AGEGR_NAIVE = '<65';
  if missing(AGE) then AGEGR1 = ' ';
  else if AGE >= 65 then AGEGR1 = '>=65';
  else AGEGR1 = '<65';
run;

proc freq data=agegrp;
  tables AGEGR_NAIVE AGEGR1 / missing;
run;

/* 3. Procedures skip missing values.
      Expected: N 8, NMISS 2, mean 63.625, SD 9.164, median 65, min 49, max 77. */
proc means data=dm n nmiss mean std median min max maxdec=3;
  var AGE;
run;

/* 4. Operators vs functions on target lesion diameters.
      Expected for Week 6: PLUS=. SUMF=44 PCHG_SUMF=-35.29 SUMDIAM=.        */
data tr;
  input VISIT :$8. LES1 LES2 LES3;
  retain BASESUM;
  PLUS = LES1 + LES2 + LES3;
  SUMF = sum(of LES1-LES3);
  if VISIT = 'BASELINE' then BASESUM = PLUS;
  PCHG_SUMF = round((SUMF - BASESUM) / BASESUM * 100, 0.01);
  if nmiss(of LES1-LES3) = 0 then SUMDIAM = sum(of LES1-LES3);
  datalines;
BASELINE 32 21 15
WEEK6    30 .  14
;
run;

proc print data=tr noobs;
run;

/* 5. Special missing values: 'N' in the raw data becomes .N
      Expected: EQ_DOT flags only the third record; MISS flags records 2-3;
      PROC MEANS: N 1, NMISS 2.                                             */
missing N;
data vs_raw;
  input USUBJID :$20. VISIT :$12. SYSBP;
  EQ_DOT = (SYSBP = .);
  MISS   = missing(SYSBP);
  datalines;
CBX417-301-1012-0001 SCREENING 128
CBX417-301-1012-0001 C2D1      N
CBX417-301-1012-0001 C3D1      .
;
run;

proc print data=vs_raw noobs;
run;

proc means data=vs_raw n nmiss;
  var SYSBP;
run;
