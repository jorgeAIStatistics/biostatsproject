/*============================================================================
  Program : sas-data-step-and-pdv.sas
  Lesson  : The DATA step and the Program Data Vector
  Purpose : Watch the PDV: row-wise derivations, reset of created variables,
            implicit vs explicit OUTPUT, and an "uninitialized" typo.
  NOTE    : This program was NOT executed in this environment (SAS is not
            available here). Written for SAS 9.4 / SAS OnDemand for Academics.
            Expected results are described in the lesson.
  Data    : In-stream (DATALINES) only.
============================================================================*/

data adsl_in;
  input USUBJID :$20. AGE HEIGHTBL WEIGHTBL;
  datalines;
CBX417-301-1012-0001 64 172 81.5
CBX417-301-1012-0002 71 160 .
CBX417-301-2031-0001 58 181 95.2
CBX417-301-3044-0001 66 158 54.6
;
run;

/* 1. Row-wise derivations. PUTLOG shows the PDV for one subject.
      Expected: BMIBL = 27.5487, ., 29.0589, 21.8715 (prints 27.5 . 29.1 21.9)
      and a "Missing values were generated" note with count 1.             */
data adsl;
  set adsl_in;
  length AGEGR1 $4;
  BMIBL = WEIGHTBL / (HEIGHTBL / 100)**2;
  if AGE >= 65 then AGEGR1 = '>=65';
  else AGEGR1 = '<65';
  format BMIBL 5.1;
  if USUBJID = 'CBX417-301-1012-0002' then putlog _all_;
run;

proc print data=adsl noobs;
run;

/* 2. Show the reset: at the top of each iteration created variables are
      missing, input variables still hold the previous row's values.       */
data _null_;
  if 0 then set adsl_in;   /* never executes; defines the input variables in the
                              PDV at compile time, before PUTLOG mentions them */
  length AGEGR1 $4;
  putlog 'TOP   ' _N_= USUBJID= AGEGR1=;
  set adsl_in;
  AGEGR1 = ifc(AGE >= 65, '>=65', '<65');
  putlog 'BOTTOM' _N_= USUBJID= AGEGR1=;
run;
/* Expected: the TOP line of iteration 2 shows subject 1012-0001 (previous
   row) with AGEGR1 blank; iteration 5 prints only a TOP line, then stops. */

/* 3. Explicit OUTPUT switches off implicit output: ADSL_BAD has 0 obs.    */
data adsl_bad elderly;
  set adsl_in;
  if AGE >= 65 then output elderly;
run;

data adsl_ok elderly;
  set adsl_in;
  output adsl_ok;
  if AGE >= 65 then output elderly;
run;

/* 4. A typo: expect "NOTE: Variable WIEGHTBL is uninitialized." and
      4 missing values generated; the output has 6 variables, not 5.       */
data typo;
  set adsl_in;
  BMIBL = WIEGHTBL / (HEIGHTBL / 100)**2;
run;
