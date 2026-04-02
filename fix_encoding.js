const fs = require('fs');
const path = require('path');

const getAllFiles = function(dirPath, arrayOfFiles) {
  const files = fs.readdirSync(dirPath)
  arrayOfFiles = arrayOfFiles || []
  files.forEach(function(file) {
    const fullPath = path.join(dirPath, file);
    if (fs.statSync(fullPath).isDirectory()) {
        if (!file.startsWith('.') && file !== 'node_modules') {
            arrayOfFiles = getAllFiles(fullPath, arrayOfFiles)
        }
    } else {
      if (file.endsWith('.html') || file.endsWith('.js')) {
        arrayOfFiles.push(fullPath)
      }
    }
  })
  return arrayOfFiles
}

const files = getAllFiles(process.cwd());

files.forEach(filePath => {
    let content = fs.readFileSync(filePath, 'utf8');
    let original = content;
    
    // Fix double-encoded UTF-8
    content = content.replace(/á/g, 'á');
    content = content.replace(/é/g, 'é');
    content = content.replace(/Ã/g, (match, offset, string) => {
        // Look ahead for common markers
        const next = string[offset + 1];
        if (next === '\xad') return 'í'; // Ã\xad
        if (next === '³') return 'ó'; // ó³
        if (next === 'º') return 'ú'; // úº
        if (next === '£') return 'ã'; // ã£
        if (next === 'µ') return 'õ'; // õµ
        if (next === '§') return 'ç'; // ç§
        if (next === 'ª') return 'ê'; // êª
        if (next === '´') return 'ô'; // ô´
        return match;
    });
    
    // More direct replacements
    content = content.replace(/Ã\xad/g, 'í');
    content = content.replace(/ó³/g, 'ó');
    content = content.replace(/úº/g, 'ú');
    content = content.replace(/ã£/g, 'ã');
    content = content.replace(/õµ/g, 'õ');
    content = content.replace(/ç§/g, 'ç');
    content = content.replace(/êª/g, 'ê');
    content = content.replace(/ô´/g, 'ô');
    content = content.replace(/Ã\x81/g, 'Á');
    content = content.replace(/Ã\x89/g, 'É');
    content = content.replace(/Ã\x8d/g, 'Í');
    content = content.replace(/Ã\x93/g, 'Ó');
    content = content.replace(/Ã\x9a/g, 'Ú');
    content = content.replace(/Ã\x83/g, 'Ã');
    content = content.replace(/Ã\x95/g, 'Õ');
    content = content.replace(/Ã\x87/g, 'Ç');
    
    if (content !== original) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`Fixed encoding in ${filePath.replace(process.cwd(), '')}`);
    }
});
