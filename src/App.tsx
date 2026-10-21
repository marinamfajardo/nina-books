import { useEffect } from 'react';
import { HashRouter, Link, NavLink, Route, Routes, useLocation } from 'react-router-dom';
import { Icon, Logo, ToastProvider } from './components/ui';
import { requestPersistentStorage, seedDefaults } from './data/actions';
import AddBook from './pages/AddBook';
import Backup from './pages/Backup';
import BookDetail from './pages/book/BookDetail';
import { Goals, Loans, WantToRead, Wishlist } from './pages/Extras';
import Glossary from './pages/Glossary';
import { GroupBooks, GroupList } from './pages/Groups';
import Settings from './pages/Settings';
import Shelf from './pages/Shelf';
import Stats from './pages/Stats';
import Ranking, { AuthorList, AuthorPage } from './pages/Ranking';
import { SyncStatusBadge } from './pages/SyncSettings';
import { useAutoSync } from './sync/useSync';

function ScrollTop() {
  const { pathname } = useLocation();
  useEffect(() => window.scrollTo(0, 0), [pathname]);
  return null;
}

function Shell() {
  useAutoSync();
  return (
    <div className="app">
      <ScrollTop />
      <header className="topbar">
        <Link to="/" className="logo"><Logo /> Nina <span>Book's</span></Link>
        <span className="spacer" />
        <Link to="/configuracoes" style={{ textDecoration: 'none' }}><SyncStatusBadge /></Link>
      </header>
      <main className="content">
        <Routes>
          <Route path="/" element={<Shelf />} />
          <Route path="/adicionar" element={<AddBook />} />
          <Route path="/estatisticas" element={<Stats />} />
          <Route path="/glossario" element={<Glossary />} />
          <Route path="/configuracoes" element={<Settings />} />
          <Route path="/livro/:id" element={<BookDetail />} />
          <Route path="/grupos/:by" element={<GroupList />} />
          <Route path="/grupo/:by/:value" element={<GroupBooks />} />
          <Route path="/metas" element={<Goals />} />
          <Route path="/quero-ler" element={<WantToRead />} />
          <Route path="/emprestimos" element={<Loans />} />
          <Route path="/desejos" element={<Wishlist />} />
          <Route path="/backup" element={<Backup />} />
          <Route path="/ranking" element={<Ranking />} />
          <Route path="/autores" element={<AuthorList />} />
          <Route path="/autor/:name" element={<AuthorPage />} />
          <Route path="*" element={<div className="empty">Página não encontrada. <Link to="/">Ir para a estante</Link></div>} />
        </Routes>
      </main>
      <nav className="bottomnav" aria-label="Navegação principal">
        <NavLink to="/" end>{Icon.shelf()}Estante</NavLink>
        <NavLink to="/adicionar" className={({ isActive }) => `add${isActive ? ' active' : ''}`}><span className="bubble">{Icon.add()}</span>Adicionar</NavLink>
        <NavLink to="/estatisticas">{Icon.stats()}Estatísticas</NavLink>
        <NavLink to="/glossario">{Icon.glossary()}Glossário</NavLink>
        <NavLink to="/configuracoes">{Icon.settings()}Ajustes</NavLink>
      </nav>
    </div>
  );
}

export default function App() {
  useEffect(() => {
    void seedDefaults();
    void requestPersistentStorage();
  }, []);
  return (
    <HashRouter>
      <ToastProvider>
        <Shell />
      </ToastProvider>
    </HashRouter>
  );
}
