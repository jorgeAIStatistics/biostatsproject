/*============================================================================
  Program : sas-retain-sum-lag.sas
  Lesson  : RETAIN, the sum statement, LAG and DIF
  Purpose : Cumulative dose with a sum statement, previous-visit values with
            LAG (safe and unsafe patterns), and LOCF with a group reset.
  NOTE    : This program was NOT executed in this environment (SAS is not
            available here). Written for SAS 9.4 / SAS OnDemand for Academics.
            Expected values were computed independently (see the lesson).
  Data    : In-stream (DATALINES) only.
============================================================================*/

data ex;
  input USUBJID :$20. CYCLE EXDOSE;
  datalines;
CBX417-301-1012-0001 1 142.5
CBX417-301-1012-0001 2 142.5
CBX417-301-1012-0001 3 114.0
CBX417-301-1012-0002 1 129.0
CBX417-301-1012-0002 2 129.0
CBX417-301-1012-0002 3 .
;
run;

/* 1. Cumulative dose. Expected CUMDOSE: 142.5 285.0 399.0 | 129.0 258.0 258.0 */
proc sort data=ex;
  by USUBJID CYCLE;
run;

data ex_cum;
  set ex;
  by USUBJID;
  if first.USUBJID then do;
    CUMDOSE = 0;
    INFNUM  = 0;
  end;
  CUMDOSE + EXDOSE;
  INFNUM  + 1;
run;

proc print data=ex_cum noobs;
run;

data vs;
  input USUBJID :$20. CYCLE WEIGHT;
  datalines;
CBX417-301-1012-0001 1 70.2
CBX417-301-1012-0001 2 69.5
CBX417-301-1012-0001 3 69.0
CBX417-301-1012-0002 1 82.0
CBX417-301-1012-0002 2 81.2
CBX417-301-1012-0002 3 80.9
;
run;

/* 2. Previous visit: safe pattern (unconditional LAG + reset).
      Expected PREVWT: . 70.2 69.5 | . 82.0 81.2
      Expected CHGPREV: . -0.7 -0.5 | . -0.8 -0.3
      Expected log: 2 missing values generated (one per subject).          */
proc sort data=vs;
  by USUBJID CYCLE;
run;

data vs_prev;
  set vs;
  by USUBJID;
  PREVWT = lag(WEIGHT);
  if first.USUBJID then PREVWT = .;
  CHGPREV = WEIGHT - PREVWT;
run;

proc print data=vs_prev noobs;
run;

/* 3. Unsafe pattern for comparison: conditional LAG.
      Expected PREVWT_BAD: . . 69.5 | . 69.0 81.2  (rows 2 and 5 are wrong) */
data vs_prev_bad;
  set vs;
  by USUBJID;
  if not first.USUBJID then PREVWT_BAD = lag(WEIGHT);
run;

proc print data=vs_prev_bad noobs;
run;

/* 4. LOCF with a reset at the start of each subject.
      Expected WT_LOCF: 70.2 70.2 69.0 69.0 | . 81.2
      Without the reset, subject 2 cycle 1 would inherit 69.0.             */
data vs_gaps;
  input USUBJID :$20. CYCLE WEIGHT;
  datalines;
CBX417-301-1012-0001 1 70.2
CBX417-301-1012-0001 2 .
CBX417-301-1012-0001 3 69.0
CBX417-301-1012-0001 4 .
CBX417-301-1012-0002 1 .
CBX417-301-1012-0002 2 81.2
;
run;

data vs_locf;
  set vs_gaps;
  by USUBJID;
  retain WT_LOCF;
  if first.USUBJID then WT_LOCF = .;
  if not missing(WEIGHT) then WT_LOCF = WEIGHT;
  if missing(WEIGHT) and not missing(WT_LOCF) then LOCFFL = 'Y';
run;

proc print data=vs_locf noobs;
run;
