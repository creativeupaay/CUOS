# Design Guidelines for Dashboard Revamp

This is the core design principles which strictly needs to be followed within this platform development:

## Typography

**Font Stack:**
- Primary: Poppins 
- All text uses the same font family—no mixing

**Hierarchy:**
- **Large numbers (metrics):** 32px, font-weight 700 (bold)
- **Page headings:** 28px, font-weight 700
- **Section titles:** 20px, font-weight 600 (semi-bold)
- **Body text/labels:** 16px, font-weight 400-500 (regular to medium)
- **Small labels/metadata:** 12px, font-weight 400-500
- **Tiny text (chart labels):** 10px, font-weight 400

**Key principle:** High contrast in size between data and labels. Numbers dominate, labels recede.

## Spacing

**Consistent Scale (use 8px base unit):**
- Tight spacing: 8px (between related items)
- Standard spacing: 16px (within cards)
- Medium spacing: 24px (between card sections)
- Large spacing: 32px (between major sections)
- Extra large: 40px (between dashboard sections)

**Card padding:** 20-24px all around

**List item height:** 48-56px for comfortable touch/click targets

## Border Radius

**Tiered approach:**
- Small elements (badges, small buttons): 6-8px
- Medium elements (buttons, input fields): 8-10px
- Cards and containers: 12-16px
- Large containers: 16-20px
- Profile pictures: 50% (full circle)

**Consistency is key:** Pick 2-3 values and use them consistently.

## Buttons

**Primary button:**
- Height: 40px
- Padding: 16px 32px
- Font: 14px, font-weight 500
- Border radius: 12px
- Include icon when helpful (with 6-8px gap from text)

**Secondary button (outlined):**
- Same dimensions
- 1px border
- Transparent background

**Tertiary button (Small Button):**
- Height: 32px
- Padding: 16px 32px
- Font: 12px, font-weight 500
- Border radius: 12px
- Include icon when helpful (with 6-8px gap from text)

**Text-only button:**
- No background, no border
- Colored text with hover state

## Cards & Containers

**Elevation:**
- No Shadows at all
- Avoid multi-layered box in box structure

**White space:**
- Don't cram content
- Let elements breathe with generous padding
- Dont add too much of white space, it should be subtle, professional and only where it is required to be

**Backgrounds:**
- Pure white cards on light gray background (#FAFAFA, #F7F7F7)
- Creates subtle depth without heavy shadows

## Icons

**Style:**
- Outlined/line icons (not filled solid icons)
- Stroke width: 1px
- Size: 20-24px for navigation, 16-20px inline with text

**Consistency:**
- All icons from same set
- Same stroke weight throughout

## Data Visualization (only where required)

**Chart style:**
- Clean, minimal gridlines (or none)
- Thin lines (2-3px)
- Smooth curves preferred over sharp angles
- Axis labels at 10px
- Use area fills with low opacity (10-20%) under line charts

**Small sparklines:**
- 40-60px tall
- No axes, no labels—just the shape
- Very subtle, almost decorative

## Layout Grid

**Sidebar:**
- Fixed width: 220-260px
- Icons: 20px with 12-16px gap to text
- Item height: 40px

**Main content:**
- Max-width: 1440px
- Cards in responsive grid (2-5 columns depending on content)
- Consistent gutters (20-24px)

**Stat cards at top:**
- Equal width in grid
- Metric number prominent
- Percentage change with tiny arrow icon
- Mini chart for context

## Micro-interactions

**Hover states:**
- Slight background color change
- Smooth transitions (150-200ms)

**Active states:**
- Slightly darker/more saturated than hover

## Tables & Lists

**Row height:** 56px for comfort

**Borders:**
- Avoid heavy borders
- Use subtle dividers (1px, #b3b3b3ff or similar)
- Often just bottom border per row

**Avatars in lists:**
- 32px diameter
- 4px gap from text

**Status badges:**
- Pill shape (full border-radius)
- 6-8px vertical padding, 12-16px horizontal
- Soft, muted background colors
- 10-12px text

## Overall Principles

1. **Restraint:** Don't over-design. Let data and content be the hero
2. **Consistency:** Reuse patterns. If one card has a certain padding, all cards should
3. **Alignment:** Everything snaps to grid. No arbitrary positioning
4. **Hierarchy:** Size, weight, and color create clear visual priority
5. **Whitespace:** More generous than you think. Cramped designs look outdated and overly spaced designs doesnt look real and professional, so balance out the white space.
