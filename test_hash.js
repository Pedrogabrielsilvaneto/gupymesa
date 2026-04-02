const crypto = require('crypto');
const hash = crypto.createHash('sha256').update('gupy123').digest('hex');
console.log(hash);
