/*============================================================================
  Program : sas-arrays-do-loops.sas
  Lesson  : Arrays and DO loops
  Purpose : Race checkboxes -> one coded value, unit conversion with a
            _TEMPORARY_ array, generating a planned visit schedule, and the
            two classic array errors.
  NOTE    : This program was NOT executed in this environment (SAS is not
            available here). Written for SAS 9.4 / SAS OnDemand for Academics.
            Expected values were computed independently (see the lesson).
  Data    : In-stream (DATALINES); optional CSV section at the end.
============================================================================*/
%let root = ../../data/oncology;   /* relative to SAS's working directory */

data raw_dm;
  infile datalines dlm='|' dsd truncover;
  input SUBJECT_ID :$9. RACE_WHITE :$1. RACE_ASIAN :$1. RACE_BLACK :$1.
        RACE_AMIND :$1. RACE_NHPI :$1. RACE_OTHER :$1.;
  datalines;
1012-0001|Y|||||
1012-0002||Y||||
1012-0003|Y||Y|||
2031-0001||||||Y
3044-0001||||||
;
run;

/* 1. Checkboxes -> RACE.
      Expected: WHITE, ASIAN, MULTIPLE, OTHER, NOT REPORTED (NCHK 1,1,2,1,0) */
data dm;
  set raw_dm;
  length RACE $41;
  array chk{*} RACE_WHITE RACE_ASIAN RACE_BLACK RACE_AMIND RACE_NHPI RACE_OTHER;
  array term{6} $41 _temporary_
        ('WHITE' 'ASIAN' 'BLACK OR AFRICAN AMERICAN' 'AMERICAN INDIAN OR ALASKA NATIVE'
         'NATIVE HAWAIIAN OR OTHER PACIFIC ISLANDER' 'OTHER');
  NCHK  = 0;
  LASTI = .;
  do i = 1 to dim(chk);
    if chk{i} = 'Y' then do;
      NCHK + 1;
      LASTI = i;
    end;
  end;
  if NCHK = 0 then RACE = 'NOT REPORTED';
  else if NCHK = 1 then RACE = term{LASTI};
  else RACE = 'MULTIPLE';
  drop i;
run;

proc print data=dm noobs;
  var SUBJECT_ID NCHK RACE;
run;

proc freq data=dm;
  tables RACE_WHITE*RACE RACE_ASIAN*RACE / list missing;
run;

/* 2. Conventional -> SI units with a _TEMPORARY_ factor array.
      Expected: BILI 13.68, CREAT 97.24, HGB 124, ALB 42.                   */
data lb_si;
  input BILI CREAT HGB ALB;
  array conv{4} BILI CREAT HGB ALB;
  array f{4} _temporary_ (17.1 88.4 10 10);
  do i = 1 to dim(conv);
    if not missing(conv{i}) then conv{i} = round(conv{i} * f{i}, 0.01);
  end;
  drop i;
  datalines;
0.8 1.1 12.4 4.2
;
run;

proc print data=lb_si noobs;
run;

/* 3. Generated rows: planned cycle visits, 21-day cycles.
      Expected for RANDDT = 11APR2022: 11APR2022, 02MAY2022, 23MAY2022,
      13JUN2022, 04JUL2022, 25JUL2022 (SAS dates 22746 ... 22851).          */
data adsl_min;
  input USUBJID :$20. RANDDT :yymmdd10.;
  format RANDDT date9.;
  datalines;
CBX417-301-1012-0001 2022-04-11
;
run;

data planned;
  set adsl_min;
  format VISITDT date9.;
  do CYCLE = 1 to 6;
    VISITNUM = CYCLE * 10;
    VISITDT  = RANDDT + 21 * (CYCLE - 1);
    output;
  end;
run;

proc print data=planned noobs;
run;

/* 4. Two deliberate errors.
      (a) new character variables without $ -> numeric flags, conversion and
          invalid-data notes; (b) loop limit larger than the array.         */
data lb_wide;
  input ALT AST BILI;
  datalines;
55 38 12
;
run;

data flags_bad;
  set lb_wide;
  array val{3} ALT AST BILI;
  array flg{3} ALTFL ASTFL BILIFL;        /* missing $1 */
  array uln{3} _temporary_ (40 40 21);
  do i = 1 to dim(val);
    if not missing(val{i}) and val{i} > uln{i} then flg{i} = 'Y';
  end;
  drop i;
run;

data flags_good;
  set lb_wide;
  array val{3} ALT AST BILI;
  array flg{3} $1 ALTFL ASTFL BILIFL;
  array uln{3} _temporary_ (40 40 21);
  do i = 1 to dim(val);
    if not missing(val{i}) and val{i} > uln{i} then flg{i} = 'Y';
  end;
  drop i;
run;

/* 5. OPTIONAL: the real raw demographics file (7 checkbox columns).       */
proc import datafile="&root/raw/demographics.csv" out=raw_dm_csv dbms=csv replace;
  guessingrows=max;
run;

data dm_csv;
  set raw_dm_csv;
  length RACE $41;
  array chk{*} RACE_WHITE RACE_ASIAN RACE_BLACK RACE_AMIND RACE_NHPI
               RACE_OTHER RACE_NOT_REPORTED;
  array term{7} $41 _temporary_
        ('WHITE' 'ASIAN' 'BLACK OR AFRICAN AMERICAN' 'AMERICAN INDIAN OR ALASKA NATIVE'
         'NATIVE HAWAIIAN OR OTHER PACIFIC ISLANDER' 'OTHER' 'NOT REPORTED');
  /* The real mapping specification decides what a checked NOT REPORTED box
     means when another race is also checked - this example treats it as one
     of the checkboxes, so two checked boxes give MULTIPLE.                 */
  NCHK  = 0;
  LASTI = .;
  do i = 1 to dim(chk);
    if chk{i} = 'Y' then do;
      NCHK + 1;
      LASTI = i;
    end;
  end;
  if NCHK = 0 then RACE = 'NOT REPORTED';
  else if NCHK = 1 then RACE = term{LASTI};
  else RACE = 'MULTIPLE';
  drop i;
run;

proc freq data=dm_csv;
  tables RACE NCHK / missing;
run;
