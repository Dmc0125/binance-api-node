require('dotenv').config();

const Binance = require('../main');

const test = async () => {
  const binance = new Binance({
    API_KEY: process.env.API_KEY,
    SECRET_KEY: process.env.SECRET_KEY,
  });

  try {
    console.log(await binance.spot.candlesticks('BTCUSDT', '15m', { limit: 5 }));

    console.log(await binance.spot.accountBalances());

    console.log(await binance.spot.sendOrder('BTCUSDT', 'BUY', 'MARKET', 0.001));

    console.log(await binance.spot.filters());

    console.log(await binance.spot.openOrders());

    binance.spotWebsockets.candlesticks([['ETHUSDT', '1m']], (data) => {
      console.log(data);
    });

    binance.spotWebsockets.allTickers((data) => {
      console.log(data);
    });
  } catch (error) {
    console.error(error);
  }
};

test();
