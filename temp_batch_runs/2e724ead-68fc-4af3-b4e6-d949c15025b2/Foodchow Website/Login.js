const { Builder, By, Key, until } = require('selenium-webdriver');
const firefox = require('selenium-webdriver/firefox');

describe('Login Test Suite', function () {
    this.timeout(30000); // Set timeout for the entire suite
    let driver;

    const url = "https://admin.foodchow.com/RestaurantLogin";

    // Locators
    const locators = {
        email: By.id('txtEmailId'),
        password: By.name('Password'),
        loginBtn: By.xpath("//button[contains(.,'Login') or contains(.,'Sign in')]"),
        logoutBtn: By.id('btn_logout')
    };

    // Data array: [email, password, expectedSuccess]
    const testData = [
        ["testing1@tenacioustechies.com.au", "123456", true],
        ["testing@tenacioustechies.com", "123456", true],
        ["testing@tenacioustechies.com", "wrongpass", false],
        ["invalidemail", "123456", false],
        ["unknown@tenacioustechies.com", "123456", false]
    ];

    before(async function () {
        let options = new firefox.Options();
        // options.addArguments("-headless"); // Uncomment for headless mode

        driver = await new Builder()
            .forBrowser('firefox')
            .setFirefoxOptions(options)
            .build();
        
        await driver.manage().window().maximize();
    });

    after(async function () {
        await driver.quit();
    });

    it('should test login with multiple data sets', async function () {
        for (const [emailVal, passVal, expectedSuccess] of testData) {
            console.log(`\nTrying login: ${emailVal}`);

            await driver.get(url);

            // Wait and enter Email
            const emailField = await driver.wait(until.elementLocated(locators.email), 10000);
            await emailField.clear();
            await emailField.sendKeys(emailVal);

            // Wait and enter Password
            const passField = await driver.wait(until.elementLocated(locators.password), 10000);
            await passField.clear();
            await passField.sendKeys(passVal);

            // Check if login button exists, otherwise press Enter
            const loginButtons = await driver.findElements(locators.loginBtn);
            if (loginButtons.length > 0) {
                await loginButtons[0].click();
            } else {
                await passField.sendKeys(Key.ENTER);
            }

            // Artificial delay (replaces Thread.sleep)
            await new Promise(resolve => setTimeout(resolve, 2000));

            // Check login status
            const logoutButtons = await driver.findElements(locators.logoutBtn);
            const loggedIn = logoutButtons.length > 0;

            if (loggedIn) {
                console.log("✅ Logged in successfully.");
                if (!expectedSuccess) console.log("❌ Expected failure but login succeeded.");
                
                // Logout
                await logoutButtons[0].click();
                await new Promise(resolve => setTimeout(resolve, 1000));
            } else {
                console.log("❌ Login failed.");
                if (expectedSuccess) console.log("❌ Expected success but login failed.");
            }
        }
    });
});