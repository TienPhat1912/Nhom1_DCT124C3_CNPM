// Expo config plugins run in Node during prebuild, outside the application bundle.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { AndroidConfig, withAndroidManifest, withDangerousMod } = require('expo/config-plugins');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { mkdir, writeFile } = require('node:fs/promises');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const path = require('node:path');

// Keep the local demo usable in release APKs without allowing HTTP to hospital
// servers. All other destinations still require a trusted HTTPS certificate.
const localNetworkXml = `<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
  <base-config cleartextTrafficPermitted="false">
    <trust-anchors><certificates src="system" /></trust-anchors>
  </base-config>
  <domain-config cleartextTrafficPermitted="true">
    <domain includeSubdomains="false">localhost</domain>
    <domain includeSubdomains="false">127.0.0.1</domain>
    <domain includeSubdomains="false">10.0.2.2</domain>
  </domain-config>
</network-security-config>
`;

module.exports = function withLocalNetwork(config) {
  config = withAndroidManifest(config, (result) => {
    const application = AndroidConfig.Manifest.getMainApplicationOrThrow(result.modResults);
    application.$['android:networkSecurityConfig'] = '@xml/local_network_security';
    application.$['android:usesCleartextTraffic'] = 'false';
    return result;
  });
  return withDangerousMod(config, ['android', async (result) => {
    const directory = path.join(result.modRequest.platformProjectRoot, 'app/src/main/res/xml');
    await mkdir(directory, { recursive: true });
    await writeFile(path.join(directory, 'local_network_security.xml'), localNetworkXml, 'utf8');
    return result;
  }]);
};
