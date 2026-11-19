import { Link } from 'react-router-dom';
import { BookGrid } from '../components/BookBrowser';
import { PageTitle, Stars } from '../components/ui';
import { useLibrary } from '../data/hooks';
import { isFavoriteBook, isRated, ratingSections } from '../domain/rating';

/** Favoritos: livros com ❤️ e todos os de 5 estrelas ou mais, da maior nota para a menor. */
export default function Favorites() {
  const lib = useLibrary();
  const favs = lib.books.filter(isFavoriteBook);
  const sections = ratingSections(favs);
  return (
    <div>
      <PageTitle back>Favoritos</PageTitle>
      <p className="small muted" style={{ marginTop: -6 }}>Os livros que você marcou com ❤️ e todos os que receberam 5 estrelas ou mais.</p>
      {lib.loaded && !favs.length && (
        <div className="empty"><div className="big">❤️</div>Nenhum favorito ainda. Toque no ♡ de um livro ou dê 5 estrelas para ele aparecer aqui.</div>
      )}
      {sections.map((sec) => (
        <div key={sec.rating} className="rating-section">
          <div className="row between rating-head">
            <h3 style={{ margin: 0 }}>{sec.title}</h3>
            {isRated(sec.rating) && <Stars value={sec.rating} />}
          </div>
          <BookGrid books={sec.items} meta={lib.meta} />
        </div>
      ))}
      {favs.length > 0 && <p className="small center mt"><Link to="/">Voltar à estante</Link></p>}
    </div>
  );
}
