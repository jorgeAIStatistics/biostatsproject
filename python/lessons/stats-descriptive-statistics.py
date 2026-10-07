"""Lesson: stats-descriptive-statistics

Descriptive statistics for clinical tables: quantile definitions (SAS default vs NumPy/pandas
default), skewed data and summaries by arm.

Run from anywhere:  python3 python/lessons/stats-descriptive-statistics.py
Requires: numpy, pandas. Data: data/cardio/adsl.csv (synthetic VTX221-201 trial).
"""
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[2]
adsl = pd.read_csv(ROOT / "data" / "cardio" / "adsl.csv")

# 1. Worked example: ALT (U/L) in ten subjects
alt = np.array([14, 17, 18, 21, 22, 25, 29, 33, 48, 112], dtype=float)
print(f"mean {alt.mean():.1f}  median {np.median(alt):.1f}  SD (ddof=1) {alt.std(ddof=1):.2f}  SD (ddof=0) {alt.std():.2f}")
sas_q = np.quantile(alt, [0.25, 0.75], method="averaged_inverted_cdf")  # SAS QNTLDEF=5 / R type 2
lin_q = np.quantile(alt, [0.25, 0.75])                                  # NumPy default = R type 7
print("Q1, Q3 SAS default:", sas_q, " NumPy/R default:", lin_q)
gm = np.exp(np.log(alt).mean())
gcv = 100 * np.sqrt(np.exp(np.log(alt).std(ddof=1) ** 2) - 1)
print(f"geometric mean {gm:.2f}  geometric CV% {gcv:.1f}")

# 2. Baseline SBP by arm (ITT), SAS-compatible quartiles
def q(p):
    return lambda s: np.quantile(s, p, method="averaged_inverted_cdf")

itt = adsl[adsl["ITTFL"] == "Y"]
summary = (itt.groupby(["TRT01PN", "TRT01P"])["SBPBL"]
              .agg(n="count", mean="mean", sd="std", median="median",
                   q1=q(0.25), q3=q(0.75), min="min", max="max"))
print(summary.round(3).to_string())

# pandas' own quantile uses linear interpolation (type 7): compare placebo Q3
plc = itt.loc[itt["TRT01P"] == "Placebo", "SBPBL"]
print("placebo SBPBL Q3 — SAS default:", q(0.75)(plc), " pandas default:", plc.quantile(0.75))

# 3. A left-skewed variable: treatment compliance in the safety population
comp = adsl.loc[adsl["SAFFL"] == "Y", "COMPLPCT"]
print(f"COMPLPCT n {comp.size}  mean {comp.mean():.2f}  median {comp.median():.1f}  min {comp.min()}  <80%: {(comp < 80).sum()}")
