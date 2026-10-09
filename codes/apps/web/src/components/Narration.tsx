import { getUiText } from "../../../../packages/i18n/src/ui";
import { useEffect, useState } from 'react';
import { api } from '../api';
import { useRef } from 'react';

export function Narration({ id, lang, section }: { id: string; lang: string; section: 'diagnosis' | 'care' }) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const generation = useRef(0);
  useEffect(() => {
    generation.current++;
    window.speechSynthesis?.cancel(); setError('');
    return () => {generation.current++;window.speechSynthesis?.cancel();};
  }, [id, lang, section]);
  async function play() {
    const attempt = ++generation.current;
    setBusy(true); setError('');
    try {
      const text = await api.getNarration(id, section, lang);
      if (attempt !== generation.current) return;
      if (!window.speechSynthesis) throw new Error(getUiText(lang,"speech_is_unavailable_readable_text_remains_available"));
      const voice = window.speechSynthesis.getVoices().find(v => v.lang.startsWith(text.language));
      if (!voice) throw new Error(getUiText(lang,"a_matching_voice_is_unavailable_read_the_text_or_retry"));
      window.speechSynthesis.cancel();
      const speech = new SpeechSynthesisUtterance(text.text);
      speech.lang = text.language; speech.voice = voice;
      speech.onerror = () => setError(getUiText(lang,"playback_failed_text_remains_available"));
      window.speechSynthesis.speak(speech);
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }
  return <div>
    <button className="btn btn-outline btn-sm" disabled={busy} onClick={play}>{getUiText(lang,"listen_replay")}</button>{' '}
    <button className="btn btn-outline btn-sm" onClick={() => {generation.current++;window.speechSynthesis?.cancel();}}>{getUiText(lang,"stop")}</button>
    {error && <p role="status">{error}</p>}
  </div>;
}
