import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarcodeScanner, decodeBarcodeFromImage } from '../components/BarcodeScanner';
import { BookForm, type BookDraft } from '../components/BookForm';
import { CaptureButton, Cover, ErrorBox, PageTitle, useToast } from '../components/ui';
import { findByIsbn } from '../data/actions';
import { createFromDraft } from '../data/saveDraft';
import { cleanIsbn, isValidIsbn, lookupIsbn, searchBooks, type FoundBook } from '../services/bookLookup';
import { hasApiKey, readCover } from '../services/claude';
import { blobToBase64, shrinkImage } from '../services/media';
import { extractText } from '../services/ocr';

type Step = 'menu' | 'scan' | 'search' | 'form';

const toDraft = (f: FoundBook): BookDraft => ({
  title: f.title, subtitle: f.subtitle, authors: f.authors, publisher: f.publisher, year: f.year,
  isbn: f.isbn, pageCount: f.pageCount, coverUrl: f.coverUrl, originalLanguage: f.originalLanguage, synopsis: f.synopsis,
});

export default function AddBook() {
  const nav = useNavigate();
  const toast = useToast();
  const [step, setStep] = useState<Step>('menu');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [isbnInput, setIsbnInput] = useState('');
  const [results, setResults] = useState<FoundBook[]>([]);
  const [draft, setDraft] = useState<BookDraft>({ title: '', authors: [] });
  const [photo, setPhoto] = useState<Blob | null>(null);

  const openDraft = async (d: BookDraft) => {
    const dup = await findByIsbn(d.isbn);
    if (dup) {
      if (!confirm(`“${dup.title}” já está na sua estante (mesmo ISBN). Quer abrir o livro que já existe?`)) {
        setDraft(d);
        setStep('form');
        return;
      }
      nav(`/livro/${dup.id}`);
      return;
    }
    setDraft(d);
    setStep('form');
  };

  const byIsbn = useCallback(async (raw: string) => {
    const isbn = cleanIsbn(raw);
    setError(null);
    if (!isValidIsbn(isbn)) {
      setError(`“${raw}” não parece um ISBN válido. Confira os números ou busque pelo título.`);
      setStep('menu');
      return;
    }
    const dup = await findByIsbn(isbn);
    if (dup) {
      setStep('menu');
      if (confirm(`“${dup.title}” já está na sua estante. Abrir?`)) nav(`/livro/${dup.id}`);
      return;
    }
    setBusy('Buscando o livro…');
    try {
      const found = await lookupIsbn(isbn);
      await openDraft(toDraft(found));
    } catch (e) {
      setError((e as Error).message);
      setDraft({ title: '', authors: [], isbn });
      setStep('menu');
    } finally {
      setBusy(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const search = async (q: string) => {
    setError(null);
    setBusy('Buscando…');
    try {
      const r = await searchBooks(q);
      setResults(r);
      setStep('search');
      if (!r.length) setError('Nenhum livro encontrado. Tente outras palavras ou cadastre manualmente.');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const fromCoverPhoto = async (file: File) => {
    setError(null);
    const img = await shrinkImage(file, 1400);
    setPhoto(img);
    setBusy('Lendo a capa…');
    try {
      // 1) talvez a foto seja do código de barras
      const code = await decodeBarcodeFromImage(img);
      if (code && isValidIsbn(code)) {
        setBusy(null);
        await byIsbn(code);
        return;
      }
      // 2) título e autor pela IA, ou OCR no aparelho
      let q = '';
      if (hasApiKey() && navigator.onLine) {
        const { title, author } = await readCover(await blobToBase64(img), img.type || 'image/jpeg');
        q = `${title} ${author}`.trim();
      } else {
        setBusy('Lendo o texto da capa no aparelho…');
        const text = await extractText(img);
        q = text.split('\n').map((l) => l.trim()).filter((l) => l.length > 2).slice(0, 3).join(' ');
      }
      if (!q) throw new Error('Não consegui ler o título na foto. Digite o título abaixo.');
      setQuery(q);
      await search(q);
    } catch (e) {
      setError((e as Error).message);
      setBusy(null);
    }
  };

  const pick = (f: FoundBook) => {
    const d = toDraft(f);
    // sem capa nas APIs: usa a foto tirada
    if (!d.coverUrl && photo) d.coverBlob = photo;
    void openDraft(d);
  };

  const save = async (d: BookDraft) => {
    try {
      if (!d.coverBlob && !d.coverUrl && photo) d.coverBlob = photo;
      const id = await createFromDraft(d);
      toast('Livro adicionado à estante 📚');
      nav(`/livro/${id}`, { replace: true });
    } catch (e) {
      setError(`Não foi possível salvar: ${(e as Error).message}`);
    }
  };

  if (step === 'form') {
    return (
      <div>
        <PageTitle>Confirmar livro</PageTitle>
        <ErrorBox error={error} />
        <div className="card"><BookForm initial={draft} onSave={save} onCancel={() => setStep('menu')} saveLabel="Adicionar à estante" /></div>
      </div>
    );
  }

  return (
    <div>
      <PageTitle>Adicionar livro</PageTitle>
      <ErrorBox error={error} />
      {busy && <div className="alert info">⏳ {busy}</div>}

      {step === 'scan' ? (
        <div className="card">
          <h3>Aponte para o código de barras</h3>
          <BarcodeScanner onCode={(c) => { setStep('menu'); void byIsbn(c); }} />
          <p className="small muted mt">O código fica no verso do livro, perto do preço (começa com 978 ou 979).</p>
          <button className="secondary block" onClick={() => setStep('menu')}>Cancelar</button>
        </div>
      ) : (
        <div className="card stack">
          <button className="block" onClick={() => { setError(null); setStep('scan'); }}>▦ Escanear código de barras (ISBN)</button>
          <CaptureButton accept="image/*" className="secondary block" onFile={fromCoverPhoto}>📷 Tirar foto da capa</CaptureButton>
          <form className="row nowrap" onSubmit={(e) => { e.preventDefault(); if (isbnInput.trim()) void byIsbn(isbnInput); }}>
            <input inputMode="numeric" placeholder="Digitar ISBN" value={isbnInput} onChange={(e) => setIsbnInput(e.target.value)} />
            <button type="submit" className="secondary">OK</button>
          </form>
        </div>
      )}

      <div className="card">
        <h3>Buscar por título ou autor</h3>
        <form className="row nowrap" onSubmit={(e) => { e.preventDefault(); if (query.trim()) void search(query); }}>
          <input type="search" placeholder="Ex.: Torto Arado Itamar" value={query} onChange={(e) => setQuery(e.target.value)} />
          <button type="submit">Buscar</button>
        </form>
        {step === 'search' && results.length > 0 && (
          <div className="mt">
            <p className="small muted">Toque no livro certo:</p>
            {results.map((r, i) => (
              <button key={i} className="list-item" onClick={() => pick(r)}
                style={{ background: 'none', color: 'inherit', borderRadius: 0, width: '100%', textAlign: 'left', fontWeight: 400, justifyContent: 'flex-start' }}>
                <div style={{ width: 52, flex: 'none' }}><Cover book={{ title: r.title, authors: r.authors, coverUrl: r.coverUrl, favorite: false }} /></div>
                <div className="grow">
                  <b>{r.title}</b>
                  <div className="small muted">{r.authors.join(', ')}{r.year ? ` · ${r.year}` : ''}{r.publisher ? ` · ${r.publisher}` : ''}</div>
                  <div className="small muted">{r.pageCount ? `${r.pageCount} páginas · ` : ''}{r.source}</div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <button className="secondary block" onClick={() => openDraft({ ...draft, title: draft.title || query, authors: draft.authors })}>
        ✍️ Cadastrar manualmente
      </button>
    </div>
  );
}
