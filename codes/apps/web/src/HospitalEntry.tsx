import { localizeText } from "@hospital/shared";
import { useEffect } from "react";
import { QRCodeSVG } from "qrcode.react";
import type { Locale } from "@hospital/shared";
export function HospitalEntry({ locale }: { locale: Locale }) {
  const web = `${location.origin}/#hospital`;
  const app = `hguide://entry?language=${locale}`;
  const android = /Android/i.test(navigator.userAgent);
  const target = android
    ? `intent://entry?language=${locale}#Intent;scheme=hguide;package=vn.edu.cnpm.hospitalguide;S.browser_fallback_url=${encodeURIComponent(web)};end`
    : app;
  useEffect(() => {
    // Android browsers that support intent links can open an installed app or the web fallback.
    // Other browsers retain the explicit actions below, without guessing installation status.
    if (android) location.replace(target);
  }, [android, target]);
  return (
    <main className="entry-access">
      <div className="panel">
        <span className="eyebrow">An Tâm</span>
        <h1>{localizeText("Hướng dẫn khám bệnh", locale)}</h1>
        <p>
          {localizeText(
            "Chọn ứng dụng đã cài hoặc tiếp tục bằng trình duyệt. Bạn có thể sử dụng với tư cách khách.",
            locale,
          )}
        </p>
        <div className="actions">
          <a className="button primary" href={target}>
            {localizeText("Mở ứng dụng", locale)}
          </a>
          <a className="button secondary" href={web}>
            {localizeText("Tiếp tục trên web", locale)}
          </a>
        </div>
      </div>
    </main>
  );
}
export function HospitalQr({ locale }: { locale: Locale }) {
  const url = `${location.origin}/entry`;
  return (
    <details className="panel">
      <summary>
        {localizeText("QR truy cập công khai bệnh viện", locale)}
      </summary>
      <div className="qr-panel">
        <QRCodeSVG
          value={url}
          size={180}
          marginSize={3}
          title="Hospital entry"
        />
        <a href={url}>{url}</a>
      </div>
    </details>
  );
}
