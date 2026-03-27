const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
    fs.readdirSync(dir).forEach(f => {
        let dirPath = path.join(dir, f);
        let isDirectory = fs.statSync(dirPath).isDirectory();
        if (isDirectory) {
            walkDir(dirPath, callback);
        } else {
            callback(dirPath);
        }
    });
}

const dir = 'e:\\Bireena nw 6\\frontend\\src';
let count = 0;
walkDir(dir, function(filePath) {
    if (filePath.endsWith('.js') || filePath.endsWith('.jsx')) {
        let content = fs.readFileSync(filePath, 'utf8');
        let newContent = content;
        
        // Replacement 1
        newContent = newContent.replace(/fetch\(\`\$\{API_URL\}/g, 'apiCall(\`');
        
        // Replacement 2
        newContent = newContent.replace(/fetch\(\`\$\{API_URL_CONFIG\}/g, 'apiCall(\`');
        
        if (content !== newContent) {
            // Also fix imports if missing apiCall
            if (!newContent.includes('{ apiCall }') && !newContent.includes('{apiCall}')) {
                newContent = newContent.replace(/import API_URL from (['"].*?api['"]);/g, "import API_URL, { apiCall } from $1;");
                newContent = newContent.replace(/import API_URL_CONFIG from (['"].*?api['"]);/g, "import API_URL_CONFIG, { apiCall } from $1;");
            }
            
            fs.writeFileSync(filePath, newContent, 'utf8');
            console.log('Updated: ' + filePath);
            count++;
        }
    }
});
console.log('Total files updated: ' + count);
