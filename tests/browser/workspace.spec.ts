import { test, expect, type Page } from '@playwright/test';
async function login(page: Page, role: string) { await page.goto('/'); await page.getByLabel('Email address').fill(`${role}@atlas.demo`); await page.getByLabel('Password', { exact: true }).fill('AtlasDemo!2026'); await page.getByRole('button', { name: 'Sign in', exact: true }).click(); await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible(); }
test('admin workspace navigation and no page errors', async ({ page }) => { const errors: string[] = []; page.on('pageerror', e => errors.push(e.message)); await login(page, 'admin'); for (const [url, heading] of [['/', 'Operations overview'], ['/shipments', 'Shipments'], ['/dispatch', 'Dispatch board'], ['/routes', 'Routes & manifests'], ['/fleet', 'Fleet management'], ['/hubs', 'Hubs & warehouse'], ['/customers', 'Customer directory'], ['/billing', 'Invoices & payments'], ['/support', 'Support desk'], ['/reports', 'Performance reports'], ['/team', 'Team & access'], ['/settings', 'Settings & pricing'], ['/audit', 'Audit trail'], ['/notifications', 'Notifications']]) {
    await page.goto(url);
    await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible();
    await expect(page.getByRole('alert')).toHaveCount(0);
} expect(errors).toEqual([]); });
test('customer can quote and book a shipment', async ({ page }) => { await login(page, 'customer'); await page.goto('/shipments/new'); const fields: Record<string, string> = { 'Recipient name': 'Browser Recipient', 'Recipient phone': '+447700900555', 'Pickup street address': '10 Queen Street', 'Pickup city': 'London', 'Pickup latitude': '51.5', 'Pickup longitude': '-0.12', 'Delivery street address': '25 Park Road', 'Delivery city': 'London', 'Delivery latitude': '51.53', 'Delivery longitude': '-0.15', 'Actual weight (kg)': '3', 'Length (cm)': '20', 'Width (cm)': '20', 'Height (cm)': '20', 'Declared value (USD)': '100', 'Pickup date & time': new Date(Date.now() + 86400000).toISOString().slice(0, 16), 'Handling instructions': 'Browser test booking' }; for (const [label, value] of Object.entries(fields))
    await page.getByLabel(label, { exact: true }).fill(value); await page.getByRole('button', { name: 'Calculate quote', exact: true }).click(); await expect(page.locator('.quote-total')).toBeVisible(); await page.getByRole('button', { name: 'Create shipment & invoice' }).click(); await expect(page.getByRole('heading', { name: 'Journey details' })).toBeVisible(); await expect(page.getByText('Browser Recipient', { exact: true })).toBeVisible(); });
test('driver mobile workspace fits viewport and restricts navigation', async ({ page }) => { await page.setViewportSize({ width: 390, height: 844 }); await login(page, 'driver'); await expect(page.getByRole('heading', { name: 'Your delivery workspace' })).toBeVisible(); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true); await page.getByRole('button', { name: 'Open navigation' }).click(); await expect(page.getByRole('link', { name: 'My deliveries', exact: true })).toBeVisible(); await expect(page.getByRole('link', { name: 'Team & access', exact: true })).toHaveCount(0); });
test('unknown public tracking shows an error without exposing data', async ({ page }) => { await page.goto('/track'); await page.getByLabel('Tracking number').fill('ATL-DOES-NOT-EXIST'); await page.getByRole('button', { name: 'Track shipment' }).click(); await expect(page.getByRole('alert')).toContainText('Tracking number not found'); });

test('dark mode persists and View invoice opens a dedicated page', async ({page})=>{
 await page.goto('/');
 if(await page.getByRole('button',{name:'Switch to dark mode'}).count())await page.getByRole('button',{name:'Switch to dark mode'}).click();
 await page.reload();await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
 await login(page,'admin');await page.goto('/billing');
 await page.getByRole('link',{name:'View invoice',exact:true}).first().click();
 await expect(page).toHaveURL(/\/billing\/[^/]+$/);
 await expect(page.getByRole('heading',{name:'Invoice summary'})).toBeVisible();
 await page.reload();await expect(page.getByRole('heading',{name:'Invoice summary'})).toBeVisible();
 await page.setViewportSize({width:390,height:844});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.getByRole('button',{name:'Switch to light mode'}).click();
 await expect(page.locator('html')).toHaveAttribute('data-theme','light');
});
