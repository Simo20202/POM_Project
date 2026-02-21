import { test, expect } from '@playwright/test';
import {LoginPage} from '../../pages/login';

test('Login Test', async ({ page }) => {

  const Login = new LoginPage(page);

  await Login.gotoLoginPage();
  await Login.login('simo@gmail.com', '@12345678');

  await expect(page.getByText(/Welcome back/i)).toBeVisible({ timeout: 15000 });


  // await page.goto('https://the-internet.herokuapp.com/login');
  // await page.getByRole('textbox', { name: 'Username' }).click();
  // await page.getByRole('textbox', { name: 'Username' }).fill('tomsmith');
  // await page.getByRole('textbox', { name: 'Password' }).click();
  // await page.getByRole('textbox', { name: 'Password' }).press('CapsLock');
  // await page.getByRole('textbox', { name: 'Password' }).fill('Super');
  // await page.getByRole('textbox', { name: 'Password' }).press('CapsLock');
  // await page.getByRole('textbox', { name: 'Password' }).fill('SuperSecret');
  // await page.getByRole('textbox', { name: 'Password' }).press('CapsLock');
  // await page.getByRole('textbox', { name: 'Password' }).fill('SuperSecretPassword!');
  // await page.getByRole('button', { name: ' Login' }).click();
});
