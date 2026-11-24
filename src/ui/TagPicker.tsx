import { useState, type KeyboardEvent } from 'react';
import { normalizeTags, sameTag } from '../domain/tags';
import type { Template } from '../domain/template';
import { tagColors } from './tagColors';

interface Props {
  /** Tags to offer: the bills first, then the ones in use, most used first. */
  suggestions: readonly string[];
  selected: readonly string[];
  templates: readonly Template[];
  onChange: (tags: string[]) => void;
}

/** Tap a tag to add or remove it, or type a new one. */
export function TagPicker({ suggestions, selected, templates, onChange }: Props) {
  const [newTag, setNewTag] = useState('');
  const [error, setError] = useState<string | null>(null);
  const isSelected = (tag: string) => selected.some((s) => sameTag(s, tag));
  // A tag picked earlier but not among the suggestions (say, just typed) still shows, so it
  // can be removed again.
  const shown = [
    ...suggestions,
    ...selected.filter((s) => !suggestions.some((t) => sameTag(t, s))),
  ];

  function toggle(tag: string) {
    onChange(isSelected(tag) ? selected.filter((s) => !sameTag(s, tag)) : [...selected, tag]);
  }

  function addTyped() {
    // Typing an existing tag in another case picks the existing one.
    const typed = shown.find((tag) => sameTag(tag, newTag.trim())) ?? newTag;
    const tags = normalizeTags([...selected, typed]);
    if (!tags.ok) {
      setError(tags.error);
      return;
    }
    setError(null);
    setNewTag('');
    onChange(tags.value);
  }

  function handleKey(event: KeyboardEvent<HTMLInputElement>) {
    // Enter adds the tag rather than submitting the whole form.
    if (event.key === 'Enter') {
      event.preventDefault();
      addTyped();
    }
  }

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 font-medium">
        Tags <span className="font-normal text-slate-500">(optional)</span>
      </legend>
      {shown.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {shown.map((tag) => {
            const on = isSelected(tag);
            return (
              <button
                key={tag}
                type="button"
                aria-pressed={on}
                onClick={() => toggle(tag)}
                className={`h-9 rounded-full px-3 text-sm font-medium ${
                  on
                    ? `${tagColors(tag, templates)} ring-2 ring-slate-900 ring-offset-1`
                    : 'border border-dashed border-slate-400 text-slate-700'
                }`}
              >
                {on ? `✓ ${tag}` : tag}
              </button>
            );
          })}
        </div>
      )}
      <div className="flex gap-2">
        <input
          type="text"
          aria-label="New tag"
          placeholder="New tag"
          autoComplete="off"
          value={newTag}
          onChange={(event) => setNewTag(event.target.value)}
          onKeyDown={handleKey}
          className="h-12 min-w-0 flex-1 rounded-lg border border-slate-300 px-3 text-base"
        />
        <button
          type="button"
          onClick={addTyped}
          disabled={newTag.trim() === ''}
          className="h-12 rounded-lg border border-slate-300 px-4 font-medium disabled:opacity-50"
        >
          Add tag
        </button>
      </div>
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
    </fieldset>
  );
}
