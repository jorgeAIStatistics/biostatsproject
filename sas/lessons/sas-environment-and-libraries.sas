/*============================================================================
  Program : sas-environment-and-libraries.sas
  Lesson  : Your first SAS session - libraries, datasets and the log
  Purpose : Assign a permanent library, create a small DM-like dataset,
            inspect it with PROC CONTENTS / FREQ / PRINT, and (optionally)
            import a CBX417-301 CSV file.
  NOTE    : This program was NOT executed in this environment (SAS is not
            available here). It is written for SAS 9.4 / SAS OnDemand for
            Academics. Expected results are described in the lesson.
  Data    : In-stream (DATALINES) + optional CSV from data/oncology.
============================================================================*/

/* Relative paths resolve against SAS's current working directory, which is
   often NOT the folder this program is in. In SAS OnDemand for Academics,
   replace both paths with absolute paths under /home/<your-user-id>/.      */
%let root   = ../../data/oncology;   /* CBX417-301 CSV files (optional part) */
%let mylib  = ./cbx417_work;         /* a folder YOU own for permanent output */

libname cbxlib "&mylib";

/* 1. A six-subject DM-like dataset; subject 1012-0003 is a screen failure. */
data cbxlib.dm;
  infile datalines dlm='|' dsd truncover;
  input USUBJID :$20. SITEID :$4. ARMCD :$8. AGE SEX :$1. COUNTRY :$3.;
  datalines;
CBX417-301-1012-0001|1012|CBX+DOC|64|M|USA
CBX417-301-1012-0002|1012|PBO+DOC|71|F|USA
CBX417-301-1012-0003|1012||58|M|USA
CBX417-301-2031-0001|2031|PBO+DOC|66|M|DEU
CBX417-301-2031-0002|2031|CBX+DOC|49|F|DEU
CBX417-301-3044-0001|3044|CBX+DOC|77|F|JPN
;
run;
/* Expected log: NOTE: The data set CBXLIB.DM has 6 observations and 6 variables. */

/* 2. Descriptor portion: variables in creation order. */
proc contents data=cbxlib.dm varnum;
run;

/* 3. Randomized = non-blank ARMCD. MISSING shows the blank level (1 + 3 + 2 = 6). */
proc freq data=cbxlib.dm;
  tables ARMCD / missing;
run;

/* 4. First rows, US subjects only. The log echoes the WHERE clause. */
proc print data=cbxlib.dm(obs=10) noobs;
  where COUNTRY = 'USA';
run;

/* 5. One-level names live in WORK and disappear at the end of the session. */
data dm_copy;              /* = WORK.DM_COPY */
  set cbxlib.dm;
run;

/* 6. OPTIONAL: read a CBX417-301 CSV (only if the generated files exist).
      GUESSINGROWS=MAX scans every row before choosing types and lengths.  */
proc import datafile="&root/sdtm/dm.csv" out=work.dm_csv dbms=csv replace;
  guessingrows=max;
run;

proc contents data=work.dm_csv varnum;
run;
