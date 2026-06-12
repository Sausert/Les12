// Typed loosely on purpose: @capacitor/cli is only installed when wrapping.
type CapacitorConfig = {
  appId: string;
  appName: string;
  webDir: string;
  server?: { url?: string; cleartext?: boolean };
  backgroundColor?: string;
};

/**
 * App-store wrap (phase 6 follow-up). The whole game runs behind HTTP APIs,
 * so the native shell simply loads the deployed PWA:
 *
 *   npm install @capacitor/core @capacitor/cli @capacitor/android
 *   npx cap add android
 *   npx cap sync && npx cap open android
 *
 * Set `server.url` to your deployed instance. Note: app stores review
 * crypto/gambling functionality strictly — testnet-only helps, but check the
 * store policies before submitting.
 */
const config: CapacitorConfig = {
  appId: "nl.sonicomerta.app",
  appName: "Sonic Omerta",
  webDir: "public",
  server: {
    url: "https://YOUR-DEPLOYED-URL.example",
    cleartext: false,
  },
  backgroundColor: "#0d0d0f",
};

export default config;
