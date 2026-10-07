/*============================================================================
  Program : sas-subsetting-where-if.sas
  Lesson  : Subsetting with WHERE, IF and data set options
  Purpose : Safety-population subsets with WHERE, WHERE=, subsetting IF,
            KEEP= on output, several OUTPUT datasets, and two classic errors.
  NOTE    : This program was NOT executed in this environment (SAS is not
            available here). Written for SAS 9.4 / SAS OnDemand for Academics.
            Expected results are described in the lesson.
  Data    : In-stream (DATALINES) only.
============================================================================*/

data adsl;
  infile datalines dlm='|' truncover;
  input USUBJID :$20. TRT01P :$19. AGE SEX :$1. SAFFL :$1.;
  datalines;
CBX417-301-1012-0001|CBX-417 + Docetaxel|64|M|Y
CBX417-301-1012-0002|Placebo + Docetaxel|71|F|Y
CBX417-301-1012-0004|CBX-417 + Docetaxel|58|F|N
CBX417-301-2031-0001|Placebo + Docetaxel|66|M|Y
CBX417-301-2031-0002|CBX-417 + Docetaxel|49|F|Y
CBX417-301-2031-0003|Placebo + Docetaxel|69|M|N
CBX417-301-3044-0001|CBX-417 + Docetaxel|77|F|Y
CBX417-301-3044-0002|Placebo + Docetaxel|55|M|Y
;
run;

/* 1. WHERE vs subsetting IF on a stored flag: same 6 rows, different log.
      Expected: WHERE version reads 6; IF version reads 8; both write 6.   */
data saf_where;
  set adsl;
  where SAFFL = 'Y';
run;

data saf_if;
  set adsl;
  if SAFFL = 'Y';
run;

/* 2. Two outputs, WHERE= on input, KEEP= on output.
      Expected: SAF 6 obs / 5 vars; ELD_SAF 3 obs / 3 vars.                */
data saf(keep=USUBJID TRT01P AGE SEX AGEGR1)
     eld_saf(keep=USUBJID TRT01P AGE);
  set adsl(where=(SAFFL = 'Y'));
  length AGEGR1 $4;
  if AGE >= 65 then AGEGR1 = '>=65';
  else if not missing(AGE) then AGEGR1 = '<65';
  output saf;
  if AGEGR1 = '>=65' then output eld_saf;
run;

proc print data=eld_saf noobs;
run;

/* 3. Input options are applied KEEP= -> RENAME= -> WHERE= (new names).
      Expected: 3 obs (ages 71, 66, 77).                                   */
data eld_renamed;
  set adsl(keep=USUBJID AGE SAFFL rename=(AGE=AGEBL)
           where=(AGEBL >= 65 and SAFFL = 'Y'));
run;

/* 4. Two WHERE statements: the second replaces the first.
      Expected: NOTE: WHERE clause has been replaced. (8 obs read: all ages) */
data replaced;
  set adsl;
  where SAFFL = 'Y';
  where AGE >= 0;
run;

/* 5. Deliberate error: WHERE on a variable created in the step.
      Expected: ERROR: Variable AGEGR1 is not on file WORK.ADSL.           */
data eld_error;
  set adsl;
  length AGEGR1 $4;
  if AGE >= 65 then AGEGR1 = '>=65';
  else if not missing(AGE) then AGEGR1 = '<65';
  where AGEGR1 = '>=65';
run;
