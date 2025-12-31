const fs = require('fs');
const path = require('path');

const copyRecursiveSync = (src, dest) => {
    const exists = fs.existsSync(src);
    const stats = exists && fs.statSync(src);
    const isDirectory = exists && stats.isDirectory();

    if (isDirectory) {
        if (!fs.existsSync(dest)) {
            fs.mkdirSync(dest, { recursive: true });
        }
        fs.readdirSync(src).forEach((childItemName) => {
            copyRecursiveSync(
                path.join(src, childItemName),
                path.join(dest, childItemName)
            );
        });
    } else {
        // Copy if source exists
        if (exists) {
            fs.copyFileSync(src, dest);
        }
    }
};

const srcData = path.join(__dirname, '../data');
const destData = path.join(__dirname, '../dist/data');

console.log(`Copying assets from ${srcData} to ${destData}...`);

if (!fs.existsSync(path.join(__dirname, '../dist'))) {
    fs.mkdirSync(path.join(__dirname, '../dist'));
}

try {
    copyRecursiveSync(srcData, destData);
    console.log('Assets copied successfully!');
} catch (err) {
    console.error('Error copying assets:', err);
    process.exit(1);
}
