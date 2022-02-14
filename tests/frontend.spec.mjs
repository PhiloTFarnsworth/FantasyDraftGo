import { test, expect } from '@playwright/test'

// So we're going to take a hybrid approach, using codegen to create events, and using some to verify text.
// Owing to the still somewhat rough state of our react app, we're going to have some really redundant
// expects from the auto-generated selectors, but even in this rough state it's already finding bugs, so a success already.

test('test', async ({ page }) => {
  // Go to http://127.0.0.1:8000/
  await page.goto('http://127.0.0.1:8000/')

  // Click text=Welcome Guest!
  const welcomeGuest = page.locator('text=Welcome Guest!')
  await expect(welcomeGuest).toHaveText('Welcome Guest!')

  // Click h1:has-text("FantasyDraft")
  const guestHeadline = page.locator('h1:has-text("FantasyDraft")')
  await expect(guestHeadline).toHaveText('FantasyDraft')

  // LOGIN - Marry
  // Click text=Login
  await page.locator('text=Login').click()

  // Click [placeholder="Username"]
  await page.locator('[placeholder="Username"]').click()

  // Fill [placeholder="Username"]
  await page.locator('[placeholder="Username"]').fill('marry')

  // Press Tab
  await page.locator('[placeholder="Username"]').press('Tab')

  // Fill [placeholder="Password"]
  await page.locator('[placeholder="Password"]').fill('test')

  // Click text=Login
  await page.locator('text=Login').click()

  // DASHBOARD

  const welcomeMarry = page.locator('text=Welcome marry!')
  await expect(welcomeMarry).toHaveText('Welcome marry!')

  // Click text=marry Dashboard
  const dashHeadline = page.locator('text=marry Dashboard')
  await expect(dashHeadline).toHaveText('marry Dashboard')

  // Click text=Very Arry League
  const leagueArry = page.locator('text=Very Arry League')
  await expect(leagueArry).toHaveText('Very Arry League')

  // Click text=Empty Test League
  const leagueEmpty = page.locator('text=Empty Test League')
  await expect(leagueEmpty).toHaveText('Empty Test League')

  // Click text=Marry Barry
  const leagueMarry = page.locator('text=Marry Barry')
  await expect(leagueMarry).toHaveText('Marry Barry')

  // LEAGUE - INIT STATE
  // Click button[name="\32 "]
  await page.locator('button[name="\\32 "]').click()

  // Click text=Empty Test League League Page
  const emptyHeadline = page.locator('text=Empty Test League League Page')
  await expect(emptyHeadline).toHaveText('Empty Test League League Page')

  // Click text=Fallen Soldiers
  const teamName = page.locator('text=Fallen Soldiers')
  await expect(teamName).toHaveText('Fallen Soldiers')

  // Click text=barry@mail.com
  const inviteEmail = page.locator('text=barry@mail.com')
  await expect(inviteEmail).toHaveText('barry@mail.com')

  // Click text=Review League Settings
  const reviewSettings = page.locator('text=Review League Settings')
  await expect(reviewSettings).toHaveText('Review League Settings')

  // Click [placeholder="League\ Name"]
  await page.locator('[placeholder="League\\ Name"]').click()

  // Click text=Return to Dashboard
  await page.locator('text=Return to Dashboard').click()

  // LEAGUE - PREDRAFT STATE
  // Click button[name="\33 "]
  await page.locator('button[name="\\33 "]').click()

  // Click text=Barry Bostwick
  const teamPreName = page.locator('text=Barry Bostwick')
  await expect(teamPreName).toHaveText('Barry Bostwick')

  // Click text=Boysenberry
  const team2PreName = page.locator('text=Boysenberry')
  await expect(team2PreName).toHaveText('Boysenberry')

  // Click text=Draft Settings
  const draftSettings = page.locator('text=Draft Settings')
  await expect(draftSettings).toHaveText('Draft Settings')

  // Non edit test of edit team name
  // Click text=Edit Team Name
  await page.locator('text=Edit Team Name').click()

  // Click [placeholder="Edit\ Team\ Name"]
  await page.locator('[placeholder="Edit\\ Team\\ Name"]').click()

  // Click text=Cancel Edit
  await page.locator('text=Cancel Edit').click()

  // Click text=Boysenberry
  const teamNamePostEdit = page.locator('text=Boysenberry')
  await expect(teamNamePostEdit).toHaveText('Boysenberry')

  // Click text=Return to Dashboard
  await page.locator('text=Return to Dashboard').click()

  // Test Create new League Form
  // Click text=Create a New League
  await page.locator('text=Create a New League').click()

  // Click [placeholder="Name\ Your\ League\!"]
  await page.locator('[placeholder="Name\\ Your\\ League\\!"]').click()

  // Click [placeholder="Name\ Your\ Team\!"]
  await page.locator('[placeholder="Name\\ Your\\ Team\\!"]').click()

  // Click text=Close League Wizard
  await page.locator('text=Close League Wizard').click()

  // Click div:has-text("Create a New League") >> nth=3
  await page.locator('div:has-text("Create a New League")').nth(3).click()

  // Test Logout - Login as Barry
  // Click text=logout
  await page.locator('text=logout').click()
  await expect(page).toHaveURL('http://127.0.0.1:8000/')

  // Click text=Login
  await page.locator('text=Login').click()

  // Click [placeholder="Username"]
  await page.locator('[placeholder="Username"]').click()

  // Fill [placeholder="Username"]
  await page.locator('[placeholder="Username"]').fill('barry')

  // Click [placeholder="Password"]
  await page.locator('[placeholder="Password"]').click()

  // Fill [placeholder="Password"]
  await page.locator('[placeholder="Password"]').fill('test')

  // Click text=Login
  await page.locator('text=Login').click()

  // Click text=Very Arry League
  await expect(leagueArry).toHaveText('Very Arry League')

  // Click text=Marry Barry

  await expect(leagueMarry).toHaveText('Marry Barry')

  // Check Invites
  // Click text=Invites
  await page.locator('text=Invites').click()

  // Click text=Empty Test League
  await expect(leagueEmpty).toHaveText('Empty Test League')

  // Logout-login as Larry
  // Click text=logout
  await page.locator('text=logout').click()
  await expect(page).toHaveURL('http://127.0.0.1:8000/')

  // Click text=Login
  await page.locator('text=Login').click()

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

  // Click text=Very Arry League
  await expect(leagueArry).toHaveText('Very Arry League')

  // Check Draft
  // Click text=Rejoin!
  await page.locator('text=Rejoin!').click()

  // Click text=Very Arry League Draft
  const leagueArryDraft = page.locator('text=Very Arry League Draft')
  await expect(leagueArryDraft).toHaveText('Very Arry League Draft')

  // Click text=Draft Order
  const draftOrder = page.locator('text=Draft Order')
  await expect(draftOrder).toHaveText('Draft Order')

  // Navigate to two players, check that you can return to summary and then navigate to Alvin Kamara's pf-reference page
  // Click text=Derrick Henry
  await page.locator('text=Derrick Henry').click()

  // Click text=Draft Summary
  await page.locator('text=Draft Summary').click()

  // Click text=Alvin Kamara
  await page.locator('text=Alvin Kamara').click()

  // Click text=See their whole career at Pro-Football-Reference.com
  await page.locator('text=See their whole career at Pro-Football-Reference.com').click()
  await expect(page).toHaveURL('https://www.pro-football-reference.com/players/K/KamaAl00.htm')
})
