import { chromium } from "@playwright/test";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import assert from "node:assert/strict";

const layout = JSON.parse(
  readFileSync(
    new URL("../../packages/shared/data/hospital-layout.json", import.meta.url),
    "utf8",
  ),
);
const output = resolve("artifacts/pb033");
const entries = layout.buildings.flatMap((b) =>
  b.floors.map((floor) => ({
    spaceId: `floor:${b.id}:${floor}`,
    label: `${b.id} / ${floor}`,
    file: `chromium-desktop-${b.id}-${floor}.png`,
  })),
);
for (const entry of entries)
  assert.ok(
    existsSync(resolve(output, entry.file)),
    `Run map browser tests first: missing ${entry.file}`,
  );
const browser = await chromium.launch(
  process.env.PLAYWRIGHT_CHANNEL
    ? { channel: process.env.PLAYWRIGHT_CHANNEL }
    : {},
);
try {
  const page = await browser.newPage({
    viewport: { width: 1560, height: 1000 },
  });
  await page.setContent(
    `<style>body{margin:16px;font-family:Arial;background:#f1f5f3;color:#203d35}h1{font-size:24px}.sheet{display:grid;grid-template-columns:repeat(5,1fr);gap:10px}figure{margin:0;background:white;padding:6px;height:305px;box-sizing:border-box}figcaption{text-align:center;font-size:14px;font-weight:bold}img{width:100%;height:275px;object-fit:contain}</style><h1>PB-033: ${entries.length} self-designed demo floor plans (not surveyed)</h1><div class="sheet">${entries.map((e) => `<figure><figcaption>${e.label}</figcaption><img src="data:image/png;base64,${readFileSync(resolve(output, e.file)).toString("base64")}"></figure>`).join("")}</div>`,
  );
  await page.evaluate(() =>
    Promise.all([...document.images].map((image) => image.decode())),
  );
  await page.screenshot({
    path: resolve(output, "atlas-desktop.png"),
    fullPage: true,
  });
  writeFileSync(
    resolve(output, "atlas-index.json"),
    JSON.stringify(
      { version: layout.version, surveyed: false, entries },
      null,
      2,
    ),
  );
  console.log(
    `Rendered atlas: ${entries.length} plans, artifacts/pb033/atlas-desktop.png`,
  );
} finally {
  await browser.close();
}
