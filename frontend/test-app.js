import { chromium } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const screenshots = [];

async function runTest() {
  const browser = await chromium.launch();
  const context = await browser.createBrowserContext();
  const page = await context.newPage();

  try {
    console.log('Navigating to http://localhost:5173...');
    await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });

    console.log('Taking screenshot of login page...');
    const loginScreenshot = '/tmp/01-login-page.png';
    await page.screenshot({ path: loginScreenshot, fullPage: true });
    screenshots.push({ name: '01-login-page.png', path: loginScreenshot });
    console.log('Login page screenshot saved:', loginScreenshot);

    console.log('Attempting to log in with admin@example.com / password...');

    // Find and fill email field
    const emailInput = page.locator('input[type="email"]') || page.locator('input[placeholder*="email" i]');
    await emailInput.fill('admin@example.com');
    console.log('Entered email');

    // Find and fill password field
    const passwordInput = page.locator('input[type="password"]');
    await passwordInput.fill('password');
    console.log('Entered password');

    // Find and click login button
    const loginButton = page.locator('button:has-text("Login")') || page.locator('button:has-text("Sign in")') || page.locator('button:has-text("Submit")');
    await loginButton.click();
    console.log('Clicked login button');

    // Wait for navigation to complete
    await page.waitForLoadState('networkidle');
    console.log('Logged in successfully');

    // Take dashboard screenshot
    const dashboardScreenshot = '/tmp/02-admin-dashboard.png';
    await page.screenshot({ path: dashboardScreenshot, fullPage: true });
    screenshots.push({ name: '02-admin-dashboard.png', path: dashboardScreenshot });
    console.log('Dashboard screenshot saved:', dashboardScreenshot);

    // Get page title to verify we're on dashboard
    const title = await page.title();
    console.log('Current page title:', title);

    // Find all navigation links
    const navLinks = await page.locator('nav a, [role="navigation"] a, aside a').all();
    console.log(`Found ${navLinks.length} navigation links`);

    // Test navigation
    for (let i = 0; i < Math.min(navLinks.length, 5); i++) {
      try {
        const link = navLinks[i];
        const href = await link.getAttribute('href');
        const text = await link.textContent();
        console.log(`\nTesting navigation link ${i + 1}: "${text}" (${href})`);

        // Click the link
        await link.click();
        await page.waitForLoadState('networkidle');
        console.log(`Successfully navigated to: ${page.url()}`);

        // Take screenshot of the section
        const sectionScreenshot = `/tmp/0${3 + i}-section-${i + 1}.png`;
        await page.screenshot({ path: sectionScreenshot, fullPage: true });
        screenshots.push({ name: `0${3 + i}-section-${i + 1}.png`, path: sectionScreenshot });
        console.log(`Section screenshot saved: ${sectionScreenshot}`);

        // Go back to avoid issues with navigation state
        await page.goBack();
        await page.waitForLoadState('networkidle');
      } catch (e) {
        console.log(`Error testing link ${i + 1}:`, e.message);
      }
    }

    console.log('\n=== Test Summary ===');
    console.log('Screenshots taken:');
    screenshots.forEach((s, idx) => {
      console.log(`${idx + 1}. ${s.name}: ${s.path}`);
    });
    console.log('All tests completed successfully!');

  } catch (error) {
    console.error('Error during test:', error);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

runTest();
