const { default: axios } = require('axios');

const logger = require('./logger');

/**
 * @param {{ url: string; opt: {}; method: 'GET' | 'POST'; headers: {}}} param0
 * @param {function} callback
 */
const fetch = ({ url, method, headers }, callback = null) => {
  axios({
    url,
    method,
    headers,
  }).then((response) => {
    if (callback) callback(response.data);
  }).catch((error) => {
    if (error.response) logger('warn', error.response.data);
    throw error.message;
  });
};

module.exports = fetch;
