#!/bin/bash
# End-to-end run against a Buy Buddy server: start a 4090 hunt, wait for the
# candidates, pick the demo listing, upload a fixture photo, wait for the verdict,
# then (optionally) upload a second photo. Prints the funnel, verdicts and trail.
# Usage: bash scripts/e2e.sh <base-url> <photo1.jpg> [photo2.jpg]
set -u
B="$1"; P1="$2"; P2="${3:-}"
j() { python3 -c "import json,sys;d=json.load(sys.stdin);print($1)"; }
wait_for() { # $1 = python condition on d
  local s=$(date +%s)
  until curl -s "$B/api/hunts/$H" | python3 -c "import json,sys;d=json.load(sys.stdin);exit(0 if ($1) else 1)"; do
    sleep 2; [ $(( $(date +%s) - s )) -gt 240 ] && { echo "TIMEOUT waiting for: $1"; return 1; }
  done
  echo "  ...took $(( $(date +%s) - s ))s"
}
H=$(curl -s -X POST "$B/api/hunts" -H 'content-type: application/json' -d '{"query":"RTX 4090","maxPrice":1500}' | j "d['huntId']")
echo "hunt $H"
wait_for "d['status']!='active'"
curl -s "$B/api/hunts/$H" | j "d['state'], d['status'], d['funnel'], [ (c['id'], c['finalist']) for c in d['candidates'][:6] ]"
curl -s -X POST "$B/api/hunts/$H/select" -H 'content-type: application/json' -d '{"listingId":"demo-ebay-128125153911"}'; echo
wait_for "d['state']=='seller_photo'"
curl -s "$B/api/hunts/$H" | j "'challenge:', d['challenge']['code']"
for P in "$P1" $P2; do
  V=$(curl -s -X POST "$B/api/hunts/$H/photo" -H 'content-type: image/jpeg' --data-binary @"$P" | j "d['version']")
  echo "uploaded $P as photo $V"
  wait_for "d.get('verdict') and d['verdict']['photoVersion']>=$V"
  curl -s "$B/api/hunts/$H" | python3 -c "
import json,sys;v=json.load(sys.stdin)['verdict'];print('VERDICT', v['scenario'], v['confidence'], v['model'])
for c in v['checks']: print('  ', c['status'].upper(), '|', c['label'], '|', c['detail'])"
done
curl -s -X POST "$B/api/hunts/$H/decision" -H 'content-type: application/json' -d '{"choice":"walk"}'; echo
wait_for "d['state']=='decided'"
curl -s "$B/api/hunts/$H" | python3 -c "
import json,sys;d=json.load(sys.stdin);print('FINAL', d['state'], d['status'])
for e in d['trail']: print(' -', e['actor'], '|', e['action'], '|', e['decision'][:140], '| \$%.5f' % e['modelCost'], e.get('latencyMs'))"
