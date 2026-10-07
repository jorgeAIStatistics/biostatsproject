#!/usr/bin/env python3
"""Look up CDISC Controlled Terminology codelists downloaded by fetch-cdisc-ct.sh.

Usage:
  python3 scripts/tools/ct_lookup.py LBTESTCD            # exact codelist short name
  python3 scripts/tools/ct_lookup.py --search "Race"     # codelist name contains text
  python3 scripts/tools/ct_lookup.py --term QTCFAG       # find a submission value anywhere
  python3 scripts/tools/ct_lookup.py --adam DATEFL       # search the ADaM CT file
"""
import csv, sys, pathlib

ROOT = pathlib.Path(__file__).resolve().parents[2] / ".cache" / "cdisc-ct"

def load(name):
    path = ROOT / name
    if not path.exists():
        sys.exit(f"{path} not found — run scripts/tools/fetch-cdisc-ct.sh first")
    rows = list(csv.reader(open(path, encoding="utf-8", errors="replace"), delimiter="\t"))[1:]
    lists = {r[0]: r for r in rows if r[1] == ""}
    return rows, lists

def show(rows, cl):
    terms = [r for r in rows if r[1] == cl[0]]
    print(f"== {cl[3]}  [{cl[4]}]  code={cl[0]}  extensible={cl[2]}  n={len(terms)}")
    for t in terms:
        syn = f"  (synonyms: {t[5]})" if t[5] else ""
        print(f"   {t[4]}{syn}")

args = sys.argv[1:]
if not args:
    print(__doc__); sys.exit(0)
fname = "adam_ct.txt" if "--adam" in args else "sdtm_ct.txt"
args = [a for a in args if a != "--adam"]
rows, lists = load(fname)
if args[0] == "--search":
    q = " ".join(args[1:]).lower()
    for cl in lists.values():
        if q in cl[3].lower():
            print(f"{cl[4]:12} {cl[3]}")
elif args[0] == "--term":
    q = args[1].lower()
    for r in rows:
        if r[1] and r[4].lower() == q:
            cl = lists.get(r[1])
            print(f"{r[4]}  in  {cl[4] if cl else '?'} ({cl[3] if cl else ''})")
else:
    for name in args:
        found = [c for c in lists.values() if c[4] == name]
        if not found:
            print(f"(no codelist with short name {name}; try --search)")
        for cl in found:
            show(rows, cl)
