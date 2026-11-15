# EventCheck Sunset Design System

**Status:** Proposed for Team Review
**Scope:** Shared frontend visual language for F-01 through F-04

## Visual identity

EventCheck Sunset is modern, warm, welcoming, energetic, and restrained. Warm
cream and white are the primary surfaces; brick red, coral, and orange provide
focused emphasis for actions, identity, and event energy. Decoration supports
orientation and hierarchy rather than competing with the task.

## Color palette and tokens

| Token | Value | Use |
| --- | --- | --- |
| Primary | `#B9382F` | Primary actions and important emphasis |
| Primary Hover | `#922A24` | Hover/focus action state |
| Secondary | `#EA684C` | Supporting accents and success-oriented surfaces |
| Accent | `#F59E52` | Focus rings and highlights |
| Soft Background | `#FFE2CF` | Chips, soft panels, secondary controls |
| Page Background | `#FFF8F3` | Main application background |
| Card Background | `#FFFFFF` | Forms and elevated surfaces |
| Text Primary | `#292524` | Body and heading text |

Semantic CSS variables include `--color-primary`, `--color-primary-hover`,
`--color-secondary`, `--color-accent`, `--color-background`,
`--color-surface`, `--color-text`, `--color-muted`, `--color-border`, and
`--color-focus`. Error and success states must add a text/icon cue and never
rely on color alone.

## Type, spacing, and surfaces

- Use DM Sans for interface text and Playfair Display sparingly for expressive
  event/brand emphasis; provide system fallbacks.
- Use a 4px base spacing rhythm, with 12px controls, 20–32px cards, and ample
  page whitespace.
- Controls use 12px rounding; cards use 20–28px rounding; pill chips use full
  rounding.
- Use soft, warm shadows only for hierarchy. Avoid hard borders and excessive
  gradients.
- Responsive breakpoints are approximately 800px (stacked mobile/tablet) and
  1200px (wide layout refinement); verify 375px, 768px, and 1440px widths.

## Components and states

- Primary buttons use brick red; secondary buttons use the peach surface.
  Hover, disabled, focus, and loading states must be visibly distinct.
- Inputs have explicit labels, comfortable touch targets, visible focus rings,
  and inline validation text linked to the relevant control.
- Cards group one task or status. Navigation remains simple and role-aware;
  backend authorization remains authoritative.
- Loading, empty, success, warning, error, and expired-session states use
  concise text, appropriate icons where useful, and `aria-live` announcements.

## Accessibility and consistency

Maintain WCAG 2.1 AA contrast targets, keyboard operation, visible focus,
reduced-motion support, and readable text sizing. F-01 authentication must not
expose session identifiers or private data. F-02, F-03, and F-04 should reuse
these tokens and patterns without changing their requirements, permissions,
API contracts, or security boundaries.
