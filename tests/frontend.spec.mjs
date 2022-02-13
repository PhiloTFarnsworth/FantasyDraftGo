import { test, expect } from '@playwright/test'

// So we're going to take a hybrid approach, using codegen to create events, and using some to verify text.
// Owing to the still somewhat rough state of our react app, we're going to have some really redundant
// expects from the auto-generated selectors, but even in this rough state it's already finding bugs, so a success already.
//

test('test', async ({ page }) => {
  await page.goto('/')
  // Click h1:has-text("FantasyDraft")
  const title = page.locator('h1:has-text("FantasyDraft")')
  await expect(title).toHaveText('FantasyDraft')

  // Click text=Login
  await page.locator('text=Login').click()

  // Click text=Log in to FantasyDraft!
  await page.locator('text=Log in to FantasyDraft!').click()

  // Click [placeholder="Username"]
  await page.locator('[placeholder="Username"]').click()

  // Fill [placeholder="Username"]
  await page.locator('[placeholder="Username"]').fill('larry')

  // Press Tab
  await page.locator('[placeholder="Username"]').press('Tab')

  // Fill [placeholder="Password"]
  await page.locator('[placeholder="Password"]').fill('test')

  // Click text=Login
  await page.locator('text=Login').click()

  // Click text=larry Dashboard
  const dashTitle = page.locator('text=larry Dashboard')
  await expect(dashTitle).toHaveText('larry Dashboard')

  // Click text=Very Arry League
  const leagueName = page.locator('text=Very Arry League')
  await expect(leagueName).toHaveText('Very Arry League')

  // Click text=Rejoin!
  await page.locator('text=Rejoin!').click()

  // DRAFT - Since we have randomized draft positions, we're left in a tricky position in terms
  // of what we can use codegen to do.  We'll check that the draft loads for the time being.
  // Click text=Very Arry League Draft
  const draftTitle = page.locator('text=Very Arry League Draft')
  await expect(draftTitle).toHaveText('Very Arry League Draft')
})
