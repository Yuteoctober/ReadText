import { test, expect } from '@playwright/test'

test.describe('F03 — audio export', () => {
  test.beforeEach(async ({ page }) => {
    page.on('console', (msg) => {
      if (msg.type() === 'error') throw new Error(`console error: ${msg.text()}`)
    })
  })

  test('F03-H1 render and download MP3', async ({ page }) => {
    await page.goto('/')
    // Ensure content exists
    await expect(page.getByLabel('Text to read aloud')).not.toBeEmpty()

    const exportBtn = page.getByRole('button', { name: /export/i })
    await exportBtn.click()

    const modal = page.getByRole('dialog', { name: 'Export audio' })
    await expect(modal).toBeVisible()

    const renderBtn = modal.getByRole('button', { name: /render/i })
    await renderBtn.click()

    // Download button should appear after rendering
    const downloadLink = modal.getByRole('link', { name: /download/i })
    await expect(downloadLink).toBeVisible({ timeout: 10_000 })
    await expect(downloadLink).toHaveAttribute('download', /.*\.mp3$/)
  })

  test('F03-E1 empty content shows helpful message', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: /clear/i }).click()

    await page.getByRole('button', { name: /export/i }).click()
    const modal = page.getByRole('dialog', { name: 'Export audio' })
    await expect(modal.getByText(/add some text/i)).toBeVisible()
    await expect(modal.getByRole('button', { name: /render/i })).not.toBeVisible()
  })
})
