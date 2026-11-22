import type { ReactNode } from 'react';

interface ChoiceProps {
  selected: boolean;
  onClick: () => void;
  children: ReactNode;
}

/** A pill that's dark when picked. Used for one-of-many and many-of-many choices alike. */
export function Choice({ selected, onClick, children }: ChoiceProps) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`h-10 rounded-full border px-4 ${
        selected ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-300 bg-white'
      }`}
    >
      {children}
    </button>
  );
}
