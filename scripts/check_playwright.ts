
import { chromium } from 'playwright';

async function check() {
    console.log('🔍 Checking Playwright Installation...');
    try {
        const browser = await chromium.launch({ headless: true });
        console.log('✅ Browser launched successfully!');
        const version = browser.version();
        console.log(`ℹ️ Browser Version: ${version}`);
        await browser.close();
        console.log('✅ Browser closed.');
        process.exit(0);
    } catch (error: any) {
        console.error('❌ Playwright Check Failed!');
        console.error(error.message);
        if (error.message.includes('executable doesn\'t exist')) {
            console.log('\n💡 SUGGESTION: You need to install browsers. Run:');
            console.log('    npx playwright install');
        }
        process.exit(1);
    }
}

check();
