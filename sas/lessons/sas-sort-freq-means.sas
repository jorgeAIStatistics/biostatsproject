/*============================================================================
  Program : sas-sort-freq-means.sas
  Lesson  : PROC SORT, PROC FREQ and PROC MEANS
  Purpose : Key check with NODUPKEY/DUPOUT=, NODUPRECS adjacency, sex by arm
            with column percentages, age statistics by arm with OUTPUT OUT=.
  NOTE    : This program was NOT executed in this environment (SAS is not
            available here). Written for SAS 9.4 / SAS OnDemand for Academics.
            Expected values were computed independently (see the lesson).
  Data    : In-stream (DATALINES); optional CSV section at the end.
============================================================================*/
%let root = ../../data/oncology;   /* relative to SAS's working directory */

data adsl_in;
  infile datalines dlm='|' truncover;
  input USUBJID :$20. TRT01P :$19. SEX :$1. AGE;
  datalines;
CBX417-301-1012-0001|CBX-417 + Docetaxel|M|64
CBX417-301-1012-0002|Placebo + Docetaxel|F|71
CBX417-301-1012-0003|CBX-417 + Docetaxel|F|58
CBX417-301-1012-0004|Placebo + Docetaxel|F|66
CBX417-301-2031-0001|CBX-417 + Docetaxel|M|49
CBX417-301-2031-0002|Placebo + Docetaxel|M|62
CBX417-301-2031-0002|Placebo + Docetaxel|M|62
CBX417-301-2031-0003|CBX-417 + Docetaxel|M|77
CBX417-301-2031-0004|Placebo + Docetaxel|F|.
CBX417-301-3044-0001|CBX-417 + Docetaxel|F|69
CBX417-301-3044-0002|Placebo + Docetaxel|M|55
CBX417-301-3044-0003|CBX-417 + Docetaxel|M|61
CBX417-301-3044-0004|Placebo + Docetaxel|M|73
;
run;

/* 1. Key check. Expected: 13 read, 1 deleted, ADSL 12 obs, ADSL_DUPS 1 obs. */
proc sort data=adsl_in out=adsl nodupkey dupout=adsl_dups;
  by USUBJID;
run;

/* 2. Sex by arm. Expected Col Pct: CBX F 33.33 M 66.67; PBO F 50.00 M 50.00 */
proc freq data=adsl;
  tables SEX*TRT01P / norow nopercent;
  tables SEX*TRT01P / noprint out=sex_cnt outpct;
run;

proc print data=sex_cnt noobs;
run;

/* 3. Age by arm. Expected:
      CBX: N Obs 6, N 6, mean 63.0, SD 9.571, median 62.5, min 49, max 77
      PBO: N Obs 6, N 5, mean 65.4, SD 7.232, median 66.0, min 55, max 73
      Overall (_TYPE_=0): _FREQ_ 12, N 11, mean 64.091, SD 8.264, median 64 */
proc means data=adsl n nmiss mean std median min max maxdec=1;
  class TRT01P;
  var AGE;
  output out=agestats n=AGE_N mean=AGE_MEAN std=AGE_SD
         median=AGE_MED min=AGE_MIN max=AGE_MAX;
run;

proc print data=agestats noobs;
  format AGE_MEAN AGE_SD 8.3 AGE_MED 5.1;
run;

/* 4. NODUPRECS only compares adjacent records.
      Records A1 and A1-copy are identical but separated by B for the same
      subject. BY USUBJID keeps input order within the subject -> 0 deleted;
      BY _ALL_ makes them adjacent -> 1 deleted.                             */
data raw_ae;
  infile datalines dlm='|' truncover;
  input USUBJID :$20. AETERM :$30. AESTDTC :$10.;
  datalines;
CBX417-301-1012-0001|Nausea|2022-05-02
CBX417-301-1012-0001|Fatigue|2022-05-09
CBX417-301-1012-0001|Nausea|2022-05-02
;
run;

proc sort data=raw_ae out=ae_by_subj noduprecs;
  by USUBJID;
run;

proc sort data=raw_ae out=ae_by_all noduprecs dupout=ae_dups;
  by _all_;
run;

/* 5. Deliberate error: BY on unsorted data in a procedure.               */
proc means data=adsl_in n mean;
  by TRT01P;
  var AGE;
run;

/* 6. OPTIONAL: the same summaries on the generated CBX417-301 ADSL.       */
proc import datafile="&root/adam/adsl.csv" out=adsl_csv dbms=csv replace;
  guessingrows=max;
run;

proc means data=adsl_csv n mean std median min max maxdec=1;
  where SAFFL = 'Y';
  class TRT01A;
  var AGE;
run;
