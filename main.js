const Websocket = require('ws');
const qs = require('qs');
const fetch = require('node-fetch');

const logger = require('./helpers/logger');
const encode = require('./helpers/encode');

class Binance {
  constructor(options = undefined) {
    this.API_URL = 'https://api.binance.com';
    this.WS_URL = 'wss://stream.binance.com:9443/stream?streams=';

    this.API_KEY = undefined;
    this.SECRET_KEY = undefined;

    if (options) {
      this.API_KEY = options.API_KEY;
      this.SECRET_KEY = options.SECRET_KEY;
    }

    this._timeDiff = null;

    this._websocket = null;
    this._streams = [];
    this._onMessageFunctions = {};
  }

  async _setBinanceTimeDiff() {
    const timeEndpoint = '/api/v3/time';

    const res = await fetch(`${this.API_URL}${timeEndpoint}`);
    const data = await res.json();

    if (!res.ok) {
      // eslint-disable-next-line no-throw-literal
      throw { success: false, ...data };
    }

    this._timeDiff = new Date().getTime() - data.serverTime;
  }

  async _binanceFetch({ endpoint, method = 'GET', headers }, signed, options) {
    let _url = `${this.API_URL}${endpoint}`;
    let _headers = headers;

    const _options = {
      ...options,
    };

    let params = null;

    if (signed) {
      if (!this.API_KEY || !this.SECRET_KEY) {
        throw Error('Invalid api key or secret key');
      }

      await this._setBinanceTimeDiff();
      _options.timestamp = new Date().getTime() - (this._timeDiff || 0);

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

    const res = await fetch(_url, {
      method,
      headers: _headers,
    });

    const data = await res.json();

    if (!res.ok) {
      // eslint-disable-next-line no-throw-literal
      throw { status: res.status, ...data };
    }

    return data;
  }

  get spot() {
    return {
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

        return candlesticks.map(([
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
        }));
      },

      filters: async () => {
        const filtersEndpoint = '/api/v3/exchangeInfo';

        const { symbols } = await this._binanceFetch({ endpoint: filtersEndpoint }, false);

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

      accountBalances: async () => {
        const accountEndpoint = '/api/v3/account';

        const data = await this._binanceFetch({
          endpoint: accountEndpoint,
          method: 'GET',
        }, true);

        return data.balances.map(({ asset, free, locked }) => ({ asset, available: free, inOrder: locked }));
      },

      openOrders: async (options = undefined) => {
        const allOrdersEndpoint = '/api/v3/openOrders';

        const data = await this._binanceFetch({
          endpoint: allOrdersEndpoint,
          method: 'GET',
        }, true, options);

        return data;
      },

      sendOrder: async (symbol, side, type, quantity, options = undefined) => {
        const newOrderEndpoint = '/api/v3/order';

        let _options = {
          symbol,
          side,
          type,
          quantity,
          newOrderRespType: 'FULL',
        };

        if (options && typeof options === 'object') {
          _options = {
            ..._options,
            ...options,
          };
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
    return {
      candlesticks: (streamNames, onMessageFn) => {
        if (this._onMessageFunctions.candlesticks) {
          return;
        }

        const streams = streamNames.map(([symbol, timeframe]) => `${symbol.toLowerCase()}@kline_${timeframe}`);
        this._initWebsocket(streams);

        this._onMessageFunctions.kline = onMessageFn;
      },

      allTickers: (onMessageFn) => {
        if (this._onMessageFunctions.allTickers) {
          return;
        }

        const stream = '!ticker@arr';
        this._initWebsocket([stream]);

        this._onMessageFunctions[stream] = onMessageFn;
      },
    };
  }

  _initWebsocket(streamNames, reconnecting = false) {
    if (this._websocket && !reconnecting) {
      this._subscribe(streamNames);
      return;
    }

    this._streams = streamNames;

    this._websocket = new Websocket(`${this.WS_URL}${streamNames.join('/')}`, {
      method: 'SUBSCRIBE',
      id: 1,
    });

    this._websocket.on('open', () => {
      logger('info', 'Listening to streams:', this._streams.join(', '), '\n');
    });

    this._websocket.on('message', (dataJSON) => {
      const data = JSON.parse(dataJSON);

      if (typeof data === 'object' && data.stream) {
        Object.keys(this._onMessageFunctions).forEach((fnKey) => {
          if (data.stream.includes(fnKey)) {
            this._onMessageFunctions[fnKey](data);
          }
        });
      }
    });

    this._websocket.on('close', () => {
      this._initWebsocket(this._streams, true);
    });
  }

  _subscribe(streamNames) {
    if (this._websocket.readyState === 1) {
      this._streams = [...this._streams, ...streamNames];
      this._websocket.send(JSON.stringify({
        method: 'SUBSCRIBE',
        params: streamNames,
        id: 2,
      }));
      logger('info', 'Listening to streams:', this._streams.join(', '));
    }

    if (this._websocket.readyState === 0) {
      setTimeout(() => {
        this._subscribe(streamNames);
      }, 5000);
    }
  }
}

module.exports = Binance;
