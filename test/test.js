require('dotenv').config();

const Binance = require('../main');

const test = async () => {
  const binance = new Binance({
    API_KEY: process.env.API_KEY,
    SECRET_KEY: process.env.SECRET_KEY,
  });

  const candlesticks = await binance.spot.candlesticks('BTCUSDT', '15m', { limit: 500 });
  // const buy = await binance.spot.sendOrder('ETHUSDT', 'BUY', 'MARKET', 0.001);
  // const sell = await binance.spot.sendOrder('ETHUSDT', 'SELL', 'MARKET', 0.001);
  const userBalances = await binance.spot.getUserBalances();
  // const filters = await binance.spot.filters();

  binance.spotWebsockets.candlesticks([['ETHUSDT', '1m']], () => {
    console.log('lol')
  });

  console.log(userBalances);
};

test();
