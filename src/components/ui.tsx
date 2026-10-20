import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Book } from '../db';
import { useMediaUrl } from '../services/media';

// ---------- Ícones (traço fino) ----------
const P = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;
export const Icon = {
  shelf: () => <svg viewBox="0 0 24 24" {...P}><path d="M4 4h3v16H4zM9 4h3v16H9zM14.5 4.5l3-.8 3.8 15.5-3 .8z" /></svg>,
  add: () => <svg viewBox="0 0 24 24" {...P}><path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2M7 8v8M10 8v8M13 8v8M17 8v8" /></svg>,
  stats: () => <svg viewBox="0 0 24 24" {...P}><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></svg>,
  glossary: () => <svg viewBox="0 0 24 24" {...P}><path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2zM4 21V5M8 7h7M8 11h5" /></svg>,
  settings: () => <svg viewBox="0 0 24 24" {...P}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></svg>,
  search: () => <svg viewBox="0 0 24 24" width="22" height="22" {...P}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>,
  grid: () => <svg viewBox="0 0 24 24" width="22" height="22" {...P}><rect x="3" y="3" width="7" height="9" rx="1" /><rect x="14" y="3" width="7" height="9" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></svg>,
  list: () => <svg viewBox="0 0 24 24" width="22" height="22" {...P}><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" /></svg>,
  heart: (filled?: boolean) => <svg viewBox="0 0 24 24" width="22" height="22" {...P} fill={filled ? 'currentColor' : 'none'}><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 0 0 0-7.8z" /></svg>,
};

export const Logo = () => (
  <svg viewBox="0 0 32 32" width="26" height="26" aria-hidden>
    <path d="M16 8c-3-2.5-7-3-11-2v19c4-1 8-.5 11 2 3-2.5 7-3 11-2V6c-4-1-8-.5-11 2z" fill="#fff" opacity=".95" />
    <path d="M16 8v19" stroke="#b3263e" strokeWidth="1.6" />
    <path d="M16 13.5c-1.6-1.7-4.2-1.2-4.2 1 0 2 4.2 4.5 4.2 4.5s4.2-2.5 4.2-4.5c0-2.2-2.6-2.7-4.2-1z" fill="#b3263e" />
  </svg>
);

// ---------- Toast ----------
const ToastCtx = createContext<(msg: string) => void>(() => {});
export const useToast = () => useContext(ToastCtx);
export function ToastProvider({ children }: { children: ReactNode }) {
  const [msg, setMsg] = useState<string | null>(null);
  const timer = useRef<number>(undefined);
  const show = useCallback((m: string) => {
    setMsg(m);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setMsg(null), 2800);
  }, []);
  return (
    <ToastCtx.Provider value={show}>
      {children}
      {msg && <div className="toast" role="status">{msg}</div>}
    </ToastCtx.Provider>
  );
}

// ---------- Cabeçalho de página ----------
export function PageTitle({ children, back, right }: { children: ReactNode; back?: boolean; right?: ReactNode }) {
  const nav = useNavigate();
  return (
    <div className="row nowrap between" style={{ marginBottom: 12 }}>
      <div className="row nowrap grow">
        {back && <button className="icon" onClick={() => nav(-1)} aria-label="Voltar" style={{ fontSize: '1.4rem' }}>‹</button>}
        <h1 className="grow ellipsis" style={{ margin: 0 }}>{children}</h1>
      </div>
      {right}
    </div>
  );
}

// ---------- Capa ----------
export function Cover({ book, pct, showFav = true }: { book: Pick<Book, 'title' | 'authors' | 'coverId' | 'coverUrl' | 'favorite'>; pct?: number; showFav?: boolean }) {
  const local = useMediaUrl(book.coverId);
  const [broken, setBroken] = useState(false);
  const src = local ?? (broken ? undefined : book.coverUrl);
  return (
    <div className="cover">
      {src ? (
        <img src={src} alt={book.title} loading="lazy" onError={() => setBroken(true)} />
      ) : (
        <div className="placeholder">
          <span>{book.title}</span>
          <small>{book.authors?.[0]}</small>
        </div>
      )}
      {showFav && book.favorite && <div className="fav">♥</div>}
      {pct !== undefined && pct > 0 && pct < 100 && <div className="pct"><div style={{ width: `${pct}%` }} /></div>}
    </div>
  );
}

// ---------- Estrelas com meia estrela ----------
export function Stars({ value, onChange }: { value: number; onChange?: (v: number) => void }) {
  return (
    <div className={`stars${onChange ? '' : ' ro'}`} aria-label={`Nota ${value / 2} de 5`}>
      {[1, 2, 3, 4, 5].map((i) => {
        const full = value >= i * 2;
        const half = !full && value === i * 2 - 1;
        return (
          <button
            key={i}
            type="button"
            tabIndex={onChange ? 0 : -1}
            onClick={(e) => {
              if (!onChange) return;
              const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
              const isLeft = e.clientX - rect.left < rect.width / 2;
              const v = isLeft ? i * 2 - 1 : i * 2;
              onChange(v === value ? 0 : v);
            }}
          >
            {full ? '★' : half ? <HalfStar /> : '☆'}
          </button>
        );
      })}
    </div>
  );
}
const HalfStar = () => (
  <span style={{ position: 'relative', display: 'inline-block' }}>
    ☆
    <span style={{ position: 'absolute', left: 0, top: 0, width: '50%', overflow: 'hidden' }}>★</span>
  </span>
);

// ---------- Chips ----------
export function ChipSelect<T extends string>({ options, value, onChange, labels, scroll }: {
  options: readonly T[]; value: T | undefined; onChange: (v: T | undefined) => void; labels?: Partial<Record<T, string>>; scroll?: boolean;
}) {
  return (
    <div className={`chips${scroll ? ' scroll' : ''}`}>
      {options.map((o) => (
        <button key={o} type="button" className={`chip${value === o ? ' on' : ''}`} onClick={() => onChange(value === o ? undefined : o)}>
          {labels?.[o] ?? o}
        </button>
      ))}
    </div>
  );
}

export function MultiChips({ options, value, onChange, onCreate, createLabel = '+ Novo' }: {
  options: string[]; value: string[]; onChange: (v: string[]) => void; onCreate?: (name: string) => void; createLabel?: string;
}) {
  const all = [...new Set([...options, ...value])];
  return (
    <div className="chips">
      {all.map((o) => {
        const on = value.includes(o);
        return (
          <button key={o} type="button" className={`chip${on ? ' on' : ''}`} onClick={() => onChange(on ? value.filter((x) => x !== o) : [...value, o])}>
            {o}
          </button>
        );
      })}
      {onCreate && (
        <button
          type="button"
          className="chip"
          onClick={() => {
            const name = prompt('Nome:')?.trim();
            if (name) onCreate(name);
          }}
        >
          {createLabel}
        </button>
      )}
    </div>
  );
}

// ---------- Modal ----------
export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);
  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={title}>
        <div className="row between nowrap" style={{ marginBottom: 10 }}>
          <h2 style={{ margin: 0 }}>{title}</h2>
          <button className="icon" onClick={onClose} aria-label="Fechar" style={{ fontSize: '1.4rem' }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Progress({ pct }: { pct: number }) {
  return <div className="progress" aria-label={`${pct}%`}><div style={{ width: `${pct}%` }} /></div>;
}

export const ErrorBox = ({ error }: { error?: string | null }) => (error ? <div className="alert" role="alert">{error}</div> : null);

export const fmtDate = (iso?: string) => {
  if (!iso) return '';
  const d = iso.length === 10 ? new Date(`${iso}T12:00:00`) : new Date(iso);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
};
export const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

/** Botão que abre a câmera do aparelho (ou a galeria) e devolve o arquivo. */
export function CaptureButton({ accept, onFile, children, className = 'secondary', capture = true }: {
  accept: string; onFile: (f: File) => void; children: ReactNode; className?: string; capture?: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      <button type="button" className={className} onClick={() => ref.current?.click()}>{children}</button>
      <input
        ref={ref}
        type="file"
        accept={accept}
        {...(capture ? { capture: 'environment' as const } : {})}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.target.value = '';
        }}
      />
    </>
  );
}
