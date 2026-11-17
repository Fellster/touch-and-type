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
await page.evaluate(() => document.fonts.ready);
await handle.scrollIntoViewIfNeeded();
await page.waitForTimeout(250);
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
await expect(page.locator("h1")).toHaveCSS("font-family", /ui-serif/);
await expect(page.locator("h1")).toHaveCSS("font-size", "22px");
const titleRect = await page.locator("h1").boundingBox();
assert.ok(titleRect.x < 100);
const choices = page.locator(".font-grid .font-choice");
const first = await choices.nth(0).boundingBox(),
  second = await choices.nth(1).boundingBox();
assert.equal(first.y, second.y);
assert.ok(second.x > first.x);
await page.getByRole("button", { name: "Chicago Cubs", exact: true }).click();
await page.getByRole("button", { name: "Manrope", exact: true }).click();
await expect(
  page.getByRole("button", { name: "Manrope", exact: true }),
).toHaveAttribute("aria-pressed", "true");
await page.evaluate(() => document.fonts.ready);
await page.screenshot({
  path: "/tmp/noted-personal-settings-v5.png",
  fullPage: true,
});
const cdp = await page.context().newCDPSession(page);
await cdp.send("DOM.enable");
await cdp.send("CSS.enable");
for (const font of ["Inter", "Lora", "Manrope", "Kalam"]) {
  await page.getByRole("button", { name: font, exact: true }).click();
  await expect(
    page.getByRole("button", { name: font, exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".font-choice[aria-pressed=true]")).toHaveCSS(
    "font-family",
    new RegExp(font),
  );
  for (const weight of font === "Kalam" ? [400] : [400, 500, 600]) {
    await page.evaluate(
      async ({ font, weight }) => {
        const faces = await document.fonts.load(`${weight} 16px "${font}"`);
        if (!faces.length || faces.some((f) => f.status !== "loaded"))
          throw Error("Font did not load locally");
      },
      { font, weight },
    );
  }
  const { root } = await cdp.send("DOM.getDocument");
  const { nodeId } = await cdp.send("DOM.querySelector", {
    nodeId: root.nodeId,
    selector: ".font-choice[aria-pressed=true]",
  });
  const result = await cdp.send("CSS.getPlatformFontsForNode", { nodeId });
  assert.ok(
    result.fonts.some((f) => f.isCustomFont && f.familyName.startsWith(font)),
    JSON.stringify(result),
  );
  const styles = await page
    .locator(".font-choice[aria-pressed=true]")
    .evaluate((el) => ({
      family: getComputedStyle(el).fontFamily,
      spacing: getComputedStyle(el).letterSpacing,
    }));
  assert.ok(styles.family.includes(font));
}
for (const theme of ["Hardcore Punk", "Gallery", "Botanical"]) {
  await page.getByRole("button", { name: theme, exact: true }).click();
  await expect(
    page.getByRole("button", { name: theme, exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator(".task-title").first()).toHaveCSS(
    "font-size",
    "14px",
  );
  await expect(page.locator(".task-title")).toHaveText([
    "Call Maria",
    "Second task revised",
  ]);
  const themeKey = await page.locator(".app").getAttribute("data-theme");
  if (themeKey === "punk") {
    const colors = await page
      .locator(".customer-link")
      .first()
      .evaluate((el) => ({
        color: getComputedStyle(el).color,
        background: getComputedStyle(el.closest(".card")).backgroundColor,
      }));
    assert.equal(colors.color, "rgb(23, 23, 23)");
    assert.notEqual(colors.color, colors.background);
  }
  await page.screenshot({
    path: `/tmp/noted-theme-${themeKey}.png`,
    fullPage: true,
  });
  await page.reload();
  await expect(page.locator(".app")).toHaveAttribute("data-theme", themeKey);
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  await page.getByRole("button", { name: "Customers", exact: true }).click();
  await page.getByRole("button", { name: /^Maria Garcia/ }).click();
  await expect(
    page.getByRole("button", { name: "Open photo", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Edit customer", exact: true })
    .click();
  await expect(page.getByLabel("Customer Notes", { exact: true })).toHaveValue(
    "Call when size eight arrives.",
  );
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
}
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
await page
  .getByRole("button", { name: "Back up to phone", exact: true })
  .click();
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
await page.getByRole("button", { name: "Back", exact: true }).click();
await page.getByRole("button", { name: "Settings", exact: true }).click();
for (const [original, name] of [
  ["Designers", "Brands"],
  ["Shoe size", "Size"],
  ["Width", "Fit"],
  ["Wants", "Wishlist"],
])
  await page
    .getByLabel("Field name for " + original, { exact: true })
    .fill(name);
await page
  .getByRole("button", { name: "Save field names", exact: true })
  .click();
await expect(
  page.getByRole("button", { name: "Save field names", exact: true }),
).toBeDisabled();
await page.reload();
await page.getByRole("button", { name: "Settings", exact: true }).click();
await expect(
  page.getByLabel("Field name for Designers", { exact: true }),
).toHaveValue("Brands");
const labelDownload = page.waitForEvent("download");
await page
  .getByRole("button", { name: "Back up to phone", exact: true })
  .click();
await (await labelDownload).saveAs("/tmp/noted-labels-backup.json");
const labelBackup = JSON.parse(
  await readFile("/tmp/noted-labels-backup.json", "utf8"),
);
assert.deepEqual(JSON.parse(labelBackup.payload).settings.labels, {
  designers: "Brands",
  shoe_size: "Size",
  width: "Fit",
  looking_for: "Wishlist",
});
await page.getByRole("button", { name: "Back", exact: true }).click();
await page.getByRole("button", { name: "Brands", exact: true }).click();
await expect(
  page.getByRole("heading", { name: "Brands", exact: true }),
).toBeVisible();
await expect(
  page.getByRole("heading", { name: "Chanel", exact: true }),
).toBeVisible();
await page.getByRole("button", { name: "Back", exact: true }).click();
await page.getByRole("button", { name: "Customers", exact: true }).click();
await page.getByRole("button", { name: /^Maria Garcia/ }).click();
for (const label of ["Size", "Fit", "Brands", "Wishlist"])
  await expect(page.getByText(label, { exact: true })).toBeVisible();
await page.getByRole("button", { name: "Edit customer", exact: true }).click();
await expect(page.getByLabel("Size", { exact: true })).toHaveValue("8");
await expect(page.getByLabel("Fit", { exact: true })).toHaveValue("Wide");
await expect(
  page.getByPlaceholder("Add brands…", { exact: true }),
).toBeVisible();
await expect(
  page.getByPlaceholder("Add wishlist…", { exact: true }),
).toBeVisible();
await page.getByRole("button", { name: "Done", exact: true }).click();
await page.getByRole("button", { name: "Back", exact: true }).click();
await page.getByRole("button", { name: "Settings", exact: true }).click();
await page
  .getByRole("button", { name: "Reset field names", exact: true })
  .click();
await expect(
  page.getByLabel("Field name for Designers", { exact: true }),
).toHaveValue("Designers");
await page
  .getByRole("button", { name: "Back up to Google Drive", exact: true })
  .click();
await expect(
  page.getByText(
    "Google Drive backup is available in the Android app. You can save a phone backup here.",
    { exact: true },
  ),
).toBeVisible();
await page.getByRole("button", { name: "Back", exact: true }).click();
await expect(
  page.getByRole("button", {
    name: "Add Second task revised to calendar",
    exact: true,
  }),
).toBeVisible();
await expect(page.locator(".brand svg path")).toHaveCount(1);
await expect(page.locator(".brand svg circle")).toHaveCount(0);
await expect(page.locator(".brand svg rect")).toHaveCount(0);
await page.getByRole("button", { name: "Customers", exact: true }).click();
await page.getByRole("button", { name: /^Maria Garcia/ }).click();
await expect(
  page.getByRole("button", { name: "Take photo", exact: true }),
).toBeVisible();
await expect(
  page.getByRole("button", { name: "Add photo", exact: true }),
).toBeVisible();
await expect(
  page.getByLabel("Take customer photo", { exact: true }),
).toHaveAttribute("capture", "environment");
await page.getByLabel("Take customer photo", { exact: true }).setInputFiles({
  name: "camera-photo.jpg",
  mimeType: "image/jpeg",
  buffer: Buffer.from(png, "base64"),
});
await expect(page.locator(".media-grid-photo .media-tile")).toHaveCount(2);
await expect(page.locator(".media-grid-photo img").first()).toHaveCSS(
  "object-fit",
  "cover",
);
await page
  .getByRole("button", { name: "Open photo", exact: true })
  .first()
  .click();
await expect(page.locator(".full-picture")).toBeVisible();
await page.getByRole("button", { name: "Close dialog", exact: true }).click();
await page.reload();
await page.getByRole("button", { name: "Customers", exact: true }).click();
await page.getByRole("button", { name: /^Maria Garcia/ }).click();
await expect(page.locator(".media-grid-photo .media-tile")).toHaveCount(2);
await page.screenshot({
  path: "/tmp/noted-clean-photos-v8.png",
  fullPage: true,
});
await page.getByRole("button", { name: "Back", exact: true }).click();
await page.getByRole("button", { name: "Settings", exact: true }).click();
await page
  .locator("input[type=file]")
  .nth(1)
  .setInputFiles({
    name: "empty.json",
    mimeType: "application/json",
    buffer: Buffer.from(""),
  });
await expect(
  page.getByText(/This backup file is empty \(0 bytes\)/),
).toBeVisible();
await expect(
  page.getByRole("button", { name: "Replace notebook", exact: true }),
).toHaveCount(0);
await page
  .locator("input[type=file]")
  .nth(1)
  .setInputFiles({
    name: "incomplete.json",
    mimeType: "application/json",
    buffer: Buffer.from('{"format":'),
  });
await expect(
  page.getByText(/This backup is incomplete or is not a valid Noted backup/),
).toBeVisible();
await expect(
  page.getByRole("button", { name: "Replace notebook", exact: true }),
).toHaveCount(0);
await page.getByRole("button", { name: "Back", exact: true }).click();
await page.getByRole("button", { name: "Customers", exact: true }).click();
await page.getByRole("button", { name: /^Maria Garcia/ }).click();
await expect(page.locator(".media-grid-photo .media-tile")).toHaveCount(2);
assert.deepEqual(errors, []);
assert.deepEqual(external, []);
console.log(
  "PASS: original quick entry, full customer edit/read, tags, media, linked tasks, drag ordering after reload, designer search, appearance, and protected backup/restore.",
);
await browser.close();
