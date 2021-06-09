const crypto = require('crypto');

const encode = (totalParams, key) => crypto
  .createHmac('sha256', `${key}`)
  .update(totalParams)
  .digest('hex');

module.exports = encode;
