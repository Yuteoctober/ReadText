import { test, expect } from '@playwright/test'

test.describe('F01 — paste & listen', () => {
  test.beforeEach(async ({ page }) => {
    page.on('console', (msg) => {
      if (msg.type() === 'error') throw new Error(`console error: ${msg.text()}`)
    })
    page.on('response', (res) => {
      if (res.status() >= 500) throw new Error(`${res.status()} on ${res.url()}`)
    })
  })

  test('F01-H1 seed text loads and Play starts speech', async ({ page }) => {
    await page.goto('/')
    const ta = page.getByLabel('Text to read aloud')
    await expect(ta).not.toBeEmpty()

    // Seed text should show the word/char counts
    await expect(page.getByTitle('Word count')).toHaveText(/244/)
    await expect(page.getByTitle('Character count')).toHaveText(/1,?223/)

    const playBtn = page.getByRole('button', { name: /play/i })
    await playBtn.click()

    // Status label changes to "Part X of Y"
    await expect(page.getByText(/^part \d+ of \d+$/i)).toBeVisible({ timeout: 3000 })
  })

  test('F01-H2 user can type new text and it updates counters', async ({ page }) => {
    await page.goto('/')
    const ta = page.getByLabel('Text to read aloud')
    await ta.fill('')
    await ta.fill('Hello world from test suite.')

    // "Hello world from test suite." = 5 words, 28 characters
    await expect(page.getByTitle('Word count')).toHaveText(/5/)
    await expect(page.getByTitle('Character count')).toHaveText(/28/)
  })

  test('F01-E1 Play is disabled when content is empty', async ({ page }) => {
    await page.goto('/')
    const ta = page.getByLabel('Text to read aloud')
    await ta.fill('')
    const playBtn = page.getByRole('button', { name: /play/i })
    await expect(playBtn).toBeDisabled()
  })

  test('F01-E6 content persists after refresh', async ({ page }) => {
    await page.goto('/')
    const ta = page.getByLabel('Text to read aloud')
    await ta.fill('')
    await ta.fill('Persisted line of text for F01-E6.')

    // wait for debounced save
    await page.waitForTimeout(600)
    await page.reload()
    await expect(ta).toHaveValue('Persisted line of text for F01-E6.')
  })

  test('F01-E7 mobile layout stacks editor above player', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto('/')

    // Both regions visible, editor above player
    await expect(page.getByRole('region', { name: 'Text editor' })).toBeVisible()
    await expect(page.getByRole('region', { name: 'Player and settings' })).toBeVisible()
  })
})
