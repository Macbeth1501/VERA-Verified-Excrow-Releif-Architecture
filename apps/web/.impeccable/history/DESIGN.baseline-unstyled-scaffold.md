---
name: VERA
description: Milestone-gated escrow crowdfunding and relief on a testnet; baseline of the current look before the redesign.
colors:
  page-white: "#ffffff"
  ink-near-black: "#171717"
  night-page: "#0a0a0a"
  night-ink: "#ededed"
  zinc-ink: "#18181b"
  zinc-body: "#52525b"
  zinc-muted: "#71717a"
  zinc-hairline: "#e4e4e7"
  zinc-wash: "#f4f4f5"
  amber-notice: "#fffbeb"
  amber-notice-ink: "#92400e"
  red-alert: "#fef2f2"
  red-alert-ink: "#b91c1c"
  emerald-success: "#ecfdf5"
  emerald-success-ink: "#047857"
typography:
  body:
    fontFamily: "Arial, Helvetica, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
  page-title:
    fontFamily: "Arial, Helvetica, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 600
    lineHeight: 1.33
  hero-figure:
    fontFamily: "Arial, Helvetica, sans-serif"
    fontSize: "2.25rem"
    fontWeight: 600
    lineHeight: 1.11
  label:
    fontFamily: "Arial, Helvetica, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 500
    lineHeight: 1.43
  caption:
    fontFamily: "Arial, Helvetica, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 400
    lineHeight: 1.33
  hash:
    fontFamily: "Geist Mono, ui-monospace, monospace"
    fontSize: "0.75rem"
    fontWeight: 400
    lineHeight: 1.33
rounded:
  md: "6px"
  lg: "8px"
spacing:
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  page: "64px"
components:
  button-primary:
    backgroundColor: "{colors.zinc-ink}"
    textColor: "{colors.page-white}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
  button-secondary:
    backgroundColor: "{colors.page-white}"
    textColor: "{colors.zinc-ink}"
    rounded: "{rounded.md}"
    padding: "10px 20px"
  card:
    backgroundColor: "{colors.page-white}"
    textColor: "{colors.zinc-ink}"
    rounded: "{rounded.lg}"
    padding: "20px"
  input:
    backgroundColor: "{colors.page-white}"
    textColor: "{colors.zinc-ink}"
    rounded: "{rounded.md}"
    padding: "8px 12px"
  notice-banner:
    backgroundColor: "{colors.amber-notice}"
    textColor: "{colors.amber-notice-ink}"
    rounded: "{rounded.md}"
    padding: "8px 12px"
---

# Design System: VERA

> Baseline record of the **current** look, written before the redesign. It documents what ships today so later work can measure against it. It is not the target direction.

## Overview

**Creative North Star: "The Unstyled Scaffold"**

The interface is a framework default wearing Tailwind's neutral gray: white or near-black pages, small gray text, thin bordered boxes and almost no identity of its own. It is legible and honest, and it never gets in the way of the data, but nothing about it says "trust" or "VERA". Colour appears only when something needs attention: amber for pending or lagging, red for errors, green for success.

Theme follows the visitor's operating system: pure white by day, near-black (`#0a0a0a`) by night. There is no middle tone. Density is compact (mostly 14px text) and pages are single narrow columns.

**Key Characteristics:**
- Neutral gray on white or near-black; no brand colour.
- Bordered, unshadowed boxes; flat at rest.
- One system font (Arial) for everything, with monospace only for hashes and addresses.
- Semantic colour used only for status.
- Narrow, centered single-column pages.

## Colors

A gray scale plus three status hues; there is no primary or accent colour.

### Neutral
- **Page White** (#ffffff): the light-mode page background and card fill.
- **Ink Near Black** (#171717): light-mode base text colour set on the body.
- **Night Page** (#0a0a0a): dark-mode page background, chosen automatically by OS preference.
- **Night Ink** (#ededed): dark-mode base text.
- **Zinc Ink** (#18181b): headings and the primary button fill in light mode.
- **Zinc Body** (#52525b): secondary text and descriptions, the most used colour after ink.
- **Zinc Muted** (#71717a): captions, timestamps, counts.
- **Zinc Hairline** (#e4e4e7): every border and divider in light mode.
- **Zinc Wash** (#f4f4f5): hover fill on secondary buttons.

### Status
- **Amber Notice** (#fffbeb) with **Amber Notice Ink** (#92400e): pending, lagging, switched off, duplicate.
- **Red Alert** (#fef2f2) with **Red Alert Ink** (#b91c1c): errors, failed steps.
- **Emerald Success** (#ecfdf5) with **Emerald Success Ink** (#047857): confirmed, matched, success.

### Named Rules
**The Status-Only Colour Rule.** Hue means state. Amber, red and green are used for nothing else, and nothing is coloured decoratively.

**The Two Themes Rule.** Every neutral has a paired dark-mode value; there is no third, mid-tone theme.

## Typography

**Display Font:** Arial (with Helvetica, sans-serif)
**Body Font:** Arial (with Helvetica, sans-serif)
**Label/Mono Font:** Geist Mono (for transaction hashes and addresses)

**Character:** Plain system sans throughout. The layout loads Geist Sans, but `body` sets Arial in `globals.css`, so Geist Sans never renders; only monospace snippets use Geist Mono.

### Hierarchy
- **Hero figure** (600, 2.25rem, 1.11): the "Held in escrow" amount and balances.
- **Page title** (600, 1.5rem, 1.33): the H1 of most pages; one campaign title is larger (1.875rem).
- **Body** (400, 1rem, 1.5): summaries and descriptions; secondary text drops to 0.875rem.
- **Label** (500, 0.875rem, 1.43): form labels, links, buttons.
- **Caption** (400, 0.75rem, 1.33): timestamps, blocks, hashes, counts.

### Named Rules
**The Small Text Rule.** Most of the interface is 14px or smaller (`text-sm` is the most common class by far); only page titles and money figures rise above 16px.

## Layout

Single centered column. Container widths step by page purpose: `max-w-xl` for forms and account, `max-w-2xl` for the home page, `max-w-3xl` for campaign pages, `max-w-5xl` for the top bar and the Chain activity timeline. Side gutter is 24px; vertical page padding is 48px (or 64px on account and form pages). Spacing is Tailwind's 4px scale, with 8px and 12px inside boxes and 16 to 24px between sections. Lists are stacked with 12px gaps. There is no grid layout: sections stack. Long text and hashes wrap or shorten.

## Elevation & Depth

Flat. Depth comes from 1px borders alone (Zinc Hairline in light mode, a darker zinc in dark mode). The only shadow is a small `shadow-sm` on text inputs. Nothing lifts on hover except a background wash.

### Named Rules
**The Flat-By-Default Rule.** Surfaces are separated by borders, not shadows or fills.

## Shapes

Modestly rounded rectangles. Buttons, inputs and banners use a 6px radius (`rounded-md`); cards use 8px (`rounded-lg`). One pill shape (`rounded-full`) is used once. No decorative geometry, clipping or imagery; there are no logo or illustration assets (only framework placeholder icons in `public/`).

## Components

### Buttons
- **Shape:** 6px radius.
- **Primary:** Zinc Ink fill, white text, 8px by 16px padding, medium weight; inverts to a near-white fill with dark text in dark mode. Hover lightens the fill; disabled drops to 60% opacity.
- **Secondary:** transparent with a 1px zinc border, 10px by 20px padding; hover adds a light wash.
- **Text link buttons:** underlined 14px text ("Sign out", "Refresh this page").

### Cards / Containers
- **Corner Style:** 8px.
- **Background:** the page colour; no fill.
- **Border:** 1px Zinc Hairline.
- **Internal Padding:** 16 to 24px.

### Inputs / Fields
- **Style:** 1px zinc border, white fill, 6px radius, 8px by 12px padding, small shadow.
- **Focus:** the border darkens to Zinc Ink and the outline is removed.
- **Error:** a red banner below the form; field messages in red 14px text.

### Status banners
- **Style:** filled tinted band with matching dark text, 6px radius, 8px by 12px padding; amber for notices, red for alerts, green for success. Used for data freshness, sync state and errors.

### Navigation
- **Style:** a top bar with a bottom hairline; brand at left in semibold, links in 14px zinc, the signed-in identity right-aligned. Wraps on small screens. A tinted warning strip drops below it when another window has changed the account.

### Ledger and activity rows
- **Style:** bordered rows with a small coloured event badge (emerald for donations, sky for confirmations, violet for council, amber for releases, orange for payouts, gray otherwise), 12px meta line, 14px sentence, and links in 12px underlined text.

## Do's and Don'ts

### Do:
- **Do** keep amounts, statuses and "data as of block" notes visually prominent; they are the product.
- **Do** use amber, red and green only for state.
- **Do** keep pending, lagging and unavailable states visibly distinct from success.
- **Do** keep every page reachable by a link (a test enforces it).

### Don't:
- **Don't** treat this baseline as the target; the theme is to move to a mid-tone dark, neither bright white nor near-black, and away from a generic AI dark website look (see PRODUCT.md).
- **Don't** add decorative colour, gradients or glow.
- **Don't** pre-select anything for the donor or hide costs.
- **Don't** rely on Geist Sans until the `body` font declaration is fixed.
