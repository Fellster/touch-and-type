import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";
const browser = await chromium.launch({
  executablePath:
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined,
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
for (let attempt = 0; attempt < 50; attempt++) {
  try { const response = await fetch("http://127.0.0.1:5182/"); if(response.ok) break; } catch {}
  await new Promise(resolve => setTimeout(resolve, 100));
}
await page.goto("http://127.0.0.1:5182/");
await page.getByRole("button", { name: "+ Add customer", exact: true }).click();
await page.getByLabel("Name", { exact: true }).fill("Maria Garcia");
await page.getByLabel("Phone", { exact: true }).fill("8475550104");
await page.getByLabel("Email", { exact: true }).fill("maria@example.com");
await page.getByLabel("Shoe size", { exact: true }).fill("8");
await page.getByLabel("Width", { exact: true }).fill("Wide");
await page
  .getByLabel("Customer Notes", { exact: true })
  .fill("Black loafers. Call when size eight arrives.");
await page.getByRole("button", { name: "Save customer", exact: true }).click();
await page
  .getByRole("heading", { name: "Maria Garcia", exact: true })
  .waitFor();
assert.equal(await page.getByRole("link", { name: "847-555-0104" }).count(), 1);
await page.getByRole("button", { name: "+ Add", exact: true }).click();
await page.getByLabel("To-do", { exact: true }).fill("Call Maria");
await page.getByRole("button", { name: "Save to-do", exact: true }).click();
await page.getByRole("button", { name: "Call Maria", exact: true }).waitFor();
// Add a real raster picture; it must be copied into the notebook, not kept as a temporary URL.
const fixture = await page.evaluate(() => {
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
    buffer: Buffer.from(fixture, "base64"),
  });
await page.getByRole("button", { name: "Open photo", exact: true }).waitFor();
await page.getByRole("button", { name: "+ Drawing", exact: true }).click();
const box = await page.getByLabel("Draw with your finger").boundingBox();
await page.mouse.move(box.x + 20, box.y + 20);
await page.mouse.down();
await page.mouse.move(box.x + 90, box.y + 80, { steps: 12 });
await page.mouse.up();
await page.getByRole("button", { name: "Save drawing", exact: true }).click();
await page.getByRole("button", { name: "Open drawing", exact: true }).waitFor();
await page.screenshot({
  path: "/tmp/noted-personal-customer.png",
  fullPage: true,
});
await page.getByRole("button", { name: "Back", exact: true }).click();
await page.getByRole("button", { name: "Settings", exact: true }).click();
await page.getByLabel("Highlight color", { exact: true }).selectOption("blue");
await page.getByLabel("Fonts", { exact: true }).selectOption("kalam");
const downloadEvent = page.waitForEvent("download");
await page.getByRole("button", { name: "Save backup", exact: true }).click();
const download = await downloadEvent;
await download.saveAs("/tmp/noted-personal-test-backup.json");
await page.reload();
await page.getByRole("button", { name: "Customers", exact: true }).click();
await page.getByRole("button", { name: /Maria Garcia/ }).click();
await page.getByRole("button", { name: "Open photo", exact: true }).waitFor();
await page.getByRole("button", { name: "Open drawing", exact: true }).waitFor();
await page.getByRole("button", { name: "Edit customer", exact: true }).click();
page.once("dialog", (d) => d.accept());
await page
  .getByRole("button", { name: "Delete customer", exact: true })
  .click();
await page.getByRole("button", { name: "Settings", exact: true }).click();
await page
  .locator("input[type=file]")
  .nth(1)
  .setInputFiles("/tmp/noted-personal-test-backup.json");
await page
  .getByRole("button", { name: "Replace notebook", exact: true })
  .click();
await page.getByRole("button", { name: "Customers", exact: true }).click();
await page.getByRole("button", { name: /Maria Garcia/ }).click();
await page.getByRole("button", { name: "Open photo", exact: true }).waitFor();
await page.getByRole("button", { name: "Open drawing", exact: true }).waitFor();
await page.getByRole("button", { name: "Call Maria", exact: true }).waitFor();
await page.getByRole("button", { name: "Back", exact: true }).click();
await page.getByRole("button", { name: "To-Do", exact: true }).click();
await page.getByRole("button", { name: "+ Add", exact: true }).click();
await page.getByLabel("To-do", { exact: true }).fill("Second task");
await page.getByRole("button", { name: "Save to-do", exact: true }).click();
await page
  .getByRole("button", { name: "Move up Second task", exact: true })
  .click();
await expect(page.locator(".task-text > button:first-child")).toHaveText(["Second task", "Call Maria"]);
await page.reload();
const titles = await page
  .locator(".task-text > button:first-child")
  .allTextContents();
assert.deepEqual(titles, ["Second task", "Call Maria"]);
await page.getByRole("button", { name: "Settings", exact: true }).click();
assert.equal(
  await page.getByLabel("Highlight color", { exact: true }).inputValue(),
  "blue",
);
assert.equal(
  await page.getByLabel("Fonts", { exact: true }).inputValue(),
  "kalam",
);
await page
  .locator("input[type=file]")
  .nth(1)
  .setInputFiles("/tmp/noted-personal-test-backup.json");
assert.equal(
  await page
    .getByRole("button", { name: "Replace notebook", exact: true })
    .isDisabled(),
  true,
);
const secondBackup = page.waitForEvent("download");
await page
  .getByRole("button", { name: "Back up current notebook first", exact: true })
  .click();
await secondBackup;
await page
  .getByRole("button", { name: "Replace notebook", exact: true })
  .click();
await page.getByText("Notebook restored.", { exact: true }).waitFor();
assert.deepEqual(errors, []);
assert.deepEqual(external, []);
console.log(
  "PASS: customer/task creation, photo/drawing save, restart, backup/restore including actual media; no external requests or JS errors.",
);
await browser.close();
