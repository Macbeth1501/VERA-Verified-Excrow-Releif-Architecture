---
target: public pages (second re-critique)
total_score: 28
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 1
target_identity: "file:C:\\Users\\Rochan\\Desktop\\Coding\\Projects\\vera-mvp\\apps\\web\\file:C:\\Users\\Rochan\\Desktop\\Coding\\Projects\\vera-mvp\\apps\\web\\components\\LedgerDashboard.tsx"
timestamp: 2026-10-01T09-55-30Z
slug: p-apps-web-components-ledgerdashboard-tsx-023165f9
---
# Critique: public pages (second re-critique, after the P1/P2/P3 fixes)
Method: Assessment A by an isolated sub-agent (real Chrome, 1280 and 390 px, all 8 public pages plus two activity filter variants). Detector (Assessment B) run separately by the parent earlier: 0 findings. Score 28/40 (Good), all ten heuristics scored. Previous run also 28/40.

Heuristics: 1 Status 3, 2 Real world 3, 3 Control 3, 4 Consistency 3, 5 Error prevention 3, 6 Recognition 3, 7 Flexibility 2, 8 Minimalism 3, 9 Recovery 2, 10 Help 3.

Priority issues
- [P1] The first impression of the campaign page is an unverified state ("Could not be compared just now" with Still held 0.00): lead with a plain reason, show the last good comparison, merge the pill and the side panel into one verification panel. Command: clarify.
- [P2] Inner pages weaker than home (organizer column narrower than the grid with no active nav; activity stat strip resembles a hero-metric row). Command: layout.
- [P2] /how-it-works is long (about 3000 px): lift the trust list above roles, trim. Command: distill.
- [P2] No contextual help on the campaign page (council approvals, share of the goal, confirmations): link terms to the glossary. Command: clarify.
- [P3] Technical copy: "Contract and block" label, bare fingerprint hash; organizer page title is the generic site title.

Not verified by the agent: contrast ratios, hover states, live refresh, reduced motion, screen reader, 200% zoom, error and empty states, anything behind sign-in. Hover states were verified separately by the parent (see PROGRESS_LOG).
