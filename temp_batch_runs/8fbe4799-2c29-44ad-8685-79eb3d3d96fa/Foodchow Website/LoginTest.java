import org.openqa.selenium.*;
import org.openqa.selenium.firefox.FirefoxDriver;
import org.openqa.selenium.firefox.FirefoxOptions;
import org.openqa.selenium.support.ui.ExpectedConditions;
import org.openqa.selenium.support.ui.WebDriverWait;
import org.testng.annotations.*;

import java.time.Duration;

public class LoginTest {

    WebDriver driver;
    WebDriverWait wait;

    // 🔹 URL of your login page
    String url = "https://admin.foodchow.com/RestaurantLogin";

    // 🔹 Locators (from your HTML)
    By email = By.id("txtEmailId");
    By password = By.name("Password"); 
    By loginBtn = By.xpath("//button[contains(.,'Login') or contains(.,'Sign in')]");
    By logoutBtn = By.id("btn_logout");

    // 🔹 Data array: { email, password, expectedSuccess }
    Object[][] testData = {
            {"testing1@tenacioustechies.com.au", "123456", true},
            {"testing@tenacioustechies.com", "123456", true},
            {"testing@tenacioustechies.com", "wrongpass", false},
            {"invalidemail", "123456", false},
            {"unknown@tenacioustechies.com", "123456", false}
    };

    @BeforeClass
    public void setup() {
        // NOTE: Selenium 4.6+ has built-in driver management!
        // We do NOT need WebDriverManager.firefoxdriver().setup(); anymore.
        
        FirefoxOptions options = new FirefoxOptions();
        // options.addArguments("--headless"); // Use this if running on a server without display
        
        driver = new FirefoxDriver(options);
        wait = new WebDriverWait(driver, Duration.ofSeconds(10));
        driver.manage().window().maximize();
    }

    @AfterClass
    public void teardown() {
        if (driver != null) {
            driver.quit();
        }
    }

    @Test
    public void testLoginArray() throws InterruptedException {
        for (Object[] data : testData) {
            String emailData = (String) data[0];
            String passData = (String) data[1];
            boolean expectedSuccess = (Boolean) data[2];

            System.out.println("\nTrying login: " + emailData);

            driver.get(url);
            wait.until(ExpectedConditions.visibilityOfElementLocated(email)).clear();
            driver.findElement(email).sendKeys(emailData);

            WebElement pass = wait.until(ExpectedConditions.visibilityOfElementLocated(password));
            pass.clear();
            pass.sendKeys(passData);

            // Click login or press enter if no button
            if (driver.findElements(loginBtn).size() > 0)
                driver.findElement(loginBtn).click();
            else
                pass.sendKeys(Keys.ENTER);

            // Wait a bit for page reaction
            Thread.sleep(2000);

            boolean loggedIn = driver.findElements(logoutBtn).size() > 0;

            if (loggedIn) {
                System.out.println("✅ Logged in successfully.");
                if (!expectedSuccess)
                    System.out.println("❌ Expected failure but login succeeded.");
                // Logout
                driver.findElement(logoutBtn).click();
                Thread.sleep(1000);
            } else {
                System.out.println("❌ Login failed.");
                if (expectedSuccess)
                    System.out.println("❌ Expected success but login failed.");
            }
        }
    }
}
