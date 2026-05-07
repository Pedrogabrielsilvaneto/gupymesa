const fs = require('fs');
const lines = fs.readFileSync('result.txt', 'utf16le').split('\n');
lines.forEach(l => {
  if (l.includes('Fernanda') || l.includes('Isabela') || l.includes('Samaria') || l.includes('Aparecida')) {
    const parts = l.split('|');
    const nome = parts[0].split(':')[1].trim();
    const strict = parts[5].split(':')[1].trim();
    const metas = parts[6].split(':')[1].trim();
    const nok = parts[3].split(':')[1].trim();
    console.log(nome + " => Strict: " + strict + ", Metas: " + metas + ", NOK: " + nok);
  }
});
