import { geoNaturalEarth1, geoPath } from 'd3-geo';
import type { Feature, GeoJsonProperties, Geometry } from 'geojson';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { feature } from 'topojson-client';
import type { Topology } from 'topojson-specification';
import type { Book } from '../db';
import { booksByCountry, countryName, countryNumeric } from '../domain/countries';
import { Cover } from './ui';

const W = 960;
const H = 500;

/** Mapa-múndi com os países onde foram escritos os livros que você leu. */
export function WorldMap({ books }: { books: Book[] }) {
  const [shapes, setShapes] = useState<Feature<Geometry, GeoJsonProperties>[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    // o desenho do mapa só é carregado quando a tela abre
    void import('world-atlas/countries-110m.json').then((m) => {
      const topo = (m.default ?? m) as unknown as Topology;
      const fc = feature(topo, topo.objects.countries) as unknown as { features: Feature<Geometry, GeoJsonProperties>[] };
      setShapes(fc.features.filter((f) => String(f.id) !== '010')); // sem a Antártida
    });
  }, []);

  const byCountry = useMemo(() => booksByCountry(books), [books]);
  const byNumeric = useMemo(() => new Map([...byCountry].map(([code, list]) => [countryNumeric(code), { code, list }])), [byCountry]);
  const max = Math.max(1, ...[...byCountry.values()].map((l) => l.length));
  const path = useMemo(() => {
    if (!shapes) return null;
    const projection = geoNaturalEarth1().fitSize([W, H], { type: 'FeatureCollection', features: shapes });
    return geoPath(projection);
  }, [shapes]);

  const ranking = [...byCountry].sort((a, b) => b[1].length - a[1].length);
  const sel = selected ? byCountry.get(selected) : undefined;
  const withoutCountry = books.filter((b) => (b.status === 'lido' || b.status === 'relendo') && !b.country).length;

  return (
    <div className="card">
      <div className="row between">
        <h3 style={{ margin: 0 }}>🌍 Onde foram escritos os livros que li</h3>
        <span className="small muted">{byCountry.size} país(es)</span>
      </div>
      <div className="world-map">
        {path && shapes ? (
          <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Mapa-múndi das leituras">
            {shapes.map((f) => {
              const hit = byNumeric.get(String(f.id));
              const level = hit ? Math.min(4, Math.ceil((hit.list.length / max) * 4)) : 0;
              return (
                <path
                  key={String(f.id)}
                  d={path(f) ?? undefined}
                  className={`country l${level}${hit && hit.code === selected ? ' sel' : ''}`}
                  onClick={() => hit && setSelected(hit.code === selected ? null : hit.code)}
                >
                  {hit && <title>{countryName(hit.code)}: {hit.list.length} livro(s)</title>}
                </path>
              );
            })}
          </svg>
        ) : <p className="small muted">Carregando o mapa…</p>}
      </div>

      {sel && selected && (
        <div className="mt">
          <b>{countryName(selected)}</b>
          <div className="strip">
            {sel.map((b) => (
              <Link key={b.id} to={`/livro/${b.id}`} className="strip-item"><Cover book={b} /><div className="small ellipsis">{b.title}</div></Link>
            ))}
          </div>
        </div>
      )}

      {ranking.length > 0 ? (
        <div className="chips mt">
          {ranking.map(([code, list]) => (
            <button key={code} className={`chip${code === selected ? ' on' : ''}`} onClick={() => setSelected(code === selected ? null : code)}>
              {countryName(code)} · {list.length}
            </button>
          ))}
        </div>
      ) : (
        <p className="small muted mt">Informe o país onde cada livro foi escrito (em Editar, ou a IA preenche ao buscar o resumo) para pintar o mapa.</p>
      )}
      {withoutCountry > 0 && ranking.length > 0 && <p className="small muted">{withoutCountry} livro(s) lido(s) ainda sem país.</p>}
    </div>
  );
}
