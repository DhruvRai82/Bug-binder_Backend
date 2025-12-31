import { chromium } from 'playwright';

(async () => {
    console.log('🚀 Attempting to launch browser...');
    try {
        const browser = await chromium.launch({
            headless: false // Force visible
        });
        const page = await browser.newPage();
        await page.goto('https://example.com');
        console.log(`✅ Loaded: ${await page.title()}`);
        await page.close();
        await browser.close();
        console.log('🎉 Browser test complete.');
    } catch (error) {
        console.error('❌ Browser Launch Failed:', error);
    }
})();
