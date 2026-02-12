1. UI / UX Discipline
DO
Calm, CFO-grade UI
Tables first, charts second
One single Primary color, rest status-only colors
Tooltips for complexity

NEVER
Gradient-heavy dashboards
KPI clutter
“AI-looking” widgets
box inside a box tyle UI
If it looks impressive before it looks clear, it’s wrong.

1. Execution Discipline
A task is not complete unless:
Accrual and cash both tested
FX edge cases tested
GST scenarios tested
No warnings, no assumptions
2. Final Enforcement Rule

When in doubt:
Re-read [rules.md](http://rules.md/)
Ask any doubt in form of questions before writing code
Clarify your execution plan before writing code.

Consistency is not optional.
Correctness is not negotiable.

## 2. Design and Development Guidelines

---

1. Design Philosophy (Non-Negotiable)
This UI must feel:
Calm
Trustworthy
Operational
If it feels like software you run your business on daily, it is correct.
2. Font System (Locked)
2.1 Primary Font
SF Sans Pro (SF Pro / SF Pro Display / SF Pro Text)
This is the only font family allowed.

Fallback stack (for non-Apple environments only):
SF Pro Text, SF Pro Display, -apple-system, BlinkMacSystemFont, system-ui, sans-serif

2.2 Font Usage Rules
Numbers must use tabular numerals
Do not mix display and text variants randomly
Use consistent weights across the app

2.3 Type Scale
Usage	Size	Weight
Page Title	20–24px	600
Section Header	14–16px	600
Primary Metric	20–24px	600
Body Text	13–14px	400–500
Meta / Helper	11–12px	400

No decorative typography. Ever.

1. Color System (Explicit & Locked)

All colors below are derived from the screenshot and normalized for system use.

3.1 Neutral Palette (Primary)
Token	Color	Usage
--bg-app	#F9FAFB	App background
--bg-surface	#FFFFFF	Cards, tables
--bg-subtle	#F3F4F6	Secondary sections
--border-default	#E5E7EB	Borders, dividers
--text-primary	#111827	Main text
--text-secondary	#6B7280	Labels, meta
--text-muted	#9CA3AF	Disabled, hints

Never use pure black or pure white outside these tokens.

3.2 Brand / Action Colors
Primary Green (from screenshot)
Token	Color	Usage
--primary	#22C55E	Primary CTAs, highlights
--primary-dark	#16A34A	Hover / active
--primary-soft	#DCFCE7	Subtle backgrounds

Used sparingly. Never for body text.

3.3 Status Colors
Status	Color	Token
Success	#16A34A	--success
Warning	#F59E0B	--warning
Danger	#DC2626	--danger
Info	#2563EB	--info

Rules:
Status colors are signals, not decoration
Always pair with text or icons
Never rely on color alone for meaning

1. Layout Rules
4.1 App Structure
Fixed left sidebar
Single main content column
No multi-column chaos

4.2 Width Constraints
Max content width: 1280px
Tables and dense data should feel contained
Center content on wide screens

4.3 Grid
Base grid: 8px
All spacing must be divisible by 8
No arbitrary values like 13px or 19px

1. Spacing Rules
Vertical Spacing
Context	Spacing
Section → Section	32–40px
Card → Card	16–24px
Inside Card	16–20px
Horizontal Spacing
Context	Spacing
Icon ↔ Text	8px
Inline elements	8–12px
Control groups	12–16px

Whitespace is intentional, not wasted.

1. Backgrounds, Surfaces & Elevation
6.1 Surface Rules
Cards: --bg-surface
Sub-panels: --bg-subtle
Borders: --border-default

6.2 Elevation
No dramatic shadows
No neumorphism
No glassmorphism

Elevation separates, it does not decorate.

1. Buttons & Actions
7.1 Button Hierarchy
Primary
Background: --primary
Text: white

Secondary
Border: --border-default
Text: --text-primary
No fill or very subtle fill

Tertiary
Text-only
Used for low-priority actions

7.2 Button Rules
Min-Max height: 40-48px
Clear, literal labels
Disabled state must be visibly disabled
No competing primary actions

1. Forms & Inputs
8.1 Input Styling
Height: 40–48px
Background: --bg-surface
Border: --border-default
Border radius: subtle (6–8px)

8.2 Labels & Help
Labels always visible above inputs
Placeholders are hints, not labels
Errors are inline and calm
Never shout at the user.

1. Tables (Critical)
9.1 Table Design
Header background: --bg-subtle
Borders: --border-default
Sticky headers for long lists

9.2 Alignment
Numbers: left-aligned / right-aligned depending on the table design / view
Text: left-aligned
Actions: rightmost column

9.3 Density
Row height: 44–48px
Dense mode optional, never default

1. Charts & Graphs
10.1 Chart Purpose
Charts show:
Trends
Direction
Comparison
Tables show precision.

10.2 Chart Styling
Lines: thin, clean

Colors:
Primary data: --primary
Secondary data: muted neutral
Axes and gridlines: subtle gray

10.3 Rules
Max 2–3 datasets per chart
Always show tooltip on hover
Never use rainbow palettes

1. Icons
Line-based icons only
Neutral stroke color
Icons support text, never replace it
No decorative icons.
2. States & Feedback
Always design for:
Empty state
Loading state
Error state
Partial data state

Feedback must be:
Immediate
Clear
Calm

1. Navigation
Left sidebar only
Clear active state using --primary-soft
No more than 2 navigation levels
User must never feel lost.
2. LLM-Specific Design Rules
For any LLM-based development:

DO
Use the exact color tokens
Use SF Pro only
Reuse components
Keep UI consistent

NEVER
Invent new colors
Add gradients except charts or graphs (only if required)
Add animations “for delight”
Drift from spacing rules

If unsure:
→ Stop
→ Ask
→ Do not invent

---

## 10. File & Code Discipline

1. **Naming**
    - Screens & components: `PascalCase`
    - Utilities: `camelCase`
2. **Component responsibility**
    - One file, one responsibility.
    - If a file grows too large, split it.
3. **Styling**
    - Use theme overrides and tokens.
    - No visual logic scattered across components.