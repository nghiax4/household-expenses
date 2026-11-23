import type { ReactNode } from 'react';

export type Tab = 'expenses' | 'settle';

interface Props {
  current: Tab;
  onChange: (tab: Tab) => void;
}

/**
 * The row of screens fixed at the bottom, like most iPhone apps: always one thumb tap away.
 * It's 4rem tall; App.tsx and ScrollFades leave room for it.
 */
export function TabBar({ current, onChange }: Props) {
  return (
    <nav
      aria-label="Screens"
      className="fixed inset-x-0 bottom-0 z-[5] h-16 border-t border-slate-200 bg-white"
    >
      <div className="mx-auto flex h-full max-w-md">
        <TabButton tab="expenses" label="Expenses" current={current} onChange={onChange}>
          {/* A list */}
          <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
        </TabButton>
        <TabButton tab="settle" label="Settle up" current={current} onChange={onChange}>
          {/* Two arrows, back and forth */}
          <path d="M7 4 3 8l4 4M3 8h18M17 20l4-4-4-4M21 16H3" />
        </TabButton>
      </div>
    </nav>
  );
}

function TabButton({
  tab,
  label,
  current,
  onChange,
  children,
}: Props & { tab: Tab; label: string; children: ReactNode }) {
  const selected = tab === current;
  return (
    <button
      type="button"
      aria-current={selected ? 'page' : undefined}
      onClick={() => onChange(tab)}
      className={`flex flex-1 flex-col items-center justify-center gap-0.5 text-xs ${
        selected ? 'font-semibold text-slate-900' : 'text-slate-500'
      }`}
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="size-6"
        fill="none"
        stroke="currentColor"
        strokeWidth={selected ? 2.25 : 1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {children}
      </svg>
      {label}
    </button>
  );
}
