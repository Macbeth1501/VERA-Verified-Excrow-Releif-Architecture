---
target: public pages (third scoring pass)
total_score: 29
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 2
target_identity: "file:C:\\Users\\Rochan\\Desktop\\Coding\\Projects\\vera-mvp\\apps\\web\\file:C:\\Users\\Rochan\\Desktop\\Coding\\Projects\\vera-mvp\\apps\\web\\components\\LedgerDashboard.tsx"
timestamp: 2026-10-01T10-20-42Z
slug: p-apps-web-components-ledgerdashboard-tsx-023165f9
---
# Critique: public pages (third scoring pass, correctly seeded)
Method: Assessment A by an isolated sub-agent (real Chrome, 1280 and 390 px, all public pages). The campaign page showed the verified state (reconciliation match). Detector run separately earlier: 0 findings. Score 29/40 (Good), all ten heuristics scored. Previous runs: 28/40 twice (both with an unverified seal caused by a mis-cased test vault address), original 23/36.

Heuristics: 1 Status 4, 2 Real world 3, 3 Control 3, 4 Consistency 3, 5 Error prevention 3, 6 Recognition 3, 7 Flexibility 2, 8 Minimalism 3, 9 Recovery 2 (placeholder: no error state was exercisable), 10 Help 3.

Priority issues
- [P1] Money-accounting gap on the campaign page: Released 250 and Paid out 30 leaves 220 unexplained; add a row "Released, not yet paid out (held by the organizer)"; the Paid out node fills for a partial payout. Command: clarify.
- [P1] Milestone cards: Share of the goal 400 beside Released 100 reads as contradictory, "Status: Released" repeats the track, four equal columns flatten the data. Restructure as a ruled row with the released amount primary. Command: layout.
- [P2] Chain activity summary counts are global and unlabelled, ignore the active filter, and the hollow nodes read as incomplete; lag text never turns amber. Command: polish.
- [P2] Sparse campaigns list and organizer profile; a row showing 0.00 held can read as empty rather than fully released. Command: layout.
- [P3] Login and register are the least authored pages; keep the account blurb on register only. Command: distill.

Not verified by the agent: hover appearance, tap targets, contrast ratios, screen reader behaviour, error/empty/unavailable states, signed-in views.
