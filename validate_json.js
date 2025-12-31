const fs = require('fs');
try {
    const data = fs.readFileSync('f:/second/Bug-binder-add1/bug-binder/backend/data/project-eeb908f5-24d8-4d43-87bb-14a1c4a03fea-data.json', 'utf-8');
    JSON.parse(data);
    console.log("JSON Valid");
} catch (e) {
    console.log("JSON Invalid:", e.message);
    // Print context around error
    const match = e.message.match(/position (\d+)/);
    if (match) {
        const pos = parseInt(match[1]);
        const data = fs.readFileSync('f:/second/Bug-binder-add1/bug-binder/backend/data/project-eeb908f5-24d8-4d43-87bb-14a1c4a03fea-data.json', 'utf-8');
        console.log("Context:", data.substring(pos - 20, pos + 20));
    }
}
