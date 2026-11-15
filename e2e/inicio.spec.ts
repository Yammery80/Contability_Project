
import { test, expect } from "@playwright/test";

test("La aplicación carga correctamente", async ({ page }) => {
  await page.goto("/");

  await expect(page.locator("body")).toBeVisible();

  await expect(page.locator("body")).not.toBeEmpty();
});

test("La aplicación no muestra una pantalla vacía", async ({ page }) => {
  await page.goto("/");

  const contenido = await page.locator("body").innerText();

  expect(contenido.trim().length).toBeGreaterThan(0);
});
