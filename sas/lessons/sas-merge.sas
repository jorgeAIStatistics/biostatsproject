/*============================================================================
  Program : sas-merge.sas
  Lesson  : Combining datasets with MERGE
  Purpose : One-to-many merge with IN= flags and review outputs, a
            many-to-many merge, and the same-named-variable overwrite trap.
  NOTE    : This program was NOT executed in this environment (SAS is not
            available here). Written for SAS 9.4 / SAS OnDemand for Academics.
            Expected results were checked with an independent simulation of
            MERGE semantics (see the lesson).
  Data    : In-stream (DATALINES) only.
============================================================================*/

data lb;
  input USUBJID :$20. LBTESTCD :$8. VISITNUM LBSTRESN;
  datalines;
CBX417-301-1012-0001 ALT 1 22
CBX417-301-1012-0001 ALT 10 35
CBX417-301-1012-0001 ALT 20 41
CBX417-301-1012-0002 ALT 1 18
CBX417-301-1012-0002 ALT 10 19
CBX417-301-2031-0005 ALT 1 27
CBX417-301-3044-0001 ALT 1 30
CBX417-301-3044-0001 ALT 10 88
;
run;

data adsl;
  infile datalines dlm='|' dsd truncover;
  input USUBJID :$20. TRT01A :$19. TRTSDT :yymmdd10. SAFFL :$1.;
  format TRTSDT date9.;
  datalines;
CBX417-301-1012-0001|CBX-417 + Docetaxel|2022-04-14|Y
CBX417-301-1012-0002|Placebo + Docetaxel|2022-05-03|Y
CBX417-301-2031-0001|||N
CBX417-301-3044-0001|CBX-417 + Docetaxel|2022-07-06|Y
;
run;

/* 1. One-to-many merge with IN= flags.
      Expected: LB_ADSL 7 obs, LB_ONLY 1 obs (2031-0005), ADSL_ONLY 1 obs
      (2031-0001), each with 7 variables; no repeats-of-BY-values note.     */
proc sort data=lb;
  by USUBJID VISITNUM;
run;

proc sort data=adsl(keep=USUBJID TRT01A TRTSDT SAFFL) out=adsl_k;
  by USUBJID;
run;

data lb_adsl lb_only adsl_only;
  merge lb(in=inlb) adsl_k(in=insl);
  by USUBJID;
  if inlb and insl then output lb_adsl;
  else if inlb then output lb_only;
  else output adsl_only;
run;

proc print data=lb_adsl noobs;
run;

/* 2. Many-to-many: 2 AE x 3 CM for one subject -> 3 rows, not 6.
      Expected NOTE: MERGE statement has more than one data set with repeats
      of BY values. Rows: Nausea/Ondansetron, Fatigue/Dexamethasone,
      Fatigue/Loperamide.                                                   */
data ae;
  input USUBJID :$20. AEDECOD :$20.;
  datalines;
CBX417-301-1012-0001 Nausea
CBX417-301-1012-0001 Fatigue
;
run;

data cm;
  input USUBJID :$20. CMDECOD :$20.;
  datalines;
CBX417-301-1012-0001 Ondansetron
CBX417-301-1012-0001 Dexamethasone
CBX417-301-1012-0001 Loperamide
;
run;

data ae_cm;
  merge ae cm;
  by USUBJID;
run;

proc print data=ae_cm noobs;
run;

/* 3. Same-named variable: stale TRT01A in the "many" dataset.
      Expected TRT01A by record: CBX-417 (record 1), Placebo (records 2-3). */
options msglevel=i;   /* INFO lines report overwritten variables */

data adlb_old;
  input USUBJID :$20. VISITNUM TRT01A & $19.;
  datalines;
CBX417-301-1012-0001 1 Placebo + Docetaxel
CBX417-301-1012-0001 10 Placebo + Docetaxel
CBX417-301-1012-0001 20 Placebo + Docetaxel
;
run;

data adlb_bad;
  merge adlb_old adsl_k(keep=USUBJID TRT01A);
  by USUBJID;
  if not missing(VISITNUM);
run;

data adlb_good;
  merge adlb_old(drop=TRT01A) adsl_k(keep=USUBJID TRT01A);
  by USUBJID;
  if not missing(VISITNUM);
run;

options msglevel=n;
