import packageInfo from "../package.json";

// Keep the update-check API and the frontend's displayed version tied to the
// release version that startup history records, rather than maintaining a
// second hard-coded value that can drift.
export const APP_VERSION = `v${packageInfo.version}`;
