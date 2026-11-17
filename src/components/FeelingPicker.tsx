import { FEELINGS } from '../domain/feelings';

/** Escolha de sentimentos (vários, ou um só com `single`). */
export function FeelingPicker({ value, onChange, single = false }: { value: string[]; onChange: (v: string[]) => void; single?: boolean }) {
  return (
    <div className="feelings">
      {FEELINGS.map((f) => {
        const on = value.includes(f.emoji);
        return (
          <button
            key={f.emoji}
            type="button"
            className={`feeling${on ? ' on' : ''}`}
            title={f.label}
            aria-pressed={on}
            onClick={() => onChange(on ? value.filter((x) => x !== f.emoji) : single ? [f.emoji] : [...value, f.emoji])}
          >
            <span className="fe">{f.emoji}</span>
            <span className="fl">{f.label}</span>
          </button>
        );
      })}
    </div>
  );
}
