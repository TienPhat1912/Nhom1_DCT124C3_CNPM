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
  return <main className="entry-access"><div className="panel">
    <span className="eyebrow">An Tâm</span>
    <h1>{locale === "vi" ? "Hướng dẫn khám bệnh" : "Hospital visit guidance"}</h1>
    <p>{locale === "vi" ? "Chọn ứng dụng đã cài hoặc tiếp tục bằng trình duyệt. Bạn có thể sử dụng với tư cách khách." : "Open the installed app or continue in your browser. Guest access is available."}</p>
    <div className="actions">
      <a className="button primary" href={target}>{locale === "vi" ? "Mở ứng dụng" : "Open app"}</a>
      <a className="button secondary" href={web}>{locale === "vi" ? "Tiếp tục trên web" : "Continue on web"}</a>
    </div>
  </div></main>;
}
export function HospitalQr({ locale }: { locale: Locale }) {
  const url = `${location.origin}/entry`;
  return <details className="panel"><summary>{locale === "vi" ? "QR truy cập công khai bệnh viện" : "Public hospital entry QR"}</summary>
    <div className="qr-panel"><QRCodeSVG value={url} size={180} marginSize={3} title="Hospital entry" />
      <a href={url}>{url}</a>
    </div>
  </details>;
}
