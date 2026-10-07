/*============================================================================
  Program : sas-variable-attributes.sas
  Lesson  : Variable attributes - LENGTH, LABEL, FORMAT and INFORMAT
  Purpose : Truncation by first assignment, LENGTH placement, ATTRIB from a
            specification, dates as numbers with formats, explicit INPUT/PUT.
  NOTE    : This program was NOT executed in this environment (SAS is not
            available here). Written for SAS 9.4 / SAS OnDemand for Academics.
            Expected results are described in the lesson.
  Data    : In-stream (DATALINES) only.
============================================================================*/

data adsl_in;
  infile datalines dlm='|' dsd truncover;
  input USUBJID :$20. RAND_DATE :$10. TRTSDT :yymmdd10. DCTREAS :$40.;
  datalines;
CBX417-301-1012-0001|2022-04-11|2022-04-14|PROGRESSIVE DISEASE
CBX417-301-1012-0002|2022-05-02|2022-05-03|
CBX417-301-2031-0001|2022-06-20|2022-06-22|ADVERSE EVENT
CBX417-301-3044-0001|2022-07-05|2022-07-06|PROGRESSIVE DISEASE
;
run;

/* 1. Truncation: EOTSTT gets length 7 from 'ONGOING'.
      Expected PROC FREQ: DISCONT 3 (75.00%), ONGOING 1 (25.00%).          */
data adsl_trunc;
  set adsl_in;
  if missing(DCTREAS) then EOTSTT = 'ONGOING';
  else EOTSTT = 'DISCONTINUED';
run;

proc freq data=adsl_trunc;
  tables EOTSTT;
run;

/* 2. A LENGTH statement after the first mention is ignored.
      Expected: WARNING: Length of character variable EOTSTT has already been set. */
data adsl_late;
  set adsl_in;
  if missing(DCTREAS) then EOTSTT = 'ONGOING';
  else EOTSTT = 'DISCONTINUED';
  length EOTSTT $12;
run;

/* 3. Correct version: attributes from the specification, before SET.
      Expected PROC CONTENTS: USUBJID Char 20, RANDDT Num 8 DATE9.,
      TRTSDT Num 8 DATE9., EOTSTT Char 12.                                  */
data adsl;
  attrib USUBJID length=$20 label='Unique Subject Identifier'
         RANDDT  length=8   format=date9. label='Date of Randomization'
         TRTSDT  length=8   format=date9. label='Date of First Exposure to Treatment'
         EOTSTT  length=$12 label='End of Treatment Status';
  set adsl_in;
  RANDDT = input(RAND_DATE, yymmdd10.);
  if missing(DCTREAS) then EOTSTT = 'ONGOING';
  else EOTSTT = 'DISCONTINUED';
  keep USUBJID RANDDT TRTSDT EOTSTT;
run;

proc contents data=adsl varnum;
run;

proc print data=adsl noobs;
run;

/* 4. Dates are numbers: stored values and differences.
      Expected: RANDDT_NUM=22746 TRTSDT_NUM=22749 DAYS=3 for the first subject. */
data _null_;
  set adsl(obs=1);
  RANDDT_NUM = RANDDT;
  TRTSDT_NUM = TRTSDT;
  DAYS       = TRTSDT - RANDDT;
  ISO        = put(TRTSDT, yymmdd10.);
  putlog RANDDT_NUM= TRTSDT_NUM= DAYS= ISO=;
run;

/* 5. Implicit vs explicit conversion of lab results.                      */
data raw_labs;
  infile datalines dlm='|' truncover;
  input RESULT :$10. REF_HIGH;
  datalines;
35|40
112|40
<0.5|21
;
run;

data lb_implicit;              /* LBSTRESN becomes CHARACTER; conversion notes */
  set raw_labs;
  LBSTRESN = RESULT;
  if LBSTRESN > REF_HIGH then HIGHFL = 'Y';
run;

data lb_explicit;              /* numeric LBSTRESN; '<0.5' -> missing by design */
  set raw_labs;
  LBSTRESN = input(RESULT, ?? best32.);
  if not missing(LBSTRESN) and LBSTRESN > REF_HIGH then HIGHFL = 'Y';
run;
