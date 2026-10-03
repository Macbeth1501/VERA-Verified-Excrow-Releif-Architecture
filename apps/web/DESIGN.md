---
name: VERA
description: Milestone-gated escrow crowdfunding and relief, shown as a public account book kept in warm charcoal and copper.
colors:
  ground: "#3a332f"
  panel: "#453d38"
  well: "#2f2926"
  rule: "#5a5049"
  rule-strong: "#948577"
  ink: "#f1e7da"
  sand: "#c9bcab"
  dim: "#c0b2a2"
  copper: "#e9a46f"
  copper-hover: "#f1b283"
  on-copper: "#2a221e"
  ok: "#7fcf9c"
  ok-wash: "#34443a"
  warn: "#e6c15c"
  warn-wash: "#4a4128"
  bad: "#f79aa1"
  bad-wash: "#4e3335"
typography:
  display-hero:
    fontFamily: "Besley, Georgia, 'Times New Roman', serif"
    fontSize: "3.75rem"
    fontWeight: 600
    lineHeight: 1.05
    letterSpacing: "-0.01em"
  display-page:
    fontFamily: "Besley, Georgia, 'Times New Roman', serif"
    fontSize: "3rem"
    fontWeight: 600
    lineHeight: 1.1
    letterSpacing: "-0.01em"
  headline:
    fontFamily: "Besley, Georgia, 'Times New Roman', serif"
    fontSize: "1.5rem"
    fontWeight: 600
    lineHeight: 1.33
  figure:
    fontFamily: "Besley, Georgia, 'Times New Roman', serif"
    fontSize: "1.875rem"
    fontWeight: 600
    lineHeight: 1.2
  body:
    fontFamily: "Hanken Grotesk, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.6
  body-lead:
    fontFamily: "Hanken Grotesk, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "Hanken Grotesk, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 500
    lineHeight: 1.43
  caption:
    fontFamily: "Hanken Grotesk, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 400
    lineHeight: 1.33
  hash:
    fontFamily: "Geist Mono, ui-monospace, monospace"
    fontSize: "0.8125rem"
    fontWeight: 400
    lineHeight: 1.33
rounded:
  focus: "2px"
  md: "6px"
  lg: "8px"
  pill: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "48px"
  page: "96px"
components:
  button-primary:
    backgroundColor: "{colors.copper}"
    textColor: "{colors.on-copper}"
    rounded: "{rounded.md}"
    height: "44px"
    padding: "0 24px"
  button-primary-hover:
    backgroundColor: "{colors.copper-hover}"
  button-secondary:
    backgroundColor: "{colors.well}"
    textColor: "{colors.copper}"
    rounded: "{rounded.md}"
    height: "40px"
    padding: "0 16px"
  input:
    backgroundColor: "{colors.well}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    height: "44px"
    padding: "0 12px"
  panel:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.sand}"
    rounded: "{rounded.lg}"
    padding: "20px"
  seal-verified:
    backgroundColor: "{colors.ok-wash}"
    textColor: "{colors.ok}"
    rounded: "{rounded.pill}"
    padding: "6px 16px"
  notice:
    backgroundColor: "{colors.warn-wash}"
    textColor: "{colors.warn}"
    rounded: "{rounded.md}"
    padding: "12px 16px"
---

# Design System: VERA

## Overview

**Creative North Star: "The Kept Ledger"**

VERA reads like an account book that anyone may inspect. Money is shown the way a ledger shows it: ruled rows, a statement of what came in, went out and is still held, and a single four-stage rail (locked, confirmed, released, paid out) that follows every donation from escrow to beneficiary. The page is never a dashboard of boxes: information sits on ruled lines, and only the two things that need to stand apart (the donate panel and the verification note) get a raised panel.

The theme is one designed mid-tone dark: a warm charcoal ground (#3a332f), neither near-black nor bright, lit by cream ink and a single copper voice. It was chosen for a reviewer studying a demo on a laptop, and to avoid the neon-on-black or glowing look of generic dark sites. Headings and money are set in Besley, a ledger-print serif; reading text is Hanken Grotesk; hashes and addresses are Geist Mono. There is no light theme.

**Key Characteristics:**
- Warm charcoal ground with a raised panel and a sunken well; three surface heights, no shadows.
- Copper is the single accent: links, primary actions, the rail. Green, brass and rose appear only as state.
- Ruled rows and hairlines instead of cards; the four-stage rail is the recurring motif.
- Serif for headings and money, grotesque for reading, mono for chain data; tabular numerals in every table and figure.
- One shared 1152px grid; every page starts at the same left edge as the top bar.
- Honest states: verified, could not compare, does not match; lagging data and unreadable chain are shown, never hidden.

## Colors

A warm charcoal scale, one copper accent and three state hues. Contrast measured against WCAG AA.

### Primary
- **Copper** (#e9a46f): links, the primary button fill, the rail line and its nodes, active navigation underline, focus ring and text selection. 5.9:1 on the ground. Its hover is Copper Lift (#f1b283).
- **On Copper** (#2a221e): the dark ink on copper fills (7.4:1).

### Neutral
- **Ground** (#3a332f): the page.
- **Panel** (#453d38): the raised surface for the donate and verification panels and hover fills.
- **Well** (#2f2926): sunken fields, inputs and the top bar.
- **Rule** (#5a5049): hairlines between rows and around panels.
- **Rule Strong** (#948577): input borders and unfilled nodes (3.5:1, the UI-component minimum is 3:1).
- **Ink** (#f1e7da): headings, figures and primary text (10.1:1).
- **Sand** (#c9bcab): body and secondary text (6.7:1).
- **Dim** (#c0b2a2): captions, timestamps, notes (6.0:1, still 4.5:1 or better on panels and washes).

### Status
- **Moss** (#7fcf9c) on **Moss Wash** (#34443a): verified, matched, confirmations.
- **Brass** (#e6c15c) on **Brass Wash** (#4a4128): lagging, switched off, pending.
- **Rose** (#f79aa1) on **Rose Wash** (#4e3335): errors, mismatches.

### Named Rules
**The Copper Voice Rule.** Copper is the only accent. It marks what you can act on or what moves money forward; it is never used as decoration or as a status colour.

**The Status-Only Rule.** Moss, brass and rose mean state and nothing else.

**The Measured Contrast Rule.** Every text pair is at least 4.5:1 on every surface it appears on, checked with numbers, not by eye.

## Typography

**Display Font:** Besley (with Georgia, serif)
**Body Font:** Hanken Grotesk (with system sans)
**Label/Mono Font:** Geist Mono (hashes, addresses)

**Character:** Besley is a Clarendon-style print serif with the weight of a ledger's page headings; Hanken Grotesk stays quiet beside it and reads cleanly at 14px. Mono appears only for chain data.

### Hierarchy
- **Display hero** (600, 3.75rem at sm and up, 1.05): the home statement only.
- **Display page** (600, 3rem, 1.1): the H1 of each public page.
- **Headline** (600, 1.5rem, 1.33): section headings ("Where the money is", "Milestones").
- **Figure** (600, 1.875rem): the "Still held in escrow" amount; other row amounts are 1.25rem semibold.
- **Body** (400, 1rem, 1.6): running text, capped near 62ch; **Body lead** (1.125rem) for page introductions.
- **Label** (500, 0.875rem): form labels, table headers, links in the top bar.
- **Caption** (400, 0.8125rem): badges, stage labels. **Hash** (Geist Mono 0.8125rem): transaction hashes and addresses.

### Named Rules
**The Tabular Rule.** Money and dates use tabular numerals (`.num`, and every table) so columns line up.

**The Serif-For-Headings Rule.** Besley is for headings and headline figures only; body and controls stay in the sans.

## Layout

One centered container of 1152px (`max-w-6xl`) with a 24px gutter, shared by the top bar and every page; content columns sit at its left edge so nothing floats. Public pages use a 12-column grid at lg: the campaign page puts the statement and milestones in 7 columns and a sticky aside (donate panel, verification note) in 5. Reading columns cap near 62ch. Signed-in workspace pages start with the shared `PageHead` (optional back link, display title, one lead sentence, optional action) and keep columns of `max-w-4xl` or the full container, left-aligned to the same edge; pages with a primary list and a secondary panel (campaign, beneficiaries) use a two-column grid with a 21 to 24rem aside. A skip-to-content link is the first Tab stop on every page, and a footer closes every page with the testnet notice and the main links. Vertical rhythm: 48 to 96px between page sections, tighter 12 to 16px inside rows, more space above a heading than below it.

Below md, tables become stacked, labelled rows (`data-label`), so nothing scrolls sideways; the aside stacks between the statement and the milestones so the donate panel is reached before the long lists.

## Elevation & Depth

Flat. Depth comes from surface height (well, ground, panel) and hairlines, never shadows. The only lift is a hover fill. The top bar sits on the sunken well tone with a bottom rule.

### Named Rules
**The Ledger-Line Rule.** Separate content with a ruled line before reaching for a box or a fill.

## Shapes

Small, quiet corners: 6px on buttons, inputs and notices; 8px on the two raised panels; a full pill for seals and badges; a 2px radius on the focus outline. Timeline nodes are circles. Ruled rows have square edges. Icons are authored SVG in one 1.6 stroke weight.

## Components

### Buttons
- **Shape:** 6px radius, 44px tall for primary actions (40px in dense toolbars).
- **Primary:** copper fill, On Copper text, 24px side padding; hover lifts to Copper Lift; disabled drops to 60% opacity.
- **Secondary:** transparent or well fill with a 1px copper border and copper text.
- **Text actions:** underlined copper text in body copy, with a 32px minimum target height.

### Stage rail and stage track
- **Rail (home):** a vertical ledger of four stages, each a 36px circle node with an authored icon (lock, check, arrow-out, person) on a copper line that draws in once; a live amount sits at the right of each stage.
- **Track (milestones):** a horizontal four-node line; completed nodes are filled copper with a check, the current stage label is Ink, later stages are Dim. Labelled group for assistive tech.

### Statement of account
- **Rows:** label and note at left, tabular amount at right, hairline between; the final row ("Still held in escrow") has a stronger top rule and the Besley figure size. A "Released, not yet paid out" row appears whenever released exceeds paid out, so every rupee is accounted for.
- **Milestone row:** title with its share and target, the released amount as the one Besley figure at the right, the four-stage track, then one plain sentence. No equal-weight stat columns.
- **Activity strip:** the rail drawn small; a node is copper-filled once its stage has happened, hollow at zero, and a caption states the scope (all campaigns or the chosen one).

### Seals and badges
- **Seal:** pill with a shield glyph: Moss for verified, Rose for mismatch, neutral for unavailable or not compared.
- **Event badge:** small outlined pill; neutral for money in, Moss for confirmations, Ink for money out (copper stays reserved for what can be acted on).

### Cards / Containers
- Two raised panels only (donate, verification): Panel fill, 8px radius, hairline border, 20px padding. Everything else is ruled rows.

### Inputs / Fields
- **Style:** Well fill, 1px Rule Strong border, 6px radius, 44px tall, no shadow.
- **Focus:** the border turns copper and a 2px copper outline appears (all focusable elements share it).
- **Error / Disabled:** Rose Wash banner with Rose text; disabled at 60%.

### Workspace pages
- **Head:** `PageHead`: back link (arrow, 32px target), Besley title, 62ch lead. Lists are ruled rows with a status dot (Moss filled, Brass hollow, Rose filled) instead of bordered cards; status seals are pills.
- **Forms:** numbered ruled rows for repeating groups (milestones), one raised panel for a form that sits beside a list, native file inputs restyled to the palette.
- **Explanation page:** `/how-it-works` carries the plain-words glossary and the contracts in plain language; other pages link to it rather than defining terms inline.

### Navigation
- **Style:** a sunken top bar with the VERA wordmark in Besley, role-aware links at 14px (signed-out visitors see Campaigns, Chain activity and How it works), the active page marked by a copper underline and `aria-current`, the signed-in identity right-aligned, and a copper "Sign in" button when signed out. A brass strip drops below it when another window has changed the account.

### Tables
- **Style:** hairline rows, Dim header text, tabular figures, hashes in mono; below md each row becomes a labelled stack.

## Do's and Don'ts

### Do:
- **Do** show money as a statement of ruled rows and let the rail carry the story.
- **Do** keep copper for actions and movement, and status hues for state only.
- **Do** verify contrast with numbers before adding a text colour to a new surface.
- **Do** keep pending, lagging, unavailable and mismatched states distinct and honest.
- **Do** align new pages to the shared 1152px container and its left edge.

### Don't:
- **Don't** return to a near-black or bright-white theme, or add a light mode, without a new decision.
- **Don't** use cards, nested boxes, hero-metric tiles, gradient text, glass, shadows or side-stripe borders.
- **Don't** put a kicker or eyebrow above a heading.
- **Don't** use Besley for body text or controls.
- **Don't** invent claims or figures: totals come from the chain or are omitted.
