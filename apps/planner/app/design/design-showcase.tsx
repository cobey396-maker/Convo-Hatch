"use client";

import { Inbox, Plus } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState, type ReactNode } from "react";
import { useTheme } from "@/components/providers";
import { Button } from "@/components/ui/button";
import { Card, ListGroup, ListRow } from "@/components/ui/card";
import { LargeTitlePage } from "@/components/ui/large-title-page";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Sheet } from "@/components/ui/sheet";
import { BlockListSkeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { APP_TABS, TabBar } from "@/components/ui/tab-bar";
import { TaskBlock } from "@/components/ui/task-block";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { fadeUp, spring, stagger, type SpringName } from "@/lib/design/motion";
import { TASK_COLOR_NAMES, TASK_COLORS, type TaskColor } from "@/lib/design/tokens";
import type { ThemePreference } from "@/lib/theme";

/**
 * A living style guide: every token and component from Phase 1 on one page.
 * Open it in light and dark mode, turn on Reduce Motion in your OS, and
 * resize the window to check mobile layout. Later phases build real screens
 * out of exactly these pieces.
 */

const SEMANTIC = [
  ["bg", "Page"],
  ["surface", "Surface"],
  ["surface-elevated", "Elevated"],
  ["fill", "Fill"],
  ["label", "Label"],
  ["secondary-label", "Secondary"],
  ["tertiary-label", "Tertiary"],
  ["tint", "Tint"],
  ["success", "Success"],
  ["warning", "Warning"],
  ["danger", "Danger"],
] as const;

const TYPE_SCALE = [
  ["text-large-title", "Large Title", "34"],
  ["text-title1", "Title 1", "28"],
  ["text-title2", "Title 2", "22"],
  ["text-title3", "Title 3", "20"],
  ["text-headline", "Headline", "17 · semibold"],
  ["text-body", "Body", "17"],
  ["text-callout", "Callout", "16"],
  ["text-subhead", "Subhead", "15"],
  ["text-footnote", "Footnote", "13"],
  ["text-caption", "Caption", "12"],
] as const;

type DemoBlock = { id: string; title: string; time: string; color: TaskColor; kind: "task" | "event" };

const INITIAL_BLOCKS: DemoBlock[] = [
  { id: "1", title: "AP Chem", time: "9:00 – 10:15 AM", color: "blue", kind: "event" },
  { id: "2", title: "History essay · part 1", time: "10:30 – 11:30 AM", color: "orange", kind: "task" },
  { id: "3", title: "Shift at Juice Bar", time: "4:00 – 8:00 PM", color: "green", kind: "event" },
  { id: "4", title: "Calc problem set", time: "8:30 – 9:15 PM", color: "purple", kind: "task" },
];

export function DesignShowcase() {
  const { preference, setPreference } = useTheme();
  const [blocks, setBlocks] = useState(INITIAL_BLOCKS);
  const [done, setDone] = useState<Set<string>>(new Set(["1"]));
  const [stateDemo, setStateDemo] = useState<"loading" | "empty" | "error">("loading");
  const [tab, setTab] = useState(APP_TABS[0].href);

  const shuffle = () => setBlocks((b) => [...b].sort(() => Math.random() - 0.5));
  const toggleDone = (id: string) =>
    setDone((d) => {
      const next = new Set(d);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <LargeTitlePage
      leading={<ThemeToggle className="-ml-3" />}
      title="Design System"
      subtitle="Tokens and components for every screen. Scroll to see the title shrink."
      trailing={
        <Sheet
          title="New task"
          description="The Add Task sheet arrives in Phase 5."
          trigger={
            <Button variant="plain" size="sm" aria-label="Open example sheet">
              <Plus size={22} />
            </Button>
          }
        >
          <SheetDemoBody />
        </Sheet>
      }
    >
      <motion.div variants={stagger} initial="initial" animate="animate" className="flex flex-col gap-8">
        <Section title="Appearance">
          <SegmentedControl<ThemePreference>
            label="Theme"
            value={preference}
            onChange={setPreference}
            options={[
              { value: "system", label: "System" },
              { value: "light", label: "Light" },
              { value: "dark", label: "Dark" },
            ]}
          />
        </Section>

        <Section title="Semantic colors" note="Components only use these names, so dark mode is automatic.">
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
            {SEMANTIC.map(([token, name]) => (
              <div key={token} className="flex flex-col gap-1.5">
                <div
                  className="h-12 rounded-xl border border-separator"
                  style={{ background: `var(--${token})` }}
                />
                <span className="text-caption text-secondary-label">{name}</span>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Task colors" note="Users color-code tasks. Each has a light and a dark shade.">
          <div className="grid grid-cols-3 gap-3">
            {TASK_COLOR_NAMES.map((c) => (
              <div
                key={c}
                className="task-block rounded-block px-3 py-2.5 text-subhead font-medium"
                style={{ "--block": `var(--task-${c})` } as React.CSSProperties}
              >
                {TASK_COLORS[c].label}
              </div>
            ))}
          </div>
        </Section>

        <Section title="Type scale" note="Modeled on iOS Dynamic Type.">
          <Card className="flex flex-col gap-2">
            {TYPE_SCALE.map(([cls, name, size]) => (
              <div key={cls} className="flex items-baseline justify-between gap-4">
                <span className={cls}>{name}</span>
                <span className="shrink-0 text-caption text-tertiary-label">{size.replace(/^(\d+)/, "$1px")}</span>
              </div>
            ))}
          </Card>
        </Section>

        <Section title="Radius & elevation">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ["rounded-button", "Button 14"],
              ["rounded-block", "Block 16"],
              ["rounded-card", "Card 20"],
              ["rounded-sheet", "Sheet 24"],
            ].map(([r, label]) => (
              <div key={r} className={`${r} grid h-20 place-items-center bg-surface text-footnote shadow-card`}>
                {label}
              </div>
            ))}
          </div>
        </Section>

        <Section title="Buttons" note="Every button squishes on a spring when pressed.">
          <div className="flex flex-wrap gap-3">
            <Button>Plan my week</Button>
            <Button variant="tinted">Add task</Button>
            <Button variant="plain">Skip</Button>
            <Button variant="danger">Delete</Button>
            <Button disabled>Disabled</Button>
          </div>
          <Button size="lg" className="mt-3">
            Full-width primary
          </Button>
        </Section>

        <Section
          title="Schedule blocks"
          note="Tap a block to toggle complete. Shuffle shows the spring reflow used for drag-to-reschedule."
        >
          <div className="flex flex-col gap-2.5">
            {blocks.map((b) => (
              <TaskBlock
                key={b.id}
                title={b.title}
                timeLabel={b.time}
                color={b.color}
                kind={b.kind}
                completed={done.has(b.id)}
                onClick={() => toggleDone(b.id)}
              />
            ))}
          </div>
          <Button variant="tinted" size="sm" className="mt-3" onClick={shuffle}>
            Shuffle
          </Button>
        </Section>

        <Section title="Grouped list">
          <ListGroup header="Account" footer="Settings and profile use this layout.">
            <ListRow title="Notifications" detail="15 min before each block" trailing={<Chevron />} />
            <ListRow title="Time zone" detail="America/Chicago" trailing={<Chevron />} />
            <ListRow title="Week starts on" trailing={<span className="text-secondary-label">Monday</span>} />
          </ListGroup>
        </Section>

        <Section title="Loading, empty, error" note="Every screen has all three.">
          <SegmentedControl
            label="State"
            value={stateDemo}
            onChange={setStateDemo}
            options={[
              { value: "loading", label: "Loading" },
              { value: "empty", label: "Empty" },
              { value: "error", label: "Error" },
            ]}
          />
          <Card className="mt-3 min-h-64">
            <AnimatePresence mode="wait">
              <motion.div key={stateDemo} variants={fadeUp} initial="initial" animate="animate" exit="exit">
                {stateDemo === "loading" && <BlockListSkeleton />}
                {stateDemo === "empty" && (
                  <EmptyState
                    icon={<Inbox className="text-secondary-label" />}
                    title="Nothing planned yet"
                    message="Add a task and we'll find the perfect time for it."
                    action={<Button>Add a task</Button>}
                  />
                )}
                {stateDemo === "error" && <ErrorState onRetry={() => setStateDemo("loading")} />}
              </motion.div>
            </AnimatePresence>
          </Card>
        </Section>

        <Section title="Springs" note="Tap a ball. Each uses a preset from lib/design/motion.ts.">
          <SpringDemo />
        </Section>

        <Section title="Tab bar" note="Frosted glass; content behind it is blurred.">
          <div className="overflow-hidden rounded-card bg-[linear-gradient(135deg,var(--task-pink),var(--task-indigo))] pt-16 shadow-card">
            <TabBar fixed={false} activeHref={tab} onSelect={setTab} />
          </div>
        </Section>
      </motion.div>
    </LargeTitlePage>
  );
}

function Section({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <motion.section variants={fadeUp}>
      <h2 className="text-title3">{title}</h2>
      {note && <p className="mb-3 mt-0.5 text-subhead text-secondary-label">{note}</p>}
      {!note && <div className="mb-3" />}
      {children}
    </motion.section>
  );
}

function Chevron() {
  return <span aria-hidden className="text-tertiary-label">›</span>;
}

function SheetDemoBody() {
  return (
    <div className="flex flex-col gap-3 pt-2">
      <input
        aria-label="Describe your task"
        placeholder="essay due fri ~3hrs, gym MWF 6pm"
        className="h-11 w-full rounded-xl bg-fill px-4 text-body outline-none placeholder:text-tertiary-label focus:ring-2 focus:ring-tint"
      />
      <p className="text-footnote text-secondary-label">
        Drag the handle down, flick it, tap outside, or press Escape to dismiss.
      </p>
      <Button size="lg">Plan it</Button>
    </div>
  );
}

function SpringDemo() {
  const names = Object.keys(spring) as SpringName[];
  const [moved, setMoved] = useState<Record<string, boolean>>({});
  return (
    <Card className="flex flex-col gap-3">
      {names.map((name) => (
        <button
          key={name}
          type="button"
          onClick={() => setMoved((m) => ({ ...m, [name]: !m[name] }))}
          className="flex items-center gap-3 text-left"
        >
          <span className="w-16 shrink-0 text-footnote text-secondary-label">{name}</span>
          {/* The ball jumps between flex-start and flex-end; `layout` makes
              Motion animate that jump as a transform, using this spring. */}
          <span className={`flex h-8 flex-1 rounded-full bg-fill ${moved[name] ? "justify-end" : "justify-start"}`}>
            <motion.span layout transition={spring[name]} className="size-8 rounded-full bg-tint shadow-card" />
          </span>
        </button>
      ))}
    </Card>
  );
}
