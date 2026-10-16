import { getUiText } from "../../../../packages/i18n/src/ui";
import { useEffect, useRef, useState } from 'react';

export function QrScanner({ lang, onCode }: { lang: string; onCode: (code: string) => void }) {
  const [active, setActive] = useState(false);
  const [error, setError] = useState('');
  const video = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (!active) return;
    let live = true;
    let stream: MediaStream | undefined;
    let timer: ReturnType<typeof setTimeout>;
    async function scan() {
      try {
        const Detector = (window as unknown as { BarcodeDetector?: new (options: { formats: string[] }) => { detect: (video: HTMLVideoElement) => Promise<{ rawValue: string }[]> } }).BarcodeDetector;
        if (!Detector) throw new Error(getUiText(lang,"qr_scanning_is_unavailable_in_this_browser_enter_the_code_instead"));
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        if (!live) { stream.getTracks().forEach(track => track.stop()); return; }
        video.current!.srcObject = stream; await video.current!.play();
        const detector = new Detector({ formats: ['qr_code'] });
        const frame = async () => {
          if (!live || !video.current) return;
          try {
            const result = await detector.detect(video.current);
            if (result[0]) { onCode(result[0].rawValue); setActive(false); return; }
            timer = setTimeout(frame, 300);
          } catch (e) { setError((e as Error).message); setActive(false); }
        };
        await frame();
      } catch (e) { setError((e as Error).message); setActive(false); }
    }
    scan();
    return () => { live = false; clearTimeout(timer); stream?.getTracks().forEach(track => track.stop()); };
  }, [active]);
  return <div>
    <button type="button" className="btn btn-outline" onClick={() => { setError(''); setActive(!active); }}>{active ? (getUiText(lang,"stop_camera")) : (getUiText(lang,"scan_qr"))}</button>
    {active && <video ref={video} muted playsInline style={{ width: '100%', maxWidth: 360 }} />}
    {error && <p role="status">{error}</p>}
  </div>;
}
