import type { Template } from '../domain/template';
import { tagColors } from './tagColors';

/** A tag as shown on an expense card. */
export function TagPill({ tag, templates }: { tag: string; templates: readonly Template[] }) {
  return (
    <span
      className={`inline-flex h-6 items-center rounded-full px-2.5 text-xs font-medium ${tagColors(tag, templates)}`}
    >
      {tag}
    </span>
  );
}
