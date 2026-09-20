import { expect, test, type APIRequestContext, type Page } from '@playwright/test'
import { apiRequest, getAuthToken, withCredentialIsolatedRequest } from '@open-mercato/core/helpers/integration/api'
import {
  createRoleFixture,
  createUserFixture,
  deleteRoleIfExists,
  deleteUserIfExists,
  setRoleAclFeatures,
} from '@open-mercato/core/helpers/integration/authFixtures'
import { getTokenContext, readJsonSafe } from '@open-mercato/core/helpers/integration/generalFixtures'

/**
 * TC-RDN-002 (#34): the `/backend/rdn-forecast` panel route, its navigation entry
 * and its server-side ACL.
 *
 * The route — not the UI — is the subject. The first three tests hit the page URL
 * and the nav API directly with a session cookie built from a minted token, so
 * hiding or showing the sidebar link cannot make them pass. The last two then walk
 * the same route in a real browser, where the denial text and the empty state are
 * asserted against rendered DOM rather than raw markup.
 *
 * Why the split: the served HTML embeds the whole translation dictionary, so every
 * localized string is present in the response body no matter what was rendered.
 * Raw-HTML assertions therefore key on `data-testid="rdn-forecast-panel"`, which
 * only the panel emits; prose is asserted through the DOM.
 *
 * Each test creates its own role and user with a timestamp suffix and removes both
 * in `finally`; nothing here relies on seeded data.
 */

const PANEL_PATH = '/backend/rdn-forecast'
const PASSWORD = 'Rdn-Panel-1!'
const PANEL_MARKER = 'data-testid="rdn-forecast-panel"'
// The instance may serve either locale; both spellings of the same string are
// accepted so the proof does not depend on the sandbox's locale configuration.
const PANEL_TITLE = /Prognoza RDN|RDN Forecast/
const EMPTY_STATE = /Brak danych prognozy|No forecast data/
const ACCESS_DENIED = /Brak dostępu|Access Denied/

type Fixture = { roleId: string; userId: string; token: string; email: string }

type NavItem = { href?: string; title?: string; children?: NavItem[] }
type NavBody = { groups?: Array<{ name?: string; items?: NavItem[] }> }

async function createUserWithFeatures(
  request: APIRequestContext,
  adminToken: string,
  label: string,
  features: string[],
): Promise<Fixture> {
  const { organizationId } = getTokenContext(adminToken)
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const roleId = await createRoleFixture(request, adminToken, { name: `rdn-panel-${label}-${stamp}` })
  await setRoleAclFeatures(request, adminToken, { roleId, features })
  const email = `rdn-panel-${label}-${stamp}@example.com`
  const userId = await createUserFixture(request, adminToken, {
    email,
    password: PASSWORD,
    organizationId,
    roles: [roleId],
    name: `RDN panel ${label}`,
  })
  const token = await getAuthToken(request, email, PASSWORD)
  return { roleId, userId, token, email }
}

async function cleanup(request: APIRequestContext, adminToken: string, fixture: Fixture | null): Promise<void> {
  await deleteUserIfExists(request, adminToken, fixture?.userId ?? null)
  await deleteRoleIfExists(request, adminToken, fixture?.roleId ?? null)
}

/**
 * Fetches the panel from a jar that never saw a login, carrying nothing but the
 * one session cookie this call builds.
 *
 * The cookie is set explicitly rather than inherited from `/api/auth/login`: the
 * app under test runs in production mode, so it marks `auth_token` `Secure`, and
 * an http request context silently drops it — every page request would then come
 * back as the login screen and the guard would never be exercised.
 */
async function fetchPanelWithSession(token: string): Promise<{ status: number; url: string; html: string }> {
  return withCredentialIsolatedRequest(async (context) => {
    const response = await context.get(PANEL_PATH, { headers: { Cookie: `auth_token=${token}` } })
    return { status: response.status(), url: response.url(), html: await response.text() }
  })
}

function collectHrefs(items: NavItem[] | undefined): string[] {
  const hrefs: string[] = []
  for (const item of items ?? []) {
    if (typeof item.href === 'string') hrefs.push(item.href)
    hrefs.push(...collectHrefs(item.children))
  }
  return hrefs
}

async function navHrefs(request: APIRequestContext, token: string): Promise<string[]> {
  const response = await apiRequest(request, 'GET', '/api/auth/admin/nav', { token })
  expect(response.status(), 'GET /api/auth/admin/nav').toBe(200)
  const body = await readJsonSafe<NavBody>(response)
  return (body?.groups ?? []).flatMap((group) => collectHrefs(group.items))
}

/** Suppresses the demo/cookie notices that would otherwise cover the sidebar. */
async function acknowledgeNotices(page: Page): Promise<void> {
  const url = process.env.BASE_URL || 'http://localhost:3000'
  await page.context().addCookies(
    ['om_demo_notice_ack', 'om_cookie_notice_ack', 'om_feedback_suppress'].map((name) => ({
      name,
      value: name === 'om_feedback_suppress' ? '1' : 'ack',
      url,
      sameSite: 'Lax' as const,
    })),
  )
}

async function loginInBrowser(page: Page, email: string): Promise<void> {
  await acknowledgeNotices(page)
  await page.goto('/login', { waitUntil: 'domcontentloaded' })
  // Label text is translated, so both served spellings are accepted here too.
  await page.getByLabel(/^E-?mail$/i).first().fill(email)
  const password = page.getByLabel(/^(Password|Hasło)$/i).first()
  await password.fill(PASSWORD)
  // Click 1 of the <= 3: submitting the login form.
  await password.press('Enter')
  await page.waitForURL(/\/backend(?:\/.*)?$/, { timeout: 30_000 })
}

test.describe('TC-RDN-002: rdn_forecast panel route, navigation and ACL', () => {
  test('anonymous visit to the panel is redirected into the login flow with the target preserved', async () => {
    await withCredentialIsolatedRequest(async (context) => {
      const firstHop = await context.get(PANEL_PATH, { maxRedirects: 0 })
      expect([302, 307, 308], `GET ${PANEL_PATH} without a session`).toContain(firstHop.status())
      const location = firstHop.headers()['location'] ?? ''
      expect(location).toContain('/api/auth/session/refresh')
      expect(location).toContain(encodeURIComponent(PANEL_PATH))

      const followed = await context.get(PANEL_PATH)
      expect(followed.url()).toContain('/login')
      expect(followed.url()).toContain(encodeURIComponent(PANEL_PATH))
      expect(await followed.text()).not.toContain(PANEL_MARKER)
    })
  })

  test('the route withholds the panel from a signed-in user without rdn_forecast.read', async ({ request }) => {
    const adminToken = await getAuthToken(request, 'admin')
    let fixture: Fixture | null = null
    try {
      fixture = await createUserWithFeatures(request, adminToken, 'nofeature', [])
      const { status, url, html } = await fetchPanelWithSession(fixture.token)
      expect(status, 'the denial is a rendered page, not a blank 500').toBe(200)
      expect(url, 'an authenticated user is not bounced back to the login screen').toContain(PANEL_PATH)
      expect(html, 'protected panel markup must not leak').not.toContain(PANEL_MARKER)

      // The link being absent from the nav is not the guard — it is only cosmetic.
      expect(await navHrefs(request, fixture.token)).not.toContain(PANEL_PATH)
    } finally {
      await cleanup(request, adminToken, fixture)
    }
  })

  test('the route serves the panel and its nav entry to a reader holding only rdn_forecast.read', async ({ request }) => {
    const adminToken = await getAuthToken(request, 'admin')
    let fixture: Fixture | null = null
    try {
      fixture = await createUserWithFeatures(request, adminToken, 'reader', ['rdn_forecast.read'])
      const { status, url, html } = await fetchPanelWithSession(fixture.token)
      expect(status).toBe(200)
      expect(url).toContain(PANEL_PATH)
      expect(html).toContain(PANEL_MARKER)

      // One nav entry, directly under a top-level group: login -> group -> entry.
      expect(await navHrefs(request, fixture.token)).toContain(PANEL_PATH)

      // Read access alone must be enough — no operator feature is required here.
      const sources = await apiRequest(request, 'GET', '/api/rdn_forecast/sources', { token: fixture.token })
      expect(sources.status()).toBe(200)
    } finally {
      await cleanup(request, adminToken, fixture)
    }
  })

  test('a user without the feature sees the controlled denial in the browser, not a blank screen', async ({ request, page }) => {
    // Two cold page loads do not fit the suite default.
    test.setTimeout(60_000)
    const adminToken = await getAuthToken(request, 'admin')
    let fixture: Fixture | null = null
    try {
      fixture = await createUserWithFeatures(request, adminToken, 'denied', [])
      await loginInBrowser(page, fixture.email)

      // Straight to the URL: the sidebar never offers this entry to this user.
      await page.goto(PANEL_PATH, { waitUntil: 'domcontentloaded' })
      await expect(page.getByRole('alert').filter({ hasText: ACCESS_DENIED }).first()).toBeVisible({ timeout: 30_000 })
      await expect(page.getByTestId('rdn-forecast-panel')).toHaveCount(0)
    } finally {
      await cleanup(request, adminToken, fixture)
    }
  })

  test('a reader reaches the panel from the login screen in at most three clicks', async ({ request, page }) => {
    // Two cold page loads plus the client-side nav fetch do not fit the suite default.
    test.setTimeout(60_000)
    const adminToken = await getAuthToken(request, 'admin')
    let fixture: Fixture | null = null
    try {
      fixture = await createUserWithFeatures(request, adminToken, 'clicks', ['rdn_forecast.read'])
      await loginInBrowser(page, fixture.email)

      // The sidebar fetches its groups client-side, so the entry appears a beat
      // after the dashboard does; the group itself renders expanded by default.
      const sidebar = page.getByTestId('sidebar')
      const panelLink = sidebar.getByRole('link', { name: PANEL_TITLE }).first()
      await expect(panelLink).toBeVisible({ timeout: 30_000 })

      // The entry is reachable without a pointer as well.
      await panelLink.focus()
      await expect(panelLink).toBeFocused()

      // Click 2 of the <= 3: opening the panel. No group has to be expanded first.
      await panelLink.click()
      await page.waitForURL(new RegExp(`${PANEL_PATH}$`), { timeout: 30_000 })
      await expect(page.getByTestId('rdn-forecast-panel')).toBeVisible({ timeout: 30_000 })
      await expect(page.getByText(EMPTY_STATE).first()).toBeVisible()
      await expect(page.getByRole('alert').filter({ hasText: ACCESS_DENIED })).toHaveCount(0)
    } finally {
      await cleanup(request, adminToken, fixture)
    }
  })
})
