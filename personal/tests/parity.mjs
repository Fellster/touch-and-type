import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined,
  args: ["--no-sandbox"],
  headless: true,
});
const page = await browser.newPage({
  viewport: { width: 393, height: 852 },
  deviceScaleFactor: 1,
});
const errors = [],
  external = [];
page.on("pageerror", (e) => errors.push(String(e)));
await page.route("**/*", (route) => {
  const url = new URL(route.request().url());
  if (url.hostname === "127.0.0.1") return route.continue();
  external.push(url.origin);
  return route.abort();
});
for (let i = 0; i < 50; i++) {
  try {
    if ((await fetch("http://127.0.0.1:5182/")).ok) break;
  } catch {}
  await new Promise((r) => setTimeout(r, 100));
}
await page.goto("http://127.0.0.1:5182/");
await expect(
  page.getByRole("heading", { name: "To-Do", exact: true }),
).toBeVisible();
await page.getByRole("button", { name: "Add customer", exact: true }).click();
await page.getByLabel("Customer name", { exact: true }).fill("Maria Garcia");
await page.getByLabel("Phone", { exact: true }).fill("8475550104");
await page.getByLabel("Email", { exact: true }).fill("maria@example.com");
await page
  .getByRole("button", { name: "Review and save", exact: true })
  .click();
await expect(
  page.getByRole("button", { name: "Done", exact: true }),
).toBeVisible();
await expect(
  page.getByRole("heading", { name: "My customer notes", exact: true }),
).toHaveCount(0);
await page.getByLabel("Shoe size", { exact: true }).fill("8");
await page.getByLabel("Width", { exact: true }).selectOption("Wide");
await page.getByPlaceholder("Add designers…", { exact: true }).fill("Chanel");
await page.getByRole("button", { name: "Add designers", exact: true }).click();
await page
  .getByPlaceholder("Add wants…", { exact: true })
  .fill("Black loafers");
await page.getByRole("button", { name: "Add wants", exact: true }).click();
await page
  .getByLabel("Customer Notes", { exact: true })
  .fill("Call when size eight arrives.");
await page
  .getByRole("button", { name: "Save Changes", exact: true })
  .first()
  .click();
await expect(
  page.getByRole("button", { name: "Save Changes", exact: true }).first(),
).toBeDisabled();
const png = await page.evaluate(() => {
  const c = document.createElement("canvas");
  c.width = 32;
  c.height = 32;
  c.getContext("2d").fillRect(0, 0, 32, 32);
  return c.toDataURL("image/png").split(",")[1];
});
await page
  .locator("input[type=file]")
  .first()
  .setInputFiles({
    name: "shoe.png",
    mimeType: "image/png",
    buffer: Buffer.from(png, "base64"),
  });
await page.getByRole("button", { name: "Open photo", exact: true }).waitFor();
await page
  .getByRole("button", { name: "Add new drawing", exact: true })
  .click();
const box = await page.getByLabel("Draw with your finger").boundingBox();
await page.mouse.move(box.x + 15, box.y + 15);
await page.mouse.down();
await page.mouse.move(box.x + 80, box.y + 70, { steps: 10 });
await page.mouse.up();
await page.getByRole("button", { name: "Save drawing", exact: true }).click();
await page.getByRole("button", { name: "Open drawing", exact: true }).waitFor();
await page.getByRole("button", { name: "Done", exact: true }).click();
await expect(
  page.getByRole("heading", { name: "Maria Garcia", exact: true }),
).toBeVisible();
await expect(page.getByLabel("Customer name", { exact: true })).toHaveCount(0);
await expect(page.getByRole("link", { name: "847-555-0104" })).toBeVisible();
await page
  .getByRole("button", { name: "Add to-do for this customer", exact: true })
  .click();
await page.getByLabel("To-do", { exact: true }).fill("Call Maria");
await page.getByRole("button", { name: "Save to-do", exact: true }).click();
await expect(page.getByText("Call Maria", { exact: true })).toBeVisible();
await page.screenshot({
  path: "/tmp/noted-personal-reading-v2.png",
  fullPage: true,
});
await page.getByRole("button", { name: "Back", exact: true }).click();
await page.getByLabel("New task", { exact: true }).fill("Second task");
await page.getByRole("button", { name: "Add", exact: true }).click();
await expect(page.getByText("Second task", { exact: true })).toBeVisible();
const handle = page.getByRole("button", {
  name: "Drag to reorder Second task",
  exact: true,
});
await handle.focus();
await handle.press("Space");
await expect(page.locator(".dragging")).toBeVisible();
await handle.press("ArrowUp");
await page.waitForTimeout(200);
await handle.press("Space");
await expect(page.locator(".task-title")).toHaveText([
  "Second task",
  "Call Maria",
]);
await page.reload();
await expect(page.locator(".task-title")).toHaveText([
  "Second task",
  "Call Maria",
]);
await page
  .getByRole("button", { name: "Edit Second task", exact: true })
  .click();
await page
  .getByLabel("Edit task title", { exact: true })
  .fill("Second task revised");
await page.getByLabel("Edit task title", { exact: true }).press("Enter");
await expect(page.locator(".task-title")).toHaveText([
  "Second task revised",
  "Call Maria",
]);
await page.reload();
await expect(page.locator(".task-title")).toHaveText([
  "Second task revised",
  "Call Maria",
]);
await page
  .getByLabel("Due date for Second task revised", { exact: true })
  .fill("2030-11-17T14:30");
await expect(page.locator("time")).toHaveText(/Nov 17, 2030.*2:30 PM/);
await page.reload();
await expect(page.locator("time")).toHaveText(/Nov 17, 2030.*2:30 PM/);
const start = await page
  .getByRole("button", { name: "Drag to reorder Call Maria", exact: true })
  .boundingBox();
const end = await page
  .getByRole("button", {
    name: "Drag to reorder Second task revised",
    exact: true,
  })
  .boundingBox();
await page.mouse.move(start.x + 12, start.y + 12);
await page.mouse.down();
await page.mouse.move(start.x + 12, start.y, { steps: 4 });
await expect(page.locator(".task-overlay")).toBeVisible();
await page.mouse.move(end.x + 12, end.y + 10, { steps: 15 });
await page.mouse.up();
await expect(page.locator(".task-title")).toHaveText([
  "Call Maria",
  "Second task revised",
]);
await page.reload();
await expect(page.locator(".task-title")).toHaveText([
  "Call Maria",
  "Second task revised",
]);
await page.screenshot({
  path: "/tmp/noted-personal-todo-v3.png",
  fullPage: true,
});
await page.getByRole("button", { name: "Designer", exact: true }).click();
await expect(
  page.getByRole("heading", { name: "Chanel", exact: true }),
).toBeVisible();
await page.getByRole("button", { name: "Back", exact: true }).click();
await page.getByRole("button", { name: "Settings", exact: true }).click();
await page.getByRole("button", { name: "Kalam", exact: true }).click();
await expect(
  page.getByRole("button", { name: "Kalam", exact: true }),
).toHaveAttribute("aria-pressed", "true");
await page
  .getByRole("button", { name: "Blue highlights", exact: true })
  .click();
await expect(
  page.getByRole("button", { name: "Blue highlights", exact: true }),
).toHaveAttribute("aria-pressed", "true");
const dl = page.waitForEvent("download");
await page.getByRole("button", { name: "Save backup", exact: true }).click();
await (await dl).saveAs("/tmp/noted-v2-backup.json");
// Restore a previous-format notebook with text in the removed section.
const backup = JSON.parse(await readFile("/tmp/noted-v2-backup.json", "utf8"));
const notebook = JSON.parse(backup.payload);
notebook.customers[0].personalNotes = "Legacy personal note";
backup.payload = JSON.stringify(notebook);
backup.sha256 = createHash("sha256").update(backup.payload).digest("hex");
await writeFile("/tmp/noted-v2-backup.json", JSON.stringify(backup));
await page
  .locator("input[type=file]")
  .nth(1)
  .setInputFiles("/tmp/noted-v2-backup.json");
await expect(
  page.getByRole("button", { name: "Replace notebook", exact: true }),
).toBeDisabled();
const b = page.waitForEvent("download");
await page
  .getByRole("button", { name: "Back up current notebook first", exact: true })
  .click();
await b;
await page
  .getByRole("button", { name: "Replace notebook", exact: true })
  .click();
await expect(
  page.getByText("Notebook restored.", { exact: true }),
).toBeVisible();
await page.getByRole("button", { name: "Back", exact: true }).click();
await page.getByRole("button", { name: "Customers", exact: true }).click();
await page.getByRole("button", { name: /^Maria Garcia/ }).click();
await expect(
  page.getByRole("button", { name: "Open photo", exact: true }),
).toBeVisible();
await expect(
  page.getByRole("button", { name: "Open drawing", exact: true }),
).toBeVisible();
await expect(
  page.getByRole("heading", { name: "My notes", exact: true }),
).toHaveCount(0);
await expect(
  page.getByText("Call when size eight arrives.\n\nLegacy personal note", {
    exact: true,
  }),
).toBeVisible();
await page.getByRole("button", { name: "Edit customer", exact: true }).click();
await expect(page.getByLabel("Customer Notes", { exact: true })).toHaveValue(
  "Call when size eight arrives.\n\nLegacy personal note",
);
await page.getByLabel("Customer name", { exact: true }).fill("Unsaved name");
page.once("dialog", (d) => d.accept());
await page.getByRole("button", { name: "Done", exact: true }).click();
await expect(
  page.getByRole("heading", { name: "Maria Garcia", exact: true }),
).toBeVisible();
await page.getByRole("button", { name: "Back", exact: true }).click();
await page
  .getByRole("button", { name: "Delete Call Maria", exact: true })
  .click();
await page
  .getByRole("button", { name: "Save to notes & delete", exact: true })
  .click();
await expect(page.getByText("Call Maria", { exact: true })).toHaveCount(0);
await page.getByRole("button", { name: "Customers", exact: true }).click();
await page.getByRole("button", { name: /^Maria Garcia/ }).click();
await expect(
  page.getByText(
    "Call when size eight arrives.\nCall Maria\n\nLegacy personal note",
    { exact: true },
  ),
).toBeVisible();
assert.deepEqual(errors, []);
assert.deepEqual(external, []);
console.log(
  "PASS: original quick entry, full customer edit/read, tags, media, linked tasks, drag ordering after reload, designer search, appearance, and protected backup/restore.",
);
await browser.close();
