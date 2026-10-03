---
target: public pages
total_score: 23
max_score: 36
na_heuristics: 7
p0_count: 0
p1_count: 3
target_identity: "file:C:\\Users\\Rochan\\Desktop\\Coding\\Projects\\vera-mvp\\apps\\web\\components\\LedgerDashboard.tsx"
target_fingerprint: "sha256:6ba753a003f4218e9260636fe63868c58a80ce9300c87bbb33589e655b4a2abb"
target_path: "C:\\Users\\Rochan\\Desktop\\Coding\\Projects\\vera-mvp\\apps\\web\\components\\LedgerDashboard.tsx"
timestamp: 2026-09-30T10-26-39Z
slug: components-ledgerdashboard-tsx
---
# Critique: public pages (home, campaigns, campaign, Chain activity, organizer profile, login, register)
Method: DEGRADED single-context (sub-agents not started this session). Score 23/36 (Acceptable). Heuristic 7 n/a.

Priority issues
- [P1] Home tells no story and has no identity: show the mechanism (locked, confirmed, released, paid out) with live chain totals and one primary action. Commands: shape, layout.
- [P1] Campaign page buries the money story: 'Held in escrow 0.00' beside a 50 percent bar contradicts; lead with donated, released, paid out; stage tracker per milestone; trust badge near title. Commands: layout, clarify.
- [P1] Foundation contradicts brief: OS-driven white or near-black theme, Arial body overriding Geist. Need one mid-tone dark theme and a chosen type pairing. Commands: typeset, colorize.
- [P2] Alignment and canvas: three left edges (nav 152, campaign 280, home 328), 280px empty margins at 1280. Command: layout.
- [P2] Dense tables and tiny targets: payout table clips at 390px, 122 links under 24px on Chain activity, input focus is only a border colour. Commands: adapt, harden.

Detector: 1 warning (overused-font, globals.css line 25, font-family Arial).
Persona red flags: Jordan (no explanation on home, four equal buttons), Riley (reconciliation could-not-compare has no retry, bare empty states, clipped table), Sam (tiny targets, weak focus, colour-coded state).
