# 20ui — setup & usage (app-wide)

20ui is SabNode's standalone design system. It works anywhere in the app — not
just the CRM — because it ships its own self-contained tokens under a neutral
root class, **`.ui20`**.

## 1. Wrap a subtree in `.ui20`

Everything 20ui renders inside an ancestor with the `ui20` class:

```tsx
import { Button, Card, Field, Input } from '@/components/sabcrm/20ui';

export default function Page() {
  return (
    <div className="ui20">
      <Card variant="elevated">
        <Field label="Name" required>
          <Input placeholder="Northwind Trading" />
        </Field>
        <Button variant="primary">Save</Button>
      </Card>
    </div>
  );
}
```

The tokens load automatically: importing anything from `@/components/sabcrm/20ui`
pulls in `src/styles/ui20.css` (the token foundation) once, globally. No provider
to mount, no setup step.

> Put `ui20` high in a route (a layout wrapper, a page root). You only need it
> once per subtree; nested 20ui components inherit it.

## 2. Dark mode

Light is the default. Opt into dark per subtree:

```tsx
<div className="ui20 dark">        {/* explicit dark */}
<div className="ui20" data-theme="dark">  {/* equivalent */}
<div className="ui20">             {/* light, or follows OS when unset */}
```

The CRM keeps its own theming (`.sabcrm-twenty` + `.st-theme-dark`) untouched —
20ui's dark mode is independent.

## 3. Portals just work

`Modal`, `Drawer`, `Toast`, `Menu`, `Tooltip`, `Popover`, `Select`, `Command`
render to `document.body`. Their portal roots carry the `ui20` class themselves,
so tokens resolve even though the portal is outside your `.ui20` subtree. Nothing
to configure.

## 4. What's in the box

Actions: `Button` (primary/secondary/ghost/outline/danger/**gradient** · sm/md/lg
· icon/loading/block), `IconButton`, `ButtonGroup`, `Menu`, `SegmentedControl`,
`Command`.
Inputs: `Field`, `Input`, `Textarea`, `Select`, `MultiSelect`, `Combobox`,
`Switch`, `Checkbox`, `Radio`/`RadioGroup`, `RadioCard`, `Slider`, `OtpInput`,
`SearchInput`, `Rating`, `DatePicker`/`Calendar`, plus react-hook-form wrappers
(`Form`, `FormField`, `FormItem`, `FormLabel`, `FormControl`, `FormMessage`).
Containers: `Card` family, `StatCard`, `MediaCard`, `Accordion`, `Collapsible`,
`Separator`, `Tabs`, `Drawer`, `Popover`.
Data: `Table` primitives + `DataTable`, `Pagination`, `Badge`, `Tag`, `Dot`,
`Avatar`/`AvatarGroup`, `Progress`/`ProgressRing`, `Kbd`, `Breadcrumb`.
Feedback: `Alert`, `Callout`, `EmptyState`, `Toast` (+ `useToast`), `Skeleton`,
`Spinner`, `Tooltip`.
Premium (opt-in, landing-inspired): `GradientText`, `GradientIcon`, `GlassPill`,
`Aurora`, `SpotlightCard`, `FeatureTile`, `GlowBadge`.

Browse them all live at **`/sabcrm/20ui`**.

## 5. Migrating a screen off ZoruUI

20ui mirrors ZoruUI's surface, so adoption is mostly a swap:

| ZoruUI | 20ui |
| --- | --- |
| `Button` | `Button` |
| `Input` / `Textarea` / `Label` | `Field` + `Input` / `Textarea` |
| `Select` | `Select` |
| `Dialog` | `Modal` |
| `Sheet` / `Drawer` | `Drawer` |
| `Popover` | `Popover` |
| `DropdownMenu` | `Menu` |
| `Tooltip` | `Tooltip` |
| `Tabs` | `Tabs` |
| `Accordion` / `Collapsible` | `Accordion` / `Collapsible` |
| `DataTable` | `DataTable` |
| `Badge` / `Avatar` / `Skeleton` | `Badge` / `Avatar` / `Skeleton` |
| `zoruToast` | `useToast` |
| `Command` | `Command` |

Wrap the screen in `.ui20`, swap imports to `@/components/sabcrm/20ui`, adjust
prop names where they differ. The CRM `.sabcrm-twenty` surface is unaffected.

## Design principles

Built to three skills, every component: **emil-design-eng** (transform/opacity
motion, custom ease-out, <250ms, scale-on-press, reduced-motion), **accessibility**
(native elements, one visible focus-visible ring, full ARIA, AA contrast), and
**design-taste** (one accent, one radius system, calm minimal aesthetic, no
em-dashes in visible copy).
