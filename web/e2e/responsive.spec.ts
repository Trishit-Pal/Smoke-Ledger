/**
 * Responsive / adaptive guard (v3). For every page × viewport it asserts:
 *   1. no horizontal overflow (WCAG 1.4.10 reflow — 320 CSS px ≙ 1280 @ 400% zoom);
 *   2. controls ≥44×44 (PRODUCT.md target); every other target meets WCAG 2.5.8 AA
 *      (≥24px or the spacing exception; inline links in running text exempt);
 *   3. form controls ≥16px font on touch devices (iOS zooms the page otherwise);
 * plus one WCAG 1.4.12 text-spacing pass and a discreet-mode masking check on a
 * wide layout.
 *
 * Logged-in pages run ONLY against a local Supabase stack (CI `responsive-e2e`
 * job). Never prod: `isLocalStack()` gates them even when a service key is set.
 */
import { test, expect, type Page, type TestInfo } from '@playwright/test';
import {
  canSeed,
  createConfirmedUser,
  deleteUser,
  getAdmin,
  istYmdDaysAgo,
  markOnboarded,
  seedLogs,
  SUPABASE_URL,
  type SeededUser,
} from './_helpers/seed';
import { login } from './_helpers/fixtures';

const PUBLIC_ROUTES = ['/', '/privacy', '/terms', '/support', '/login', '/signup', '/reset'];
const APP_ROUTES = ['/dashboard', '/history', '/trends', '/goals', '/settings', '/log/new'];
const ONBOARDING_ROUTES = ['/onboarding', '/onboarding/privacy'];
/** Seeded brand: distinctive so its absence under discreet mode proves masking, not a miss. */
const SEEDED_BRAND = 'Zyxwv Reserve';

/** Desktop engines sweep every class; device projects keep their own viewport + its landscape. */
const SWEEP = [
  { width: 320, height: 640 },
  { width: 375, height: 812 },
  { width: 568, height: 320 }, // phone, landscape
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },
  { width: 1440, height: 900 },
  { width: 2560, height: 1440 },
];

/** Firefox shares layout behaviour with Chromium at most widths; 3 classes keep CI minutes down. */
const FIREFOX_SWEEP = [SWEEP[0], SWEEP[3], SWEEP[5]];

function viewportsFor(page: Page, info: TestInfo) {
  const own = page.viewportSize();
  if (info.project.use.isMobile && own) return [own, { width: own.height, height: own.width }];
  return info.project.name.includes('firefox') ? FIREFOX_SWEEP : SWEEP;
}

function isLocalStack(): boolean {
  try {
    return ['127.0.0.1', 'localhost'].includes(new URL(SUPABASE_URL).hostname);
  } catch {
    return false;
  }
}

interface Issue {
  kind: 'overflow' | 'target' | 'input-font';
  detail: string;
}

/** Runs in the page. Returns every violation so one failure lists them all. */
async function audit(page: Page, checkInputFont: boolean): Promise<Issue[]> {
  return page.evaluate((checkFont) => {
    const issues: { kind: 'overflow' | 'target' | 'input-font'; detail: string }[] = [];
    const doc = document.documentElement;
    if (doc.scrollWidth > doc.clientWidth + 1) {
      // Name the widest offender so the failure is actionable.
      let worst = '';
      let worstRight = doc.clientWidth;
      for (const el of Array.from(document.body.querySelectorAll<HTMLElement>('*'))) {
        const r = el.getBoundingClientRect();
        if (r.right > worstRight + 1 && getComputedStyle(el).position !== 'fixed') {
          worstRight = r.right;
          worst = `${el.tagName.toLowerCase()}.${String(el.className).slice(0, 60)}`;
        }
      }
      issues.push({ kind: 'overflow', detail: `scrollWidth ${doc.scrollWidth} > ${doc.clientWidth}; widest: ${worst}` });
    }
    // Content clipped by an overflow:hidden ancestor (e.g. the onboarding <main>)
    // never grows scrollWidth, so also flag text/controls whose box crosses the
    // viewport edge — unless they sit in an intentional horizontal scroller.
    const scrollsX = (el: Element | null): boolean => {
      for (let n = el?.parentElement; n; n = n.parentElement) {
        const ox = getComputedStyle(n).overflowX;
        if (ox === 'auto' || ox === 'scroll') return true;
      }
      return false;
    };
    for (const el of Array.from(document.body.querySelectorAll<HTMLElement>('*'))) {
      const hasText = Array.from(el.childNodes).some((c) => c.nodeType === 3 && c.textContent!.trim() !== '');
      const isControl = /^(BUTTON|INPUT|SELECT|TEXTAREA|A)$/.test(el.tagName);
      if (!hasText && !isControl) continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.right <= doc.clientWidth + 1 || r.left >= doc.clientWidth) continue;
      if (el.closest('[aria-hidden="true"]') || getComputedStyle(el).position === 'fixed' || scrollsX(el)) continue;
      issues.push({ kind: 'overflow', detail: `clipped at right edge (${Math.round(r.right)} > ${doc.clientWidth}): <${el.tagName.toLowerCase()}> "${(el.textContent || '').trim().slice(0, 40)}"` });
      break; // one per page is enough to act on
    }

    const visible = (el: Element) => {
      const s = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      // ≤1px boxes are the sr-only pattern (skip links) — not a visual target.
      return s.visibility !== 'hidden' && s.display !== 'none' && r.width > 1 && r.height > 1 && !el.closest('[aria-hidden="true"], [inert]');
    };
    const label = (el: Element) =>
      (el.getAttribute('aria-label') || el.textContent || el.tagName).trim().replace(/\s+/g, ' ').slice(0, 40);

    const targets = Array.from(
      document.querySelectorAll(
        'button, [role="button"], [role="switch"], [role="tab"], select, textarea, input:not([type="hidden"]), a[href]',
      ),
    ).filter(visible);
    // Measured box: checkbox/radio are hit through their <label>; `.hit-target`
    // grows the tap area to ≥44 with an invisible ::after.
    const measured = targets.map((el) => {
      const isBox = el instanceof HTMLInputElement && (el.type === 'checkbox' || el.type === 'radio');
      const box = isBox ? el.closest('label') ?? el : el;
      const r = box.getBoundingClientRect();
      const grown = box.classList.contains('hit-target') ? 44 : 0;
      return { el, w: Math.max(r.width, grown), h: Math.max(r.height, grown), cx: r.left + r.width / 2, cy: r.top + r.height / 2 };
    });
    for (const t of measured) {
      const { el, w, h } = t;
      // WCAG 2.5.8 "inline" exception: a link inside running text.
      const inline = el.tagName === 'A' && !!el.closest('p, li, dd, small, label, figcaption, blockquote');
      const isRange = el instanceof HTMLInputElement && el.type === 'range';
      const isControl = el.tagName !== 'A' && !isRange;
      // Project target (PRODUCT.md): controls ≥44×44.
      if (isControl && (w + 0.5 < 44 || h + 0.5 < 44)) {
        issues.push({ kind: 'target', detail: `${Math.round(w)}×${Math.round(h)} < 44: <${el.tagName.toLowerCase()}> "${label(el)}"` });
      } else if (!inline && (w + 0.5 < 24 || h + 0.5 < 24)) {
        // AA floor 24, unless the spacing exception holds: no other target's
        // centre within 24px (non-overlapping 24px circles).
        const crowded = measured.some((o) => o !== t && Math.hypot(o.cx - t.cx, o.cy - t.cy) < 24);
        if (crowded) {
          issues.push({ kind: 'target', detail: `${Math.round(w)}×${Math.round(h)} < 24 and crowded: <${el.tagName.toLowerCase()}> "${label(el)}"` });
        }
      }
      if (checkFont && /^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName) && !isRange && el.getAttribute('type') !== 'checkbox' && el.getAttribute('type') !== 'radio') {
        const fs = parseFloat(getComputedStyle(el).fontSize);
        if (fs < 16) issues.push({ kind: 'input-font', detail: `${fs}px <${el.tagName.toLowerCase()}> "${label(el)}"` });
      }
    }
    return issues;
  }, checkInputFont);
}

/**
 * `goto` that tolerates the previous page still navigating. After `networkidle`
 * Next's router keeps prefetching <Link> targets (and the dev server compiles
 * them on demand); under load that late navigation interrupts the next goto
 * ("Navigation to X is interrupted by another navigation to Y", where Y is the
 * page we just left). Never seen in CI across two full runs; seen locally with
 * four engines on one dev server. One retry on exactly that error.
 */
async function gotoSettled(page: Page, route: string) {
  try {
    await page.goto(route, { waitUntil: 'networkidle', timeout: 90_000 });
  } catch (e) {
    if (!(e instanceof Error) || !/interrupted by another navigation/.test(e.message)) throw e;
    await page.waitForLoadState('networkidle');
    await page.goto(route, { waitUntil: 'networkidle', timeout: 90_000 });
  }
}

async function sweep(page: Page, routes: string[], info: TestInfo) {
  const failures: string[] = [];
  const isMobile = !!info.project.use.isMobile;
  for (const vp of viewportsFor(page, info)) {
    await page.setViewportSize(vp);
    for (const route of routes) {
      await gotoSettled(page, route);
      await page.evaluate(() => document.fonts.ready);
      // Auditing whatever page a redirect landed on (e.g. a lost session → /login)
      // would pass silently. Onboarding may forward within the wizard.
      const landed = new URL(page.url()).pathname;
      const ok = landed === route || (route.startsWith('/onboarding') && landed.startsWith('/onboarding'));
      if (!ok) {
        failures.push(`${vp.width}×${vp.height} ${route} redirected to ${landed}`);
        continue;
      }
      for (const i of await audit(page, isMobile)) {
        failures.push(`${vp.width}×${vp.height} ${new URL(page.url()).pathname} [${i.kind}] ${i.detail}`);
      }
    }
  }
  expect(failures, failures.join('\n')).toEqual([]);
}

// The dev server compiles each route on first hit; WebKit/Firefox can time out
// waiting on that, so compile everything once per worker before any sweep.
/**
 * Discreet mode: the user's own totals are masked, so no currency amount may be
 * visible in the ledger. Public-health facts ("costs around ₹1.4 lakh per
 * year") are not the user's data and are excluded by their section label.
 */
async function expectNoLedgerMoney(page: Page) {
  const main = page.locator('#main-content');
  await expect(main).toContainText('•••');
  // Recharts measures its container after mount and only then draws axis
  // ticks, so `networkidle` fires before any axis text exists. On pages with
  // a chart, wait for the first y-axis tick to be drawn before reading the DOM.
  if ((await main.locator('.recharts-responsive-container').count()) > 0) {
    await expect(main.locator('.recharts-yAxis .recharts-cartesian-axis-tick-value').first()).toBeVisible();
  }
  const { money, tableDigits, labelDigits, brandHits, tableCount } = await main.evaluate((root, brand) => {
    const clone = root.cloneNode(true) as HTMLElement;
    clone.querySelectorAll('[aria-label="Did you know facts"]').forEach((n) => n.remove());
    const m = (clone.textContent ?? '').match(/[₹€]\s?\d[\d,.]*|\d[\d,.]*\s?[₹€]/);
    // Chart data tables are sr-only: screen readers would read raw figures aloud.
    const tables = Array.from(clone.querySelectorAll('table.sr-only'));
    const tableDigits = tables.flatMap((t) =>
      Array.from(t.querySelectorAll('td'))
        .map((td) => td.textContent ?? '')
        .filter((txt) => /\d/.test(txt)),
    );
    // Chart wrappers only, so dates and nav labels are not caught. A clock time
    // ("at 15:00", the heatmap's busiest hour) is not a count; strip it first.
    const labelDigits = Array.from(clone.querySelectorAll('[role="img"][aria-label], svg [aria-label]'))
      .map((el) => (el.getAttribute('aria-label') ?? '').replace(/\d{1,2}:\d{2}/g, ''))
      .filter((txt) => /\d/.test(txt));
    // innerHTML also covers title/aria-label attributes, not just visible text.
    const brandHits = clone.innerHTML.split(brand).length - 1;
    return { money: m ? m[0] : null, tableDigits, labelDigits, brandHits, tableCount: tables.length };
  }, SEEDED_BRAND);
  const where = new URL(page.url()).pathname;
  expect(money, `discreet mode leaked "${money}" on ${where}`).toBeNull();
  expect(tableDigits, `sr-only chart table cells leaked digits on ${where}`).toEqual([]);
  expect(labelDigits, `chart aria-labels leaked digits on ${where}`).toEqual([]);
  expect(brandHits, `seeded brand name leaked ${brandHits}x on ${where}`).toBe(0);
  return { tableCount };
}

test.beforeAll(async ({ playwright }, info) => {
  test.setTimeout(300_000);
  const ctx = await playwright.request.newContext({ baseURL: info.project.use.baseURL });
  for (const route of [...PUBLIC_ROUTES, ...APP_ROUTES, ...ONBOARDING_ROUTES]) {
    await ctx.get(route, { timeout: 120_000, maxRedirects: 0 }).catch(() => undefined);
  }
  await ctx.dispose();
});

test.beforeEach(async ({ page }) => {
  // Each test gets its own client IP: sign-in is rate limited per IP (10 / 10 min,
  // web/lib/auth/authRateLimitKeys.ts), and 5 projects × 2 sign-ins from one runner
  // IP would trip it mid-run. Test-only; on Vercel the edge sets this header.
  const octet = () => Math.floor(Math.random() * 250) + 1;
  await page.setExtraHTTPHeaders({ 'x-forwarded-for': `10.${octet()}.${octet()}.${octet()}` });
  // Reveals (editorial-stage) use transforms that briefly widen scrollable
  // overflow mid-animation; the WebGL backdrop also opts out under reduce.
  await page.emulateMedia({ reducedMotion: 'reduce' });
});

test.describe('responsive · public & auth pages', () => {
  test('every viewport fits', async ({ page }, info) => {
    test.setTimeout(480_000);
    await sweep(page, PUBLIC_ROUTES, info);
  });

  test('WCAG 1.4.12 text spacing does not break reflow at 320px', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop-chromium' && info.project.name !== 'chromium', 'one engine is enough');
    await page.setViewportSize({ width: 320, height: 640 });
    for (const route of PUBLIC_ROUTES) {
      await gotoSettled(page, route);
      await page.addStyleTag({
        content:
          '* { line-height: 1.5 !important; letter-spacing: 0.12em !important; word-spacing: 0.16em !important; } p { margin-bottom: 2em !important; }',
      });
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, `${route} overflows by ${overflow}px with WCAG text spacing`).toBeLessThanOrEqual(1);
    }
  });
});

test.describe('responsive · logged-in pages (local Supabase only)', () => {
  test.skip(!canSeed() || !isLocalStack(), 'needs a local Supabase stack + service role (CI responsive-e2e job)');

  let onboarded: SeededUser;
  let fresh: SeededUser;

  test.beforeAll(async () => {
    onboarded = await createConfirmedUser('resp-onb');
    await markOnboarded(onboarded.id, { onboardedAt: istYmdDaysAgo(400), baselinePerDay: 10 });
    // Real-looking history so charts, KPI numerals and the ledger render at full width.
    await seedLogs(
      onboarded.id,
      Array.from({ length: 21 }, (_, d) => ({
        localDate: istYmdDaysAgo(d),
        quantity: 1 + (d % 4),
        totalPriceInr: 18 * (1 + (d % 4)),
        localHour: 8 + (d % 12),
        brandNameSnap: SEEDED_BRAND,
      })),
    );
    fresh = await createConfirmedUser('resp-fresh');
  });

  test.afterAll(async () => {
    if (onboarded) await deleteUser(onboarded.id);
    if (fresh) await deleteUser(fresh.id);
  });

  test('app pages fit every viewport; discreet mode masks the wide layout', async ({ page }, info) => {
    test.setTimeout(600_000);
    await login(page, onboarded); // one sign-in covers both checks
    await sweep(page, APP_ROUTES, info);

    const admin = getAdmin()!;
    await admin.from('user_profiles').update({ discreet_mode: true }).eq('id', onboarded.id);
    // Fresh page: WebKit (tablet-safari) hit an internal error on goto right
    // after the sweep's 12 viewport/route changes. The session cookie is on
    // the context, so the new page is still signed in.
    // ponytail: if WebKit still crashes here, pin this check to desktop-chromium.
    const fresh = await page.context().newPage();
    try {
      await fresh.setViewportSize({ width: 1440, height: 900 });
      // /trends too: its charts render money on axes and tooltips, not only in
      // headline numerals, and a masked heading over an unmasked axis is a leak.
      for (const route of ['/dashboard', '/trends']) {
        await gotoSettled(fresh, route);
        const { tableCount } = await expectNoLedgerMoney(fresh);
        // Not vacuous: Trends renders chart data tables, so the digit check had something to scan.
        if (route === '/trends') expect(tableCount).toBeGreaterThan(0);
      }
    } finally {
      await fresh.close();
      await admin.from('user_profiles').update({ discreet_mode: false }).eq('id', onboarded.id);
    }
  });

  test('onboarding pages fit every viewport', async ({ page }, info) => {
    test.setTimeout(300_000);
    await login(page, fresh);
    await sweep(page, ONBOARDING_ROUTES, info);
  });
});
