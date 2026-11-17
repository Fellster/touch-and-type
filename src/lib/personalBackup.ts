import { MAX_BACKUP_BYTES, type Notebook, validateNotebook } from "./personalNotebook";
const sha256 = async (s: string) =>
  Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)),
    ),
  )
    .map((x) => x.toString(16).padStart(2, "0"))
    .join("");
export async function encodeBackup(notebook: Notebook): Promise<string> {
  const payload = JSON.stringify(validateNotebook(notebook));
  const result = JSON.stringify({
    format: "noted-personal",
    version: 1,
    createdAt: new Date().toISOString(),
    sha256: await sha256(payload),
    payload,
  });
  if (new TextEncoder().encode(result).length > MAX_BACKUP_BYTES)
    throw new Error(
      "This backup exceeds the 64 MB limit. No records were changed.",
    );
  return result;
}
export async function decodeBackup(text: string): Promise<Notebook> {
  if (new TextEncoder().encode(text).length > MAX_BACKUP_BYTES)
    throw new Error("Backup exceeds the 64 MB limit.");
  const normalized = text.replace(/^\uFEFF/, "").trim();
  if (!normalized)
    throw new Error(
      "This backup file is empty (0 bytes). Create a fresh backup; your notebook is unchanged.",
    );
  if (normalized.startsWith("PK"))
    throw new Error(
      "This is an app installer or ZIP file. Choose a Noted .json backup; your notebook is unchanged.",
    );
  let b;
  try {
    b = JSON.parse(normalized);
  } catch {
    throw new Error(
      "This backup is incomplete or is not a valid Noted backup. Create a fresh backup; your notebook is unchanged.",
    );
  }
  if (
    b?.format !== "noted-personal" ||
    b.version !== 1 ||
    typeof b.payload !== "string" ||
    typeof b.sha256 !== "string"
  )
    throw new Error("Not a supported Noted Personal backup.");
  if ((await sha256(b.payload)) !== b.sha256)
    throw new Error(
      "Backup is damaged. Your current notebook has not been changed.",
    );
  try {
    return validateNotebook(JSON.parse(b.payload));
  } catch {
    throw new Error(
      "The backup contents are incomplete or invalid. Your notebook has not been changed.",
    );
  }
}
