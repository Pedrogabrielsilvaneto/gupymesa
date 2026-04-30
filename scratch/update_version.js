const fs = require('fs');
const path = require('path');

const directory = '.';
const files = fs.readdirSync(directory);

files.forEach(file => {
    if (file.endsWith('.html')) {
        const filePath = path.join(directory, file);
        let content = fs.readFileSync(filePath, 'utf8');
        if (content.includes('1.8.9')) {
            console.log(`Updating ${file}...`);
            content = content.replace(/1\.8\.9/g, '1.9.0');
            fs.writeFileSync(filePath, content, 'utf8');
        }
    }
});
