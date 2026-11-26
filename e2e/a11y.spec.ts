import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

test.describe('Accessibility scans', () => {
  test('ALL-H1 main screen passes axe', async ({ page }) => {
    await page.goto('/')
    const a11y = await new AxeBuilder({ page }).analyze()
    expect(a11y.violations).toEqual([])
  })

  test('ALL-H2 upload modal passes axe', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: /upload/i }).first().click()
    const a11y = await new AxeBuilder({ page }).include('[role=dialog]').analyze()
    expect(a11y.violations).toEqual([])
  })

  test('ALL-H3 export modal passes axe', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: /export/i }).click()
    const a11y = await new AxeBuilder({ page }).include('[role=dialog]').analyze()
    expect(a11y.violations).toEqual([])
  })
})