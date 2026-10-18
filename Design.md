Studytimer4you — Design System
A portable design language extracted from the Studytimer4you app. Drop the tokens and patterns below into any new project (Astro, React, plain HTML — it's just CSS + vanilla JS patterns) to get the same look and feel.
1. Design Philosophy
Dark, quiet, editorial. Near-black background, off-white text, almost no saturated color. The one accent color (a muted sage) is used sparingly, only on the primary action.
Monospace-forward. Big numeric/time displays use monospace fonts for that tabular, "terminal-but-elegant" feel. UI chrome (nav, labels, buttons) uses a clean grotesque sans (Inter).
Tight tracking, small text. Letter-spacing is pulled in aggressively on large display text (-0.11em) and UI labels are small (11–13px) with wide uppercase tracking for eyebrows/labels. Contrast between huge, tight display type and tiny, wide meta type is the signature move.
Flat, borderless surfaces. No drop shadows or gradients except a single soft shadow on modals. Structure comes from 1px hairline borders (--line, --line-bright), not elevation.
Restraint in motion. Only subtle transform: translateY(-1px) lifts on hover and 150ms ease transitions. Respects prefers-reduced-motion.
Utilitarian, keyboard-first. Every primary action shows its keyboard shortcut inline as a <kbd>. Focus rings are visible and intentional (outline: 2px solid var(--text)).
2. Color Tokens
:root {
  color-scheme: dark;

  --bg: #050505;              /* page background, near-black */
  --surface: #0b0b0b;         /* raised surfaces, e.g. dialogs */
  --surface-raised: #101010;  /* selected/hover surface state */
  --text: #f3f3ef;            /* primary text, warm off-white */
  --muted: #83837e;           /* secondary text, labels */
  --subtle: #30302d;          /* faint borders/dividers */
  --line: #1c1c1a;            /* default hairline border */
  --line-bright: #31312d;     /* emphasized hairline border (inputs, buttons) */
  --timer: #f7f7f1;           /* large display text, brightest white */
  --accent: #d9e3cb;          /* single accent — muted sage green */
  --accent-ink: #10120e;      /* text-on-accent, near-black */
}
Usage rules:
Backgrounds only ever use --bg, --surface, --surface-raised — never pure black (#000) except in true full-bleed focus/immersive states.
--accent is reserved for the single primary call-to-action per screen. Don't spread it across multiple elements.
Borders always come from --line (default) or --line-bright (hover/active/ interactive elements like inputs and icon buttons).
Text hierarchy: --text for primary, --muted for secondary/labels, and a couple of one-off warm greys (#c7c7c1, #b5b5af, #d2d2cd) for intermediate states — pick from that same warm-grey family rather than introducing new hues.
3. Typography
Font stack
@import url('https://fonts.googleapis.com/css2?family=Azeret+Mono:wght@400;500;600&family=DM+Mono:wght@400;500&family=IBM+Plex+Mono:wght@400;500&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&family=Manrope:wght@400;500;600&family=Space+Mono:wght@400;700&family=Syne:wght@400;500;600&display=swap');

:root {
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  font-synthesis: none;
}
Body/UI font: Inter (400/500/600) — nav, buttons, labels, body copy.
Display font (swappable): a curated set of monospace + geometric-sans fonts used specifically for the big time display, letting the user pick a "personality" for the numbers:
Class
Font
Character
.font-jetbrains
JetBrains Mono
default, neutral coder feel
.font-dm-mono
DM Mono
soft, rounded mono
.font-space-mono
Space Mono
quirky, retro mono
.font-ibm-plex
IBM Plex Mono
technical, precise
.font-azeret
Azeret Mono
modern, tall mono
.font-syne
Syne (sans)
display sans, letter-spacing: -.13em
.font-manrope
Manrope (sans)
geometric sans, letter-spacing: -.12em
This "pick your display typeface" pattern is reusable for any app with a hero numeric/text display — port it wholesale as a nice signature feature.
Type scale & tracking
/* Hero display (timer/clock/stopwatch numbers) */
.display-hero {
  font-size: clamp(3.2rem, 9.6vw, 8.5rem);
  font-weight: 400;
  letter-spacing: -.11em;
  line-height: .8;
  font-variant-numeric: tabular-nums lining-nums;
  white-space: nowrap;
}

/* Immersive/focus-mode hero (even larger) */
.display-hero--focus {
  font-size: clamp(3.85rem, 15vw, 14rem);
}

/* Eyebrow / small label */
.eyebrow, .label {
  font-size: .63rem;
  font-weight: 500;
  letter-spacing: .12em;
  line-height: 1.2;
  text-transform: uppercase;
  color: var(--muted);
}

/* Section sub-heading under an eyebrow */
.utility-header h1 {
  font-size: .8rem;
  font-weight: 400;
  color: #b5b5af;
  margin: .55rem 0 2.8rem;
}

/* Nav links / buttons */
.nav-link, .button {
  font-size: .75rem;
  font-weight: 500;
  letter-spacing: .01em;
}

/* Wordmark / logotype */
.wordmark {
  font-size: 1rem;
  font-weight: 600;
  letter-spacing: -.07em;
}
Principle: the bigger the text, the tighter (more negative) the letter spacing; the smaller the text, the wider (more positive) the letter spacing — and small text goes uppercase + muted color.
4. Layout Shell
A three-zone shell: topbar (nav) → main content (view panels, centered) → optional footer/status.
.app-shell {
  min-height: 100svh;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  padding: 0 clamp(1.25rem, 4vw, 4.5rem);
  overflow: hidden;
}

.topbar {
  min-height: 85px;
  display: grid;
  grid-template-columns: 1fr auto 1fr; /* logo | centered nav | actions */
  align-items: center;
  gap: 2rem;
  border-bottom: 1px solid var(--line);
}

.view-panel { min-height: 0; }

.content-view {
  width: min(100%, 1000px);
  margin: 0 auto; /* or margin: auto for full vertical centering */
  display: flex;
  flex-direction: column;
  align-items: stretch;
  justify-content: center;
}
Content is always capped at 1000px and centered — keeps the design feeling intentional on ultra-wide monitors.
Use clamp() everywhere for fluid spacing/type instead of hard breakpoint jumps; media queries are reserved for structural changes (grid columns, hiding elements), not fine-tuning sizes.
overflow: hidden on the shell + min-height: 0 on grid children prevents scroll janks when swapping panels.
5. Components
Buttons
Two button archetypes — a filled primary pill and a bordered icon square:
.button {
  border: 0;
  border-radius: 3px;
  cursor: pointer;
  font-size: .76rem;
  font-weight: 600;
  letter-spacing: .01em;
  transition: transform 150ms ease, background 150ms ease;
}
.button:hover { transform: translateY(-1px); }

.button-primary {
  display: inline-flex;
  min-width: 11rem;
  min-height: 3.4rem;
  align-items: center;
  justify-content: space-between; /* label left, kbd hint right */
  gap: 2.6rem;
  padding: .85rem 1rem .85rem 1.15rem;
  background: var(--accent);
  color: var(--accent-ink);
}
.button-primary kbd { color: #586052; }
.button-primary.is-paused { background: #e6e6e1; } /* secondary/alt state */

.icon-button {
  display: grid;
  width: 3.4rem;
  height: 3.4rem;
  place-items: center;
  border: 1px solid var(--line-bright);
  border-radius: 3px;
  background: transparent;
  color: #c7c7c1;
  cursor: pointer;
  transition: border-color 150ms ease, color 150ms ease;
}
.icon-button:hover { border-color: #777770; color: var(--text); }
.icon-button svg {
  width: 1rem;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.6;
}
Icons are always inline SVG with stroke: currentColor, never filled — keeps them themeable for free.
Primary actions show their keyboard shortcut as a right-aligned <kbd> inside the button.
Nav links
.nav-link {
  padding: .4rem 0;
  border: 0;
  border-bottom: 1px solid transparent;
  background: transparent;
  color: var(--muted);
  cursor: pointer;
  transition: color 150ms ease, border-color 150ms ease;
}
.nav-link:hover, .nav-link.is-active { color: var(--text); }
.nav-link.is-active { border-color: var(--text); }
Active state = underline + full-brightness text. No pill/background fills.
Secondary "chip" buttons (settings toggle / focus toggle)
.chip-button {
  display: inline-flex;
  align-items: center;
  gap: .5rem;
  border: 1px solid var(--line-bright);
  border-radius: 4px;
  background: transparent;
  color: var(--text);
  cursor: pointer;
  font-size: .72rem;
  font-weight: 500;
  padding: .48rem .7rem;
  transition: border-color 150ms ease, background 150ms ease;
}
.chip-button:hover { border-color: #6d6d67; background: #10100f; }
Modal / Dialog
Use the native <dialog> element — no JS modal library needed.
.dialog {
  width: min(calc(100% - 2rem), 35rem);
  padding: 0;
  border: 1px solid var(--line-bright);
  border-radius: 5px;
  background: var(--surface);
  color: var(--text);
  box-shadow: 0 1.5rem 5rem rgba(0, 0, 0, .55); /* the ONE shadow in the system */
}
.dialog::backdrop { background: rgba(0, 0, 0, .72); }
dialog.showModal();
dialog.close();
dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close(); });
Inputs (underline style, no boxes)
.number-field {
  display: inline-flex;
  align-items: baseline;
  gap: .3rem;
  border-bottom: 1px solid var(--line-bright);
  color: var(--muted);
}
.number-field input {
  width: 2.7rem;
  padding: .2rem 0 .45rem;
  border: 0;
  outline: 0;
  background: transparent;
  color: var(--text);
  font-family: "DM Mono", monospace;
  font-size: 1.2rem;
  font-variant-numeric: tabular-nums;
}
.number-field input::-webkit-inner-spin-button,
.number-field input::-webkit-outer-spin-button { appearance: none; margin: 0; }
Inputs never get a box/border-radius — just a bottom hairline that brightens via --line-bright. Numeric inputs use a mono font.
Selectable option chips (e.g. font picker / radio group)
.option-chip {
  display: grid;
  grid-template-columns: auto auto;
  align-items: center;
  gap: .32rem;
  padding: .27rem .42rem;
  border: 1px solid transparent;
  border-radius: 3px;
  background: transparent;
  color: var(--muted);
  cursor: pointer;
  font-size: .61rem;
  transition: border-color 150ms ease, color 150ms ease, background 150ms ease;
}
.option-chip:hover { color: #d2d2cd; }
.option-chip.is-selected {
  border-color: var(--line-bright);
  background: var(--surface-raised);
  color: var(--text);
}
Dividers
.divider { height: 1px; margin: 1.7rem 0; background: var(--line); }
6. Motion
/* Standard transition timing used everywhere */
transition: <property> 150ms ease;

/* Standard hover lift for buttons */
.button:hover { transform: translateY(-1px); }

/* Always respect reduced motion */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    scroll-behavior: auto !important;
    transition-duration: 0.01ms !important;
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
  }
}
No easing curves beyond ease, no durations beyond 150ms for UI feedback. This keeps the whole interface feeling snappy and utilitarian rather than "designed."
7. Responsive Behavior
Two breakpoints, both collapsing detail rather than restructuring:
@media (max-width: 680px) {
  /* Tighten shell padding, shrink topbar, drop text labels on secondary
     actions (keep icon/kbd only), scale down hero display font-size range */
}

@media (max-width: 380px) {
  /* Collapse "Set time" button to icon-only with a '+' pseudo-element,
     shrink wordmark/nav further, tighten button gaps */
}
Pattern: rather than hiding whole components on mobile, first strip them down (hide the text label inside a button, keep the icon + a shrunk hit area) before ever removing something outright.
8. Reusable Interaction Patterns (from timer.js)
These are UI behavior patterns worth reusing beyond just the CSS:
View-panel switcher — multiple .view-panel[data-view] sections, toggled by hidden + a .is-visible class, driven by nav buttons with data-view-target. Simple, no router needed for single-page tab UIs.
Focus/immersive mode — a single .focus-mode class toggled on the shell root that (a) hides all chrome via CSS, (b) requests element.requestFullscreen(), and (c) listens for fullscreenchange to auto-exit the class if the user leaves fullscreen via Esc/OS gesture.
Keyboard shortcuts guarded by focus state — a keydown listener that bails out if document.activeElement is an input/textarea/contentEditable, so shortcuts (Space, F) never fight with typing.
State persisted to localStorage, restored on load, keyed with a clear prefix (focus-timer-*) to avoid collisions with other apps on the same origin.
Live-updating <time> elements with a datetime attribute kept in sync with the display text, plus aria-live="polite" for screen-reader announcements — accessible by default rather than bolted on.
Selectable "typeface" pattern: a role="radiogroup" of preview chips that swap a class on the target display element and persist the choice.
9. Drop-in Starter (design-tokens.css)
Copy this block into any new project's global stylesheet as the foundation, then layer component classes from Section 5 on top as needed.
@import url('https://fonts.googleapis.com/css2?family=Azeret+Mono:wght@400;500;600&family=DM+Mono:wght@400;500&family=IBM+Plex+Mono:wght@400;500&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&family=Manrope:wght@400;500;600&family=Space+Mono:wght@400;700&family=Syne:wght@400;500;600&display=swap');

:root {
  color-scheme: dark;
  --bg: #050505;
  --surface: #0b0b0b;
  --surface-raised: #101010;
  --text: #f3f3ef;
  --muted: #83837e;
  --subtle: #30302d;
  --line: #1c1c1a;
  --line-bright: #31312d;
  --timer: #f7f7f1;
  --accent: #d9e3cb;
  --accent-ink: #10120e;
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  font-synthesis: none;
}

* { box-sizing: border-box; }
html, body { min-height: 100%; }
body {
  min-width: 320px;
  margin: 0;
  background: var(--bg);
  color: var(--text);
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
}
button, input { font: inherit; }
button { -webkit-tap-highlight-color: transparent; }
button:focus-visible, input:focus-visible, a:focus-visible {
  outline: 2px solid var(--text);
  outline-offset: 4px;
}

.font-jetbrains { font-family: "JetBrains Mono", monospace; }
.font-dm-mono { font-family: "DM Mono", monospace; }
.font-space-mono { font-family: "Space Mono", monospace; }
.font-ibm-plex { font-family: "IBM Plex Mono", monospace; }
.font-azeret { font-family: "Azeret Mono", monospace; }
.font-syne { font-family: Syne, sans-serif; letter-spacing: -.13em; }
.font-manrope { font-family: Manrope, sans-serif; letter-spacing: -.12em; }

.sr-only {
  position: absolute; width: 1px; height: 1px; padding: 0; overflow: hidden;
  clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0;
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    scroll-behavior: auto !important;
    transition-duration: 0.01ms !important;
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
  }
}
10. Checklist for Applying This Theme to a New App
[ ]
Import the same Google Fonts stack (or trim to only the fonts you need).
[ ]
Copy the :root color tokens verbatim — don't introduce new hues.
[ ]
Cap main content width at 1000px, centered.
[ ]
One hero display element gets the tight-tracking large-mono treatment; everything else stays small, uppercase, and muted where it's a label.
[ ]
One accent color, used on exactly one primary action per screen.
[ ]
Borders instead of shadows for structure; the only shadow is on modals.
[ ]
150ms ease transitions, translateY(-1px) hover lift, respect prefers-reduced-motion.
[ ]
Buttons: filled pill for primary + kbd hint, bordered square icon buttons for secondary actions.
[ ]
Native <dialog> for modals.
[ ]
Underline-only inputs, no boxed fields.
[ ]
Keyboard shortcuts on primary actions, guarded against typing contexts