import { Capacitor, registerPlugin } from "@capacitor/core";
import { emptyNotebook, validateNotebook, type Notebook } from "./model";
type Snapshot = { revision: number; notebook: Notebook };
interface DeviceStore {
  load(): Promise<{ revision: number; payload: string | null }>;
  save(options: {
    revision: number;
    payload: string;
  }): Promise<{ revision: number }>;
  exportFile(options: {
    text: string;
    name: string;
    destination?: "phone" | "drive";
  }): Promise<void>;
  importFile(): Promise<{ text: string }>;
}
export const deviceStore = registerPlugin<DeviceStore>("NotedNotebook");
const native = () => Capacitor.getPlatform() === "android";
let opening: Promise<IDBDatabase>;
function database() {
  return (opening ??= new Promise((resolve, reject) => {
    const request = indexedDB.open("noted-personal-test", 1);
    request.onupgradeneeded = () =>
      request.result.createObjectStore("notebook");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () =>
      reject(new Error("Close other Noted Personal tabs and try again."));
  }));
}
export async function loadNotebook(): Promise<Snapshot> {
  if (native()) {
    const data = await deviceStore.load();
    return {
      revision: data.revision,
      notebook: data.payload
        ? validateNotebook(JSON.parse(data.payload))
        : emptyNotebook(),
    };
  }
  const db = await database();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("notebook", "readonly");
    const request = tx.objectStore("notebook").get("current");
    tx.oncomplete = () => {
      try {
        const data = request.result;
        resolve(
          data
            ? {
                revision: data.revision,
                notebook: validateNotebook(data.notebook),
              }
            : { revision: 0, notebook: emptyNotebook() },
        );
      } catch (error) {
        reject(error);
      }
    };
    tx.onerror = () => reject(tx.error);
  });
}
export async function saveNotebook(
  notebook: Notebook,
  revision: number,
): Promise<number> {
  const checked = validateNotebook(notebook);
  if (native())
    return (
      await deviceStore.save({ revision, payload: JSON.stringify(checked) })
    ).revision;
  const db = await database();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("notebook", "readwrite");
    const store = tx.objectStore("notebook");
    const read = store.get("current");
    let conflict = false;
    read.onsuccess = () => {
      if ((read.result?.revision ?? 0) !== revision) {
        conflict = true;
        tx.abort();
        return;
      }
      store.put({ revision: revision + 1, notebook: checked }, "current");
    };
    tx.oncomplete = () => resolve(revision + 1);
    tx.onabort = tx.onerror = () =>
      reject(
        conflict
          ? new Error(
              "Another copy changed this notebook. Reopen it before saving.",
            )
          : (tx.error ?? new Error("Could not save. Check available storage.")),
      );
  });
}
export async function downloadBackup(
  text: string,
  destination: "phone" | "drive" = "phone",
) {
  const name =
    "Noted-Personal-" + new Date().toISOString().slice(0, 10) + ".json";
  if (native()) return deviceStore.exportFile({ text, name, destination });
  if (destination === "drive")
    throw new Error(
      "Google Drive backup is available in the Android app. You can save a phone backup here.",
    );
  const url = URL.createObjectURL(
    new Blob([text], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
