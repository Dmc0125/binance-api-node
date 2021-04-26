const Websocket = require('ws');
const qs = require('qs');

const fetch = require('./helpers/fetch');
const logger = require('./helpers/logger');
const encode = require('./helpers/encode');

/**
 * @param {{ API_KEY: string; SECRET_KEY: string }} secrets
 */
function Binance(secrets = undefined) {
  this.API_KEY = typeof secrets === 'object' ? secrets.API_KEY : undefined;
  this.SECRET_KEY = typeof secrets === 'object' ? secrets.SECRET_KEY : undefined;

  /**
   * @private
   */
  this.timeDiff = null;

  this.API_URL = 'https://api.binance.com';
  this.WS_URL = 'wss://stream.binance.com:9443/stream?streams=';

  /**
   * @private
   */
  this.websocket = null;
  /**
   * @private
   */
  this.streams = [];
  /**
   * @private
   */
  this.onMessageFunctions = {};

  /**
   * @private
   */
  const _setBinanceTimeDiff = () => {
    const timeEndpoint = '/api/v3/time';

    return new Promise((resolve) => {
      fetch({
        url: `${this.API_URL}${timeEndpoint}`,
      }, (data) => {
        this.timeDiff = new Date().getTime() - data.serverTime;
        resolve();
      });
    });
  };

  const _binanceFetch = async ({ endpoint, method, headers }, signed, options) => {
    const _options = {
      ...options,
    };
    let _url = `${this.API_URL}${endpoint}`;
    const _method = method || 'GET';
    let _headers = headers;

    let params = null;

    if (signed) {
      if (!this.API_KEY || !this.SECRET_KEY) {
        throw Error('Invalid api key or secret key');
      }

      await _setBinanceTimeDiff();
      _options.timestamp = new Date().getTime() - (this.timeDiff || 0);

      params = qs.stringify(_options);
      _url += `?${params}`;

      const signature = signed ? `&signature=${encode(params, this.SECRET_KEY)}` : '';

      _url += signature;
      _headers = {
        ...headers,
        'X-MBX-APIKEY': this.API_KEY,
      };
    }

    if (typeof params !== 'string') {
      params = qs.stringify(_options);
      _url += `?${params}`;
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
  };

  /**
   * Spot account requests
   */
  this.spot = {
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

      let candlesticks = await _binanceFetch({
        endpoint: candlesticksEndpoint,
      }, false, _options);

      const getAdditionalCandlesticks = async (limit, lastCandle) => {
        const endTime = lastCandle[0];

        if (limit > 1000) {
          const additionalCandlesticks = await _binanceFetch({
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
        const additionalCandlesticks = await _binanceFetch({
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

      return Array.isArray(candlesticks) ? candlesticks.map(([
        openTime, o, h, l, c, volume, closeTime, quoteVolume, numberOfTrades, takerBuyVolume, takerBuyQuoteVolume,
      ]) => ({
        openTime,
        closeTime,
        numberOfTrades,
        o: +o,
        h: +h,
        l: +l,
        c: +c,
        volume: +volume,
        quoteVolume: +quoteVolume,
        takerBuyVolume: +takerBuyVolume,
        takerBuyQuoteVolume: +takerBuyQuoteVolume,
      })) : candlesticks;
    },

    filters: async () => {
      const filtersEndpoint = '/api/v3/exchangeInfo';

      const { symbols } = await _binanceFetch({ endpoint: filtersEndpoint }, false);

      return symbols.reduce((allFilters, { symbol, filters: marketFilters }) => {
        // eslint-disable-next-line no-param-reassign
        allFilters[symbol] = marketFilters.reduce((acc, { filterType, ..._filters }) => {
          acc[filterType] = _filters;
          return acc;
        }, {});
        return allFilters;
      }, {});
    },

    /* ---- SIGNED REQUESTS ---- */

    /**
     * Get user balances
     */
    getUserBalances: async () => {
      const accountEndpoint = '/api/v3/account';

      const data = await _binanceFetch({
        endpoint: accountEndpoint,
        method: 'GET',
      }, true);

      if (!data) {
        return [];
      }

      if (!data.balances) {
        logger('error', 'BalanceData error:', data);
      }

      return data.balances.map(({ asset, free, locked }) => ({ asset, available: free, inOrder: locked }));
    },

    getOpenOrders: async () => {
      const allOrdersEndpoint = '/api/v3/openOrders';

      const data = await _binanceFetch({
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

      const data = await _binanceFetch({
        endpoint: newOrderEndpoint,
        method: 'POST',
      }, true, _options);

      return data;
    },
  };

  this.spotWebsockets = {
    get() {
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

      const initWebsocket = (streamNames, reconnecting = false) => {
        if (this.websocket && !reconnecting) {
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

          if (typeof data === 'object' && data.stream) {
            Object.keys(this.onMessageFunctions).forEach((fnKey) => {
              if (data.stream.includes(fnKey)) {
                this.onMessageFunctions[fnKey](data);
              }
            });
          }
        });

        this.websocket.on('close', () => {
          initWebsocket(this.streams, true);
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
    },
  };
}

module.exports = Binance;
