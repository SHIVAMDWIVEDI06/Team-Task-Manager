const { test, expect } = require('@playwright/test');

test.describe('Authentication Flow', () => {
  test('should display login page correctly', async ({ page }) => {
    await page.goto('/login');
    
    // Expect a title "to contain" a substring.
    await expect(page.locator('h3')).toContainText('Welcome back');
    
    // Expect email and password inputs
    await expect(page.locator('input[name="email"]')).toBeVisible();
    await expect(page.locator('input[name="password"]')).toBeVisible();
    
    // Expect sign in button
    await expect(page.getByRole('button', { name: 'Sign In' })).toBeVisible();
  });

  test('should display forgot password page', async ({ page }) => {
    await page.goto('/login');
    
    // Click on forgot password link
    await page.getByText('Forgot Password?').click();
    
    // Verify it navigates to forgot password
    await expect(page).toHaveURL(/.*forgot-password/);
    await expect(page.locator('h3')).toContainText('Forgot Password');
  });
});
