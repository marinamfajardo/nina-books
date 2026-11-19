import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { Book } from '../db';
import { changeStatus } from '../data/actions';
import { sliceAngle, spinTarget, wheelEntries } from '../domain/wheel';
import { Cover, Modal, useToast } from './ui';

const COLORS = ['#6d1a36', '#d98897', '#b3263e', '#f6dde3', '#8e2443', '#e8a3b1'];
const R = 150;

const point = (deg: number, r = R) => {
  const rad = ((deg - 90) * Math.PI) / 180;
  return [R + r * Math.cos(rad), R + r * Math.sin(rad)];
};

/** Fatia da roleta, do ângulo `a` ao `b` (graus, a partir do topo, sentido horário). */
function slicePath(a: number, b: number) {
  if (b - a >= 360) return `M ${R} 0 A ${R} ${R} 0 1 1 ${R - 0.01} 0 Z`;
  const [x1, y1] = point(a);
  const [x2, y2] = point(b);
  return `M ${R} ${R} L ${x1} ${y1} A ${R} ${R} 0 ${b - a > 180 ? 1 : 0} 1 ${x2} ${y2} Z`;
}

const short = (t: string, max: number) => (t.length > max ? `${t.slice(0, max - 1)}…` : t);

/**
 * Roleta para sortear o próximo livro da fila "Quero ler".
 * Recebe todos os livros: sagas entram uma vez, com o próximo volume não lido.
 */
export function Roulette({ books }: { books: Book[] }) {
  const [onlyHigh, setOnlyHigh] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [winner, setWinner] = useState<Book | null>(null);
  const [pending, setPending] = useState<Book | null>(null);
  const nav = useNavigate();
  const toast = useToast();

  const all = wheelEntries(books);
  const highCount = all.filter((e) => (e.book.wantPriority ?? 2) === 1).length;
  const entries = onlyHigh && highCount > 0 ? all.filter((e) => (e.book.wantPriority ?? 2) === 1) : all;
  const list = entries.map((e) => e.book);
  const n = list.length;
  const seg = sliceAngle(n);

  if (!all.length) {
    return <div className="empty"><div className="big">🎡</div>Adicione livros com o status “Quero ler” para girar a roleta.</div>;
  }

  const spin = () => {
    if (spinning || !n) return;
    const i = Math.floor(Math.random() * n);
    setWinner(null);
    setPending(list[i]);
    setSpinning(true);
    setRotation((r) => spinTarget(r, i, n));
  };

  return (
    <div className="stack center">
      {highCount > 0 && highCount < all.length && (
        <label className="row small" style={{ justifyContent: 'center' }}>
          <input type="checkbox" checked={onlyHigh} disabled={spinning} onChange={(e) => setOnlyHigh(e.target.checked)} /> Só prioridade alta ({highCount})
        </label>
      )}
      <div className="wheel-wrap">
        <div className="wheel-pointer" aria-hidden>▼</div>
        <svg
          viewBox={`0 0 ${2 * R} ${2 * R}`}
          className="wheel"
          style={{ transform: `rotate(${rotation}deg)`, transition: spinning ? 'transform 4.5s cubic-bezier(0.12, 0.8, 0.2, 1)' : 'none' }}
          onTransitionEnd={() => {
            setSpinning(false);
            setWinner(pending);
          }}
          role="img"
          aria-label={`Roleta com ${n} livros`}
        >
          {list.map((b, i) => {
            const fill = COLORS[i % COLORS.length];
            const light = fill === '#f6dde3' || fill === '#e8a3b1' || fill === '#d98897';
            const mid = (i + 0.5) * seg;
            const [tx, ty] = point(mid, R * 0.58);
            return (
              <g key={b.id}>
                <path d={slicePath(i * seg, (i + 1) * seg)} fill={fill} stroke="#fff" strokeWidth="1.5" />
                <text
                  x={tx}
                  y={ty}
                  fill={light ? '#4a0e23' : '#fff'}
                  fontSize={n > 28 ? 6.5 : n > 16 ? 8 : n > 8 ? 10 : 12}
                  fontWeight={700}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  transform={`rotate(${mid + (mid > 180 ? 90 : -90)} ${tx} ${ty})`}
                >
                  {short(entries[i].label, n > 28 ? 12 : n > 12 ? 15 : 20)}
                </text>
              </g>
            );
          })}
          <circle cx={R} cy={R} r={18} fill="#fff" stroke="#6d1a36" strokeWidth="3" />
          <text x={R} y={R} textAnchor="middle" dominantBaseline="middle" fontSize="16">📚</text>
        </svg>
      </div>
      <button className="block" onClick={spin} disabled={spinning || !n}>{spinning ? 'Girando…' : '🎡 Girar a roleta'}</button>
      <p className="small muted" style={{ margin: 0 }}>{n} opção(ões) na roleta · cada saga entra só com o próximo volume que você ainda não leu</p>

      {winner && (
        <Modal title="O próximo livro é…" onClose={() => setWinner(null)}>
          <div className="stack center">
            <div className="confetti" aria-hidden>🎉📚✨</div>
            <div style={{ width: 140, margin: '0 auto' }}><Cover book={winner} /></div>
            <h2 style={{ margin: 0 }}>{winner.title}</h2>
            {winner.series && <div className="small">📚 {winner.series}{winner.seriesNumber ? ` · volume ${winner.seriesNumber}` : ''}</div>}
            <div className="muted">{winner.authors.join(', ')}</div>
            <button className="block" onClick={async () => {
              await changeStatus(winner.id, 'lendo');
              toast('Boa leitura! 📖');
              nav(`/livro/${winner.id}`);
            }}>📖 Começar a ler agora</button>
            <div className="row">
              <Link to={`/livro/${winner.id}`} className="btn secondary grow">Ver o livro</Link>
              <button className="secondary grow" onClick={() => { setWinner(null); setTimeout(spin, 50); }}>🎡 Girar de novo</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
