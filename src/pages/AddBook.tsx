import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BookForm, type BookDraft } from '../components/BookForm';
import { CoverStep } from '../components/CoverCropper';
import { ErrorBox, PageTitle, useToast } from '../components/ui';
import { db } from '../db';
import { createFromDraft } from '../data/saveDraft';
import { normalize } from '../domain/filters';
import { hasApiKey } from '../services/claude';
import { shrinkImage } from '../services/media';

type Step = 'foto' | 'recorte' | 'dados';

/** Procura um livro com o mesmo título (e autor, se houver) na estante. */
async function findSameBook(title: string, authors: string[]) {
  const t = normalize(title).trim();
  const a = authors[0] ? normalize(authors[0]) : null;
  return (await db.books.toArray()).find((b) => normalize(b.title).trim() === t && (!a || b.authors.some((x) => normalize(x) === a)));
}

export default function AddBook() {
  const nav = useNavigate();
  const toast = useToast();
  const [step, setStep] = useState<Step>('foto');
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [draft, setDraft] = useState<BookDraft>({ title: '', authors: [] });
  const [error, setError] = useState<string | null>(null);
  const camera = useRef<HTMLInputElement>(null);
  const gallery = useRef<HTMLInputElement>(null);

  const onFile = async (f?: File) => {
    if (!f) return;
    setError(null);
    try {
      setPhoto(await shrinkImage(f, 1600));
      setStep('recorte');
    } catch {
      setError('Não foi possível abrir a foto. Tente de novo.');
    }
  };

  const save = async (d: BookDraft) => {
    try {
      const dup = await findSameBook(d.title, d.authors);
      if (dup && !confirm(`“${dup.title}” já está na sua estante. Adicionar outro exemplar mesmo assim?`)) {
        nav(`/livro/${dup.id}`);
        return;
      }
      const id = await createFromDraft(d);
      toast('Livro adicionado à estante 📚');
      nav(`/livro/${id}`, { replace: true });
    } catch (e) {
      setError(`Não foi possível salvar: ${(e as Error).message}`);
    }
  };

  const inputs = (
    <>
      <input ref={camera} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { void onFile(e.target.files?.[0]); e.target.value = ''; }} />
      <input ref={gallery} type="file" accept="image/*" className="hidden" onChange={(e) => { void onFile(e.target.files?.[0]); e.target.value = ''; }} />
    </>
  );

  if (step === 'recorte' && photo) {
    return (
      <div>
        <PageTitle>Recortar a capa</PageTitle>
        <CoverStep
          photo={photo}
          onRetake={() => camera.current?.click()}
          onDone={(cover, a) => {
            setDraft({ title: a?.title ?? '', authors: a?.authors ?? [], coverBlob: cover });
            setStep('dados');
          }}
        />
        {inputs}
      </div>
    );
  }

  if (step === 'dados') {
    return (
      <div>
        <PageTitle>Dados do livro</PageTitle>
        <ErrorBox error={error} />
        {draft.title ? (
          <div className="alert info small">✨ A IA leu o título e o autor na capa. Confira e corrija se precisar.</div>
        ) : (
          <div className="alert info small">Digite o título e o autor do livro.</div>
        )}
        <div className="card">
          <BookForm key={draft.title} initial={draft} withSummary onSave={save} onCancel={() => setStep('foto')} saveLabel="Adicionar à estante" />
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageTitle>Adicionar livro</PageTitle>
      <ErrorBox error={error} />
      <div className="card stack center">
        <div style={{ fontSize: '3.4rem' }}>📷</div>
        <h2>Tire uma foto da capa</h2>
        <p className="small muted">
          Coloque o livro sobre uma superfície e fotografe a capa inteira. O app recorta o fundo
          {hasApiKey() ? ', e a IA lê o título e o autor para você.' : '. Depois é só digitar o título e o autor.'}
        </p>
        <button className="block" onClick={() => camera.current?.click()}>📷 Tirar foto do livro</button>
        <button className="ghost small" onClick={() => gallery.current?.click()}>ou escolher uma foto da galeria</button>
      </div>
      {!hasApiKey() && (
        <div className="alert info small">
          💡 Para a IA ler a capa e buscar o resumo, cadastre sua chave em <Link to="/configuracoes">Ajustes</Link>.
        </div>
      )}
      {inputs}
    </div>
  );
}
