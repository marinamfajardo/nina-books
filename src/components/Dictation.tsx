import { useEffect, useRef, useState } from 'react';

// Reconhecimento de voz do próprio navegador (Safari/Chrome), grátis e sem IA.
type Recognition = {
  lang: string; continuous: boolean; interimResults: boolean;
  start(): void; stop(): void; abort(): void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
};
const RecognitionCtor = (): (new () => Recognition) | undefined =>
  (window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition }).SpeechRecognition ??
  (window as unknown as { webkitSpeechRecognition?: new () => Recognition }).webkitSpeechRecognition;

export const LANG_CODES: Record<string, string> = {
  Português: 'pt-BR', Inglês: 'en-US', Espanhol: 'es-ES', Francês: 'fr-FR', Italiano: 'it-IT', Alemão: 'de-DE',
  Japonês: 'ja-JP', Coreano: 'ko-KR', Chinês: 'zh-CN', Russo: 'ru-RU',
};

const KEYBOARD_TIP = 'Dica: você também pode tocar no microfone 🎤 do teclado do iPhone/iPad para ditar.';

/**
 * Botão "Falar": transcreve o que você diz e acrescenta ao texto.
 * `onText` recebe o texto final de cada frase reconhecida.
 */
export function DictateButton({ language, onText, onInterim }: { language?: string; onText: (t: string) => void; onInterim?: (t: string) => void }) {
  const [on, setOn] = useState(false);
  const [lang, setLang] = useState(LANG_CODES[language ?? ''] ?? 'pt-BR');
  const [err, setErr] = useState<string | null>(null);
  const rec = useRef<Recognition | null>(null);
  const Ctor = RecognitionCtor();

  useEffect(() => () => rec.current?.abort(), []);

  if (!Ctor) return <p className="small muted">🎤 {KEYBOARD_TIP.replace('Dica: você também pode tocar', 'Para falar a citação, toque')}</p>;

  const start = () => {
    setErr(null);
    const r = new Ctor();
    r.lang = lang;
    r.continuous = true;
    r.interimResults = true;
    r.onresult = (e) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        if (res.isFinal) onText(res[0].transcript.trim());
        else interim += res[0].transcript;
      }
      onInterim?.(interim);
    };
    r.onerror = (e) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed')
        setErr(`Permissão de microfone ou de reconhecimento de fala negada. No iPhone/iPad: Ajustes › Safari › Microfone; e Ajustes › Siri › “Ditado” ativado. ${KEYBOARD_TIP}`);
      else if (e.error === 'no-speech') setErr('Não ouvi nada. Tente falar mais perto do microfone.');
      else if (e.error !== 'aborted') setErr(`Não foi possível transcrever (${e.error}). ${KEYBOARD_TIP}`);
    };
    r.onend = () => { setOn(false); onInterim?.(''); };
    try {
      r.start();
      rec.current = r;
      setOn(true);
    } catch {
      setErr(KEYBOARD_TIP);
    }
  };

  return (
    <div className="stack">
      <div className="row nowrap">
        <button type="button" className={on ? '' : 'secondary'} onClick={() => (on ? rec.current?.stop() : start())} style={{ flex: 1 }}>
          {on ? <><span className="rec-dot" /> Parar de ouvir</> : '🎤 Falar a citação'}
        </button>
        <select value={lang} onChange={(e) => setLang(e.target.value)} style={{ width: 'auto' }} disabled={on} aria-label="Idioma da fala">
          {Object.entries(LANG_CODES).map(([name, code]) => <option key={code} value={code}>{name}</option>)}
        </select>
      </div>
      {on && <p className="small muted" style={{ margin: 0 }}>Pode falar… o texto aparece abaixo. Toque em “Parar” quando terminar.</p>}
      {err && <div className="alert small">{err}</div>}
    </div>
  );
}
