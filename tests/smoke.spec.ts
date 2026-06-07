import { test, expect, request } from '@playwright/test'

// Smoke tests verify the wiring without depending on the user's auth session.
// We hit each route as an anonymous client and check the contracts:
//   - public pages render 200
//   - protected API returns 401 (auth gate works)
//   - protected pages either redirect or render a login UI

test.describe('public surface', () => {
  test('homepage renders', async ({ page }) => {
    const res = await page.goto('/')
    expect(res?.status()).toBe(200)
    await expect(page).toHaveTitle(/.+/)
  })

  test('health endpoint responds', async ({ request }) => {
    // The repo doesn't currently expose /api/health in construct-ai (only in
    // the legacy cctp-app). Skip gracefully if missing so the smoke suite
    // stays useful even without it.
    const res = await request.get('/api/health')
    if (res.status() === 404) test.skip()
    expect(res.ok()).toBeTruthy()
  })
})

test.describe('auth gates', () => {
  test('unauth /api/quotes returns 401', async ({ request }) => {
    const res = await request.get('/api/quotes')
    expect(res.status()).toBe(401)
  })

  test('unauth /api/me returns 401', async ({ request }) => {
    const res = await request.get('/api/me')
    expect(res.status()).toBe(401)
  })

  test('unauth PATCH /api/quotes/[id] returns 401', async ({ request }) => {
    const fakeId = '00000000-0000-0000-0000-000000000000'
    const res = await request.patch(`/api/quotes/${fakeId}`, {
      data: { status: 'approved' },
    })
    expect([401, 403]).toContain(res.status())
  })
})

test.describe('quote create/read contract (anonymous)', () => {
  test('POST /api/quotes with empty body rejects', async ({ request }) => {
    const res = await request.post('/api/quotes', { data: {} })
    // 401 (auth) or 422 (validation) are both acceptable — both mean the
    // happy path is correctly gated/validated.
    expect([401, 403, 422]).toContain(res.status())
  })
})
