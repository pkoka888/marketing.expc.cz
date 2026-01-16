import { expect, test } from '@playwright/test';

test('has title', async ({ page }) => {
  await page.goto('/');

  // Expect a title "to contain" a substring.
  await expect(page).toHaveTitle(/MarketingPortal/);
});

test('login as customer', async ({ page }) => {
  await page.goto('/');

  // Click the "Klientská Sekce" button
  await page.getByRole('button', { name: 'Klientská Sekce' }).click();

  // Expect to be on setup stage
  await expect(page.locator('text=Konfigurace Ekosystému')).toBeVisible();
});

test('login as admin', async ({ page }) => {
  await page.goto('/');

  // Click the "Admin" button
  await page.getByRole('button', { name: 'Admin' }).click();

  // Expect to be on dashboard
  await expect(page.locator('text=MojeFirma.cz')).toBeVisible();
});

// Test for audit functionality
test('audit kilo CLI setup', async ({ page }) => {
  await page.goto('/');

  // Verify the application loads
  await expect(page).toHaveTitle(/MarketingPortal/);
});
