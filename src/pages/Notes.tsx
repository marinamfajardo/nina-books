import { useSearchParams } from 'react-router-dom';
import { PageTitle } from '../components/ui';
import { NotesTab } from './book/NotesTab';
import { AllQuotes } from './Inspiration';

/** Aba "Notas": comentários (texto, áudio, vídeo) e citações de todos os livros. */
export default function Notes() {
  const [params, setParams] = useSearchParams();
  const tab = params.get('aba') === 'citacoes' ? 'citacoes' : 'comentarios';
  return (
    <div>
      <PageTitle>Notas</PageTitle>
      <div className="tabs">
        <button className={tab === 'comentarios' ? 'on' : ''} onClick={() => setParams({ aba: 'comentarios' }, { replace: true })}>💬 Comentários</button>
        <button className={tab === 'citacoes' ? 'on' : ''} onClick={() => setParams({ aba: 'citacoes' }, { replace: true })}>❝ Citações</button>
      </div>
      {tab === 'comentarios' ? <NotesTab mode="comentarios" /> : <AllQuotes embedded />}
    </div>
  );
}
