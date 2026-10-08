# Product

## Register

product

## Users

Property managers for a small portfolio of vacation rentals (Wavesong, Red, Lake Breeze, Nautical Nest). They're the people who reset door codes, send welcome letters and review requests, and keep each stay running smoothly.

They use it in two places:

- **A wall-mounted touchscreen TV in the kitchen**, rotated to portrait (1080×1920 viewport at 1× scale, Chromium kiosk on a Raspberry Pi). It's glanced at in passing from across the room and tapped up close.
- **Their phones**, for the same information on the go.

The job: know at a glance who's arriving and leaving across all properties, and what has to be done today and soon. Then act on it (finish or dismiss a task) without opening Todoist.

## Product Purpose

Pulls reservations from each property's iCal feed into a single calendar, and automatically creates the matching Todoist to-dos (welcome letter and door code 3 days before arrival, review request 2 days after departure). Success means nothing slips: every guest gets their letter and a working code on time, and the screen makes it obvious what's next.

## Brand Personality

Calm, warm, modern. It lives in a home kitchen, not an office, so it should feel like a well-made household object, more like a premium smart display than a business tool. It's quietly confident, and the property colors give it character. At night it switches to a dim dark theme so a bright panel doesn't light up the room.

## Anti-references

- **Generic SaaS admin**: gray sidebars, KPI stat cards, dense corporate tables, the "hero metric" layout.
- **Google Calendar clone**: thin, tiny event pills and cramped month grids that can't be read from across a room.
- Also avoid kitschy cabin/beach decor and script fonts. Modern, not themed.

## Design Principles

1. **Legible across the room.** Type size, contrast, and color coding are tuned for a TV seen from several metres away; the phone layout is the same information re-flowed, not shrunk.
2. **Now first.** Today and the next few days get the most visual weight; the rest of the month is context.
3. **Color means property.** Each property's color is the one consistent signal across calendar and tasks, so nothing else competes with it.
4. **Touch is a first-class input.** Every interactive element is a generous tap target; there's no hover-only information.
5. **Calm by default.** Motion and emphasis are reserved for things that need attention (overdue or due-today work).

## Accessibility & Inclusion

- WCAG 2.2 AA contrast in both light and dark themes, including text set on property colors.
- Property identity never relies on color alone: names or labels go alongside color swatches (red/green confusion is likely between the "Red" and "Lake Breeze" properties).
- Tap targets ≥ 44×44 px (larger on the TV).
- Respect `prefers-reduced-motion`.
