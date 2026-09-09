import { expect, test } from '@playwright/test'

async function interceptGemini(page: Parameters<typeof test>[0]['page']) {
  let requestCount = 0
  await page.route('**/generativelanguage.googleapis.com/**', async (route) => {
    requestCount += 1
    const body = route.request().postData() ?? ''
    const responseText = body.includes('file my return')
      ? 'This is outside CA Buddy\'s scope. Please consult a Chartered Accountant for help with filing.'
      : requestCount === 1
        ? 'GST guidance: registration and filing depend on your business facts and return type.'
        : 'TDS follow-up guidance: check the applicable section, rate, and due date for the payment.'

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        candidates: [{
          content: { role: 'model', parts: [{ text: responseText }] },
          finishReason: 'STOP',
        }],
      }),
    })
  })
}

test('completes the three-minute demo with intercepted Gemini responses', async ({ page }) => {
  await interceptGemini(page)
  await page.goto('/')

  await expect(page.getByRole('heading', { name: 'CA Buddy' })).toBeVisible()
  await expect(page.getByRole('note')).toContainText(/not professional advice/i)

  const input = page.getByRole('textbox', { name: /tax or audit question/i })
  await input.fill('What is GST?')
  await page.getByRole('button', { name: /send question/i }).click()
  await expect(page.getByText(/GST guidance:/i)).toBeVisible()

  await input.fill('And what about TDS?')
  await page.getByRole('button', { name: /send question/i }).click()
  await expect(page.getByText(/TDS follow-up guidance/i)).toBeVisible()

  await page.getByRole('button', { name: /new chat/i }).click()
  await expect(page.getByText(/GST guidance:/i)).not.toBeVisible()
  await expect(page.getByText(/TDS follow-up guidance/i)).not.toBeVisible()

  await input.fill('Can you file my return?')
  await page.getByRole('button', { name: /send question/i }).click()
  await expect(page.getByRole('article').filter({ hasText: /This is outside CA Buddy/i })).toBeVisible()
})

test('shows a safe error when Gemini is unavailable', async ({ page }) => {
  await page.route('**/generativelanguage.googleapis.com/**', async (route) => {
    await route.fulfill({ status: 503, contentType: 'application/json', body: '{}' })
  })
  await page.goto('/')

  await page.getByRole('textbox', { name: /tax or audit question/i }).fill('What is TDS?')
  await page.getByRole('button', { name: /send question/i }).click()

  await expect(page.getByText(/could not complete that answer/i)).toBeVisible()
  await expect(page.getByText(/playwright-test-key/i)).not.toBeVisible()
})
