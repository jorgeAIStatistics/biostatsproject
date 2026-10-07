#!/usr/bin/env bash
# Downloads the current CDISC Controlled Terminology (SDTM + ADaM) from NCI EVS
# into .cache/cdisc-ct/ so authors can verify codelist values locally.
# Source: https://evs.nci.nih.gov/ftp1/CDISC/  (published by NCI EVS for CDISC)
set -euo pipefail
cd "$(dirname "$0")/../.."
mkdir -p .cache/cdisc-ct
curl -sS -o .cache/cdisc-ct/sdtm_ct.txt "https://evs.nci.nih.gov/ftp1/CDISC/SDTM/SDTM%20Terminology.txt"
curl -sS -o .cache/cdisc-ct/adam_ct.txt "https://evs.nci.nih.gov/ftp1/CDISC/ADaM/ADaM%20Terminology.txt"
echo "Saved to .cache/cdisc-ct/"
