/*============================================================================
  Program : sas-proc-sql.sas
  Lesson  : PROC SQL for clinical programmers
  Purpose : Subject counts by arm with a LEFT JOIN to an in-line view,
            denominators INTO macro variables, remerging, CASE, subqueries,
            duplicate-key checks, and SQL vs MERGE on a many-to-many key.
  NOTE    : This program was NOT executed in this environment (SAS is not
            available here). Written for SAS 9.4 / SAS OnDemand for Academics.
            Expected values were verified with an independent SQL engine.
  Data    : In-stream (DATALINES) only.
============================================================================*/

data adsl;
  infile datalines dlm='|' truncover;
  input USUBJID :$20. TRT01A :$19. SAFFL :$1.;
  datalines;
CBX417-301-1012-0001|CBX-417 + Docetaxel|Y
CBX417-301-1012-0002|Placebo + Docetaxel|Y
CBX417-301-1012-0003|CBX-417 + Docetaxel|Y
CBX417-301-1012-0004|Placebo + Docetaxel|Y
CBX417-301-2031-0001|CBX-417 + Docetaxel|Y
CBX417-301-2031-0002|Placebo + Docetaxel|Y
CBX417-301-2031-0003|CBX-417 + Docetaxel|N
CBX417-301-3044-0001|Placebo + Docetaxel|Y
;
run;

data adae;
  infile datalines dlm='|' truncover;
  input USUBJID :$20. AEDECOD :$25. ATOXGRN TRTEMFL :$1.;
  datalines;
CBX417-301-1012-0001|Neutropenia|3|Y
CBX417-301-1012-0001|Fatigue|1|Y
CBX417-301-1012-0001|Nausea|2|N
CBX417-301-1012-0002|Neutropenia|4|Y
CBX417-301-1012-0002|Diarrhea|1|Y
CBX417-301-1012-0003|Rash|2|Y
CBX417-301-1012-0003|Febrile neutropenia|3|Y
CBX417-301-2031-0001|Fatigue|2|Y
CBX417-301-2031-0002|Pneumonia|5|Y
CBX417-301-3044-0001|Anemia|2|Y
;
run;

/* 1. Subjects with a grade >=3 TEAE by arm.
      Expected: CBX-417 N_SAF 3, N_G3 2, PCT 66.7
                Placebo N_SAF 4, N_G3 2, PCT 50.0                          */
proc sql;
  create table g3 as
  select s.TRT01A,
         count(distinct s.USUBJID) as N_SAF,
         count(distinct a.USUBJID) as N_G3,
         calculated N_G3 / calculated N_SAF * 100 as PCT format=5.1
  from adsl as s
       left join (select distinct USUBJID
                  from adae
                  where TRTEMFL = 'Y' and ATOXGRN >= 3) as a
         on s.USUBJID = a.USUBJID
  where s.SAFFL = 'Y'
  group by s.TRT01A
  order by s.TRT01A;
quit;

proc print data=g3 noobs;
run;

/* 2. Denominators into macro variables. Expected: N_CBX=3, N_PBO=4.       */
proc sql noprint;
  select count(distinct USUBJID) into :n_cbx trimmed
  from adsl where SAFFL = 'Y' and TRT01A = 'CBX-417 + Docetaxel';

  select count(distinct USUBJID) into :n_pbo trimmed
  from adsl where SAFFL = 'Y' and TRT01A = 'Placebo + Docetaxel';
quit;

%put NOTE- Safety N: CBX-417 = &n_cbx, Placebo = &n_pbo;

/* 3. Remerging: 9 rows (one per TEAE record), not 6 (one per subject).
      Expected NOTE: The query requires remerging summary statistics ...    */
proc sql;
  create table worst_remerged as
  select USUBJID, AEDECOD, max(ATOXGRN) as MAXGR
  from adae
  where TRTEMFL = 'Y'
  group by USUBJID;

  create table worst_by_subj as     /* 6 rows: one per subject */
  select USUBJID, max(ATOXGRN) as MAXGR
  from adae
  where TRTEMFL = 'Y'
  group by USUBJID;
quit;

/* 4. CASE, subquery and a duplicate-key check.                            */
proc sql;
  create table grgroup as
  select USUBJID, AEDECOD,
         case when ATOXGRN >= 3   then 'Grade 3-5'
              when ATOXGRN in (1, 2) then 'Grade 1-2'
              else 'Missing grade'
         end as GRGROUP
  from adae
  where TRTEMFL = 'Y';

  create table sev_subj as
  select USUBJID, TRT01A
  from adsl
  where SAFFL = 'Y'
    and USUBJID in (select USUBJID from adae
                    where TRTEMFL = 'Y' and ATOXGRN >= 3);

  title 'Duplicate USUBJID in ADSL (expected: none)';
  select USUBJID, count(*) as N
  from adsl
  group by USUBJID
  having count(*) > 1;
  title;
quit;

/* 5. Many-to-many: MERGE gives 3 rows, an SQL join gives 6.               */
data adcm;
  infile datalines dlm='|' truncover;
  input USUBJID :$20. CMDECOD :$20.;
  datalines;
CBX417-301-1012-0001|Ondansetron
CBX417-301-1012-0001|Dexamethasone
CBX417-301-1012-0001|Loperamide
;
run;

data ae_cm_merge;                 /* 3 rows + repeats-of-BY-values note */
  merge adae(where=(USUBJID = 'CBX417-301-1012-0001' and TRTEMFL = 'Y')) adcm;
  by USUBJID;
run;

proc sql;                         /* 6 rows */
  create table ae_cm_sql as
  select a.USUBJID, a.AEDECOD, c.CMDECOD
  from adae as a inner join adcm as c
    on a.USUBJID = c.USUBJID
  where a.TRTEMFL = 'Y';
quit;
