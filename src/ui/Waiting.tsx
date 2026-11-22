import { useEffect, useState } from 'react';

/**
 * A spinner with what's happening and for how long ("Saving… 0s", "Saving… 1s", …), so a slow
 * request visibly isn't frozen. The app gives up after a minute (see client.ts).
 */
export function Waiting({ label }: { label: string }) {
  const [started] = useState(() => Date.now());
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    const tick = setInterval(() => setSeconds(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => clearInterval(tick);
  }, [started]);

  return (
    <span className="inline-flex items-center gap-2">
      <span
        aria-hidden="true"
        className="size-4 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent"
      />
      <span>
        {label}… {seconds}s
      </span>
    </span>
  );
}
