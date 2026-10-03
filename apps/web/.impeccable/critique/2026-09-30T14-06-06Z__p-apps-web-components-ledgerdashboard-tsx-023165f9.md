---
target: public pages (post-redesign)
total_score: 28
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 2
target_identity: "file:C:\\Users\\Rochan\\Desktop\\Coding\\Projects\\vera-mvp\\apps\\web\\file:C:\\Users\\Rochan\\Desktop\\Coding\\Projects\\vera-mvp\\apps\\web\\components\\LedgerDashboard.tsx"
timestamp: 2026-09-30T14-06-06Z
slug: p-apps-web-components-ledgerdashboard-tsx-023165f9
---
# Critique: public pages (re-critique after the Kept Ledger redesign)
Method: Assessment A by an isolated sub-agent (real Chrome, 1280 and 390 px); Assessment B (detector) run separately by the parent: 0 findings on rendered pages and source. Score 28/40 (Good), all ten heuristics scored. Like-for-like with the first run (heuristic 7 excluded): 26/36 vs 23/36.

Heuristics: 1 Status 3, 2 Real world 3, 3 Control 3, 4 Consistency 3, 5 Error prevention 3, 6 Recognition 3, 7 Flexibility 2, 8 Minimalism 3, 9 Recovery 3, 10 Help 2.

Priority issues
- [P1] Figures contradict themselves next to an error state: "paid out" means both released and recorded payout; milestone 2 says paid out 150 under an unfilled Paid out node; home shows Locked 0.00; the seal says could not be compared. Fix: one word per stage, released and paid-out as two labelled figures, seal beside the statement. Command: clarify.
- [P1] Chain activity is a wall of near-identical rows (60 events, 7500 px). Fix: summary strip, group by story, collapse contract and hash links, clear filters. Commands: distill, layout.
- [P2] Empty space and short pages (campaigns list rows stop short of the container edge, sparse organizer profile, campaign aside ends early). Command: layout.
- [P2] No explanation layer for reviewers (no glossary or how-it-works page; contract names shown raw). Command: onboard.
- [P3] Small details: no skip link, 12 px captions and hashes, copper links and pills share one weight. Command: polish.

Not verified by the agent: hover states, mobile shots of organizer/login/register/activity, home nav (capture timing).
