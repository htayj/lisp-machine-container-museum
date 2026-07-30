import { cadrM10Sha256, hexBytes } from "../wasm/cadr-m10-persistence.mjs";
import { createCadrM10IndexedDbBackend } from "./cadr-m10-indexeddb.mjs";

addEventListener("error", (event) => parent.postMessage({ type: "cadr-m10-foreign-error", message: event.message }, "*"));
addEventListener("unhandledrejection", (event) => parent.postMessage({ type: "cadr-m10-foreign-error", message: String(event.reason) }, "*"));
const query = new URLSearchParams(location.search);
const channel = query.get("channel");
const binding = {
  diskUuid: Uint8Array.from({ length: 16 }, (_, index) => 160 + index),
  profileSha256: await cadrM10Sha256(new TextEncoder().encode("C-M10 foreign profile")),
  artifactSetSha256: await cadrM10Sha256(new TextEncoder().encode("C-M10 foreign artifacts")),
};
const backend = createCadrM10IndexedDbBackend({ databasePrefix: `cadr-m10-foreign-${channel.slice(0, 16)}` });
let disk = await backend.initializeDisk(binding);
async function fingerprint() {
  const active = await disk.active();
  return `${active.head.headSeq}:${hexBytes(active.manifest.rootSha256)}`;
}

parent.postMessage({ type: "cadr-m10-foreign-ready", channel, fingerprint: await fingerprint() }, "*");
addEventListener("message", async (event) => {
  if (event.data?.type === "cadr-m10-foreign-check" && event.data.channel === channel) {
    try {
      const old = disk;
      disk = await backend.reopenDisk(binding);
      old.close();
      parent.postMessage({ type: "cadr-m10-foreign-check", channel, fingerprint: await fingerprint() }, "*");
    } catch (error) {
      parent.postMessage({ type: "cadr-m10-foreign-error", message: error?.stack ?? String(error) }, "*");
    }
  }
});
