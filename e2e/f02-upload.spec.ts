import { test, expect } from '@playwright/test'

const TXT = 'Vocalize upload fixture. This is plain text imported into the reader.'

test.describe('F02 — document import', () => {
  test.beforeEach(async ({ page }) => {
    page.on('console', (msg) => {
      if (msg.type() === 'error') throw new Error(`console error: ${msg.text()}`)
    })
  })

  test('F02-H1 import a .txt file loads it into the editor', async ({ page }) => {
    await page.goto('/')

    const uploadBtn = page.getByRole('button', { name: /upload/i }).first()
    await uploadBtn.click()

    const modal = page.getByRole('dialog', { name: 'Import a document' })
    await expect(modal).toBeVisible()

    await modal.getByLabel('file', { exact: false }).setInputFiles({
      name: 'notes.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from(TXT),
    })

    // Success toast in the modal
    await expect(modal.getByText(/loaded/i)).toBeVisible({ timeout: 4000 })

    // Content now in the editor
    await expect(page.getByLabel('Text to read aloud')).toContainText('Vocalize upload fixture')
  })

  test('F02-E1 unsupported extension shows an error', async ({ page }) => {
    await page.goto('/')
    const uploadBtn = page.getByRole('button', { name: /upload/i }).first()
    await uploadBtn.click()

    const modal = page.getByRole('dialog', { name: 'Import a document' })
    await modal.getByLabel('file', { exact: false }).setInputFiles({
      name: 'weird.xyz',
      mimeType: 'application/octet-stream',
      buffer: Buffer.from('hello'),
    })

    await expect(modal.getByText(/can't read/i)).toBeVisible({ timeout: 3000 })
  })

  test('F02-E2 empty file shows an error', async ({ page }) => {
    await page.goto('/')
    const uploadBtn = page.getByRole('button', { name: /upload/i }).first()
    await uploadBtn.click()

    const modal = page.getByRole('dialog', { name: 'Import a document' })
    await modal.getByLabel('file', { exact: false }).setInputFiles({
      name: 'empty.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from(''),
    })

    await expect(modal.getByText(/no readable text/i)).toBeVisible({ timeout: 3000 })
  })
})
