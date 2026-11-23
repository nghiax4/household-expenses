import type { ReactNode } from 'react';
import { ScrollFades } from './ScrollFades';

interface Props {
  /** The id of the dialog's title, which names it for screen readers. */
  titleId: string;
  children: ReactNode;
}

/** A box over a dimmed screen: at the bottom on a phone, where the thumb is; centered on a laptop. */
export function Dialog({ titleId, children }: Props) {
  return (
    <div className="fixed inset-0 z-10 flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="max-h-full w-full max-w-md overflow-y-auto rounded-2xl bg-white"
      >
        {/* With a long list the box scrolls inside itself; the fades show there's more. */}
        <ScrollFades edges="box">
          <div className="flex flex-col gap-4 p-5">{children}</div>
        </ScrollFades>
      </div>
    </div>
  );
}
