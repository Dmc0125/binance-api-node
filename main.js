const Websocket = require('ws');
const qs = require('qs');

const fetch = require('./helpers/fetch');
const logger = require('./helpers/logger');
const encode = require('./helpers/encode');

class Binance {
  /**
   * @param {{ API_KEY: string; SECRET_KEY: string }} secrets
   */
  constructor(secrets = undefined) {
    this.API_KEY = secrets?.API_KEY;
    this.SECRET_KEY = secrets?.SECRET_KEY;

    this.timeDiff = null;

    this.API_URL = 'https://api.binance.com';
    this.WS_URL = 'wss://stream.binance.com:9443/stream?streams=';

    this.websocket = null;
    this.streams = [];
    this.onMessageFunctions = {};
  }

  /**
   * Initialize Binance api
   */
  async init() {
    await this._setBinanceTimeDiff();
  }

  _setBinanceTimeDiff() {
    const timeEndpoint = '/api/v3/time';

    return new Promise((resolve) => {
      fetch({
        url: `${this.API_URL}${timeEndpoint}`,
      }, (data) => {
        this.timeDiff = new Date().getTime() - data.serverTime;
        resolve();
      });
    });
  }

  _getTimestamp() {
    return new Date().getTime() - (this.timeDiff || 0);
  }

  async _binanceFetch({ endpoint, method, headers }, signed, options) {
    if (!this.timeDiff) {
      logger('error', 'Time diff is not defined');
      throw Error('Time diff is not defined');
    }

    const _options = {
      ...options,
      timestamp: this._getTimestamp(),
    };

    if (!signed) {
      delete _options.timestamp;
    }

    const params = qs.stringify(_options);

    let _url = `${this.API_URL}${endpoint}?${params}`;
    const _method = method || 'GET';
    let _headers = headers;

    if (signed) {
      if (!this.API_KEY || !this.SECRET_KEY) {
        throw Error('Invalid api key or secret key');
      }

      const signature = signed ? `&signature=${encode(params, this.SECRET_KEY)}` : '';

      _url += signature;
      _headers = {
        ...headers,
        'X-MBX-APIKEY': this.API_KEY,
      };
    }

    // eslint-disable-next-line consistent-return
    return new Promise((resolve, reject) => {
      try {
        fetch({
          method: _method,
          url: _url,
          headers: _headers,
        }, (data) => {
          try {
            resolve(data);
          } catch (error) {
            // eslint-disable-next-line prefer-promise-reject-errors
            reject(`Fetch error: ${error.statusCode}`);
          }
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Spot account requests
   */
  get spot() {
    return {
      /**
       * Get spot candlesticks data
       *
       * @param {string} symbol
       * @param {string} interval
       * @param {{ startTime?: number; endTime?: number; limit?: number } | undefined} options
       */
      candlesticks: async (symbol, interval, options = undefined) => {
        const _options = {
          symbol,
          interval,
        };

        if (options && typeof options === 'object') {
          Object.assign(_options, options);
        }

        const candlesticksEndpoint = '/api/v3/klines';

        let candlesticks = await this._binanceFetch({
          endpoint: candlesticksEndpoint,
        }, false, _options);

        const getAdditionalCandlesticks = async (limit, lastCandle) => {
          const endTime = lastCandle[0];

          if (limit > 1000) {
            const additionalCandlesticks = await this._binanceFetch({
              endpoint: candlesticksEndpoint,
            }, false, {
              symbol,
              interval,
              limit,
              endTime: endTime - 1000,
            });

            candlesticks = [...additionalCandlesticks, ...candlesticks];

            if (!additionalCandlesticks.length || additionalCandlesticks.length < 1000) {
              return;
            }

            await getAdditionalCandlesticks(limit - 1000, additionalCandlesticks[0]);
            return;
          }
          const additionalCandlesticks = await this._binanceFetch({
            endpoint: candlesticksEndpoint,
          }, false, {
            symbol,
            interval,
            limit,
            endTime: endTime - 1000,
          });

          candlesticks = [...additionalCandlesticks, ...candlesticks];
        };

        if (_options.limit > 1000) {
          await getAdditionalCandlesticks(_options.limit - 1000, candlesticks[0]);
        }

        return candlesticks;
      },

      /* ---- SIGNED REQUESTS ---- */

      /**
       * Get user balances
       */
      getUserBalances: async () => {
        const accountEndpoint = '/api/v3/account';

        const data = await this._binanceFetch({
          endpoint: accountEndpoint,
          method: 'GET',
        }, true);

        return data.balances;
      },

      getOpenOrders: async () => {
        const allOrdersEndpoint = '/api/v3/openOrders';

        const data = await this._binanceFetch({
          endpoint: allOrdersEndpoint,
          method: 'GET',
        }, true);

        return data;
      },

      /**
       * Send order
       *
       * @param {string} symbol
       * @param {string} side
       * @param {string} type
       * @param {number} quantity
       * @param {{}} options
       */
      sendOrder: async (symbol, side, type, quantity, options = undefined) => {
        const newOrderEndpoint = '/api/v3/order';

        const _options = {
          symbol,
          side,
          type,
          quantity,
        };

        if (options && typeof options === 'object') {
          Object.assign(_options, options);
        }

        const data = await this._binanceFetch({
          endpoint: newOrderEndpoint,
          method: 'POST',
        }, true, _options);

        return data;
      },
    };
  }

  get spotWebsockets() {
    const subscribe = (streamNames) => {
      if (this.websocket.readyState === 1) {
        this.streams = [...this.streams, ...streamNames];
        this.websocket.send(JSON.stringify({
          method: 'SUBSCRIBE',
          params: streamNames,
          id: 2,
        }));
        logger('info', 'Listening to streams:', this.streams.join(', '));
      }

      if (this.websocket.readyState === 0) {
        setTimeout(() => {
          subscribe(streamNames);
        }, 5000);
      }
    };

    const initWebsocket = (streamNames) => {
      if (this.websocket) {
        subscribe(streamNames);
        return;
      }

      this.streams = streamNames;

      this.websocket = new Websocket(`${this.WS_URL}${streamNames.join('/')}`, {
        method: 'SUBSCRIBE',
        id: 1,
      });

      this.websocket.on('open', () => {
        logger('info', 'Listening to streams:', this.streams.join(', '), '\n');
      });

      this.websocket.on('message', (dataJSON) => {
        const data = JSON.parse(dataJSON);

        if (data?.stream) {
          Object.keys(this.onMessageFunctions).forEach((fnKey) => {
            if (data.stream.includes(fnKey)) {
              this.onMessageFunctions[fnKey](data);
            }
          });
        }
      });

      this.websocket.on('close', () => {
        initWebsocket(this.streams);
      });
    };

    return {
      /**
       * Subscribes to kline/candlesticks websocket stream
       *
       * @param {Array<Array<string, string>>} streamNames Array of arrays of symbol and timeframe
       * @param {function} onMessageFn
       */
      candlesticks: (streamNames, onMessageFn) => {
        if (this.onMessageFunctions.candlesticks) {
          return;
        }

        const streams = streamNames.map(([symbol, timeframe]) => `${symbol.toLowerCase()}@kline_${timeframe}`);
        initWebsocket(streams);

        this.onMessageFunctions.kline = onMessageFn;
      },

      /**
       * Subscribes to allTickers websocket stream
       *
       * @param {function} onMessageFn
       */
      allTickers: (onMessageFn) => {
        if (this.onMessageFunctions.allTickers) {
          return;
        }

        const stream = '!ticker@arr';
        initWebsocket([stream]);

        this.onMessageFunctions[stream] = onMessageFn;
      },
    };
  }
}

module.exports = Binance;
