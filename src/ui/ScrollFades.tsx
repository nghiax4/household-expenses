import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';

interface Props {
  /**
   * "screen": the content scrolls with the page, so the fades sit at the edges of the screen.
   * "box": the content is inside its own scrolling box, so the fades sit at the box's edges.
   */
  edges: 'screen' | 'box';
  children: ReactNode;
}

/**
 * Fades the top or bottom edge while there's more to scroll that way. iPhone Safari only shows
 * its scrollbar during a scroll and doesn't let pages restyle it, so this is the visible cue.
 * An invisible marker at each end of the content says when that end is out of view.
 */
export function ScrollFades({ edges, children }: Props) {
  const top = useRef<HTMLDivElement>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const moreAbove = useIsOutOfView(top);
  const moreBelow = useIsOutOfView(bottom);
  // A gray shadow rather than a white fade: white on a white page barely shows. Above the
  // content (z-1), below dialogs (z-10); they never catch taps.
  const fade = 'pointer-events-none z-[1] h-12 from-slate-900/25 to-transparent transition-opacity';
  const position =
    edges === 'screen'
      ? { top: 'fixed inset-x-0 top-0', bottom: 'fixed inset-x-0 bottom-0' }
      : // Sticky inside the box; the negative margins keep them from taking up space.
        { top: 'sticky top-0 -mb-12', bottom: 'sticky bottom-0 -mt-12' };

  return (
    <>
      <div
        aria-hidden="true"
        data-testid="fade-top"
        className={`${fade} ${position.top} bg-linear-to-b ${moreAbove ? 'opacity-100' : 'opacity-0'}`}
      />
      <div ref={top} aria-hidden="true" className="h-px" />
      {children}
      <div ref={bottom} aria-hidden="true" className="h-px" />
      <div
        aria-hidden="true"
        data-testid="fade-bottom"
        className={`${fade} ${position.bottom} bg-linear-to-t ${moreBelow ? 'opacity-100' : 'opacity-0'}`}
      />
    </>
  );
}

/** True while the element is scrolled out of sight (its scrolling box's edges count). */
function useIsOutOfView(ref: RefObject<HTMLElement | null>): boolean {
  const [outOfView, setOutOfView] = useState(false);
  useEffect(() => {
    const element = ref.current;
    if (!element) {
      return;
    }
    const observer = new IntersectionObserver(([entry]) => {
      setOutOfView(entry ? !entry.isIntersecting : false);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);
  return outOfView;
}
