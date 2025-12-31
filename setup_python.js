const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const envDir = path.join(__dirname, 'python_env');
const isWin = process.platform === 'win32';

console.log('Setup Python Environment...');

// 1. Create Venv
if (!fs.existsSync(envDir)) {
    console.log('Creating venv...');
    try {
        execSync('python -m venv python_env', { stdio: 'inherit' });
    } catch (e) {
        console.error('Failed to create venv. Is python installed?');
        process.exit(1);
    }
} else {
    console.log('Venv exists.');
}

// 2. Install Deps
const pipParams = 'install selenium webdriver-manager playwright';
const pipCmd = isWin
    ? `.\\python_env\\Scripts\\pip ${pipParams}`
    : `./python_env/bin/pip ${pipParams}`;

console.log(`Installing dependencies: ${pipParams}...`);
try {
    execSync(pipCmd, { stdio: 'inherit', cwd: __dirname });
    console.log('Dependencies installed successfully.');

    // 3. Install Playwright Browsers (Python)
    const pwCmd = isWin
        ? `.\\python_env\\Scripts\\playwright install chromium`
        : `./python_env/bin/playwright install chromium`;
    console.log('Installing Playwright browsers for Python...');
    execSync(pwCmd, { stdio: 'inherit', cwd: __dirname });

} catch (e) {
    console.error('Failed to install dependencies.', e.message);
}

console.log('Setup Complete!');
