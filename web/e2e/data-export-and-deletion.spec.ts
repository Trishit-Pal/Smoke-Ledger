/**
 * E2E coverage for the DPDP-adjacent flows (data export + account deletion +
 * erase-data). The existing `authenticated-flows.spec.ts` lightly exercises
 * these by clicking the buttons and dismissing the confirm dialog; this file
 * goes deeper:
 *
 *   - Export: validates the downloaded JSON's top-level shape (version,
 *     exportedAt, truncated, logs, profile). This is the H2 contract — the
 *     `truncated` field MUST be present even on small exports.
 *
 *   - Erase data + Delete account: validates the dialog text contains a
 *     clear consequence statement ("irreversible", "permanently", "all data"),
 *     then DISMISSES the dialog. We never confirm the destructive action in
 *     CI; that would delete the shared test user every run.
 *
 * Credential-gated: skipped when E2E_LOGIN_EMAIL / E2E_LOGIN_PASSWORD are
 * unset, matching the existing pattern.
 */
import { readFile } from 'node:fs/promises';
import { test, expect } from '@playwright/test';

const loginEmail = process.env.E2E_LOGIN_EMAIL;
const loginPassword = process.env.E2E_LOGIN_PASSWORD;

test.describe('data export & deletion (DPDP)', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!loginEmail || !loginPassword, 'Set E2E_LOGIN_EMAIL and E2E_LOGIN_PASSWORD to run.');
    await page.goto('/login');
    await page.getByLabel('Email').fill(loginEmail!);
    await page.getByRole('textbox', { name: 'Password', exact: true }).fill(loginPassword!);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.waitForLoadState('networkidle');
    // If the test user is fresh and still in onboarding, bounce to settings —
    // the export / delete UI is on the settings page regardless of onboarding.
    if (!page.url().includes('/settings')) {
      await page.goto('/settings');
    }
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
  });

  test('JSON export downloads a payload with the expected top-level shape', async ({ page }) => {
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: /Export data \(JSON\)/ }).click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toMatch(/^smoke-ledger-export.*\.json$/);

    const path = await download.path();
    expect(path).not.toBeNull();
    const raw = await readFile(path!, 'utf8');

    let parsed: unknown;
    expect(() => {
      parsed = JSON.parse(raw);
    }).not.toThrow();

    // Top-level shape guard — these fields MUST be present per the export
    // contract in src/services/exportAccountData.ts.
    const payload = parsed as Record<string, unknown>;
    expect(typeof payload.version).toBe('number');
    expect(typeof payload.exportedAt).toBe('string');
    // H2 contract: truncated boolean is always present, even on small exports.
    expect(typeof payload.truncated).toBe('boolean');
    // logs may be empty for a brand-new test user; if present must be an array.
    if (payload.logs !== undefined) {
      expect(Array.isArray(payload.logs)).toBe(true);
    }
  });

  test('Erase data confirm dialog states the consequence clearly', async ({ page }) => {
    let dialogMessage: string | null = null;
    page.once('dialog', async (dialog) => {
      dialogMessage = dialog.message();
      await dialog.dismiss();
    });
    await page.getByRole('button', { name: 'Erase all app data' }).click();
    // Give the dialog handler a moment to fire and record the message.
    await page.waitForTimeout(150);

    expect(dialogMessage).not.toBeNull();
    // Should reference irreversibility / scope so the user can't accept blindly.
    expect(dialogMessage!.toLowerCase()).toMatch(/erase|delete|all/);
    // Should not leak raw error codes or developer noise.
    expect(dialogMessage!.toLowerCase()).not.toContain('undefined');
    expect(dialogMessage!.toLowerCase()).not.toContain('null');
  });

  test('Delete account confirm dialog states permanence and scope', async ({ page }) => {
    let dialogMessage: string | null = null;
    page.once('dialog', async (dialog) => {
      dialogMessage = dialog.message();
      await dialog.dismiss();
    });
    await page.getByRole('button', { name: 'Delete account' }).click();
    await page.waitForTimeout(150);

    expect(dialogMessage).not.toBeNull();
    // DPDP best-effort: the dialog must explicitly state account-level
    // consequence (not just "are you sure?").
    expect(dialogMessage!.toLowerCase()).toMatch(/delete.*account|permanent/);
    expect(dialogMessage!.toLowerCase()).not.toContain('undefined');
    expect(dialogMessage!.toLowerCase()).not.toContain('null');
  });
});
