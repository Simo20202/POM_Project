exports.LoginPage = class LoginPage {

    constructor(page) {
        this.page = page;
        // Define locators
        this.navButton = page.locator('//*[@id="app-root"]/nav/div[1]/div[3]/button/span[2]');
        this.email_textbox = page.locator('#login-email');
        this.password_textbox = page.locator('#login-password');
        this.loginButton = page.locator('#login-submit');
    }
        // Define methods
    async gotoLoginPage() {
        await this.page.goto('https://ndosisimplifiedautomation.vercel.app/');
    }

    async login(username, password) {
        await this.navButton.click();
        // Wait for the login form to be fully visible before interacting
        await this.email_textbox.waitFor({ state: 'visible' });
        await this.email_textbox.fill(username);
        await this.password_textbox.fill(password);
        // Ensure the login button is visible and stable before clicking
        await this.loginButton.waitFor({ state: 'visible' });
        await this.loginButton.click();
    }
}