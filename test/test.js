require('dotenv').config();

const Binance = require('../main');

const test = async () => {
  const binance = new Binance({
    API_KEY: process.env.API_KEY,
    SECRET_KEY: process.env.SECRET_KEY,
  });
  await binance.init();

  const candlesticks = await binance.spot.candlesticks('BTCUSDT', '15m', { limit: 20000 });
  // const sendOrder = await binance.spot.sendOrder('BTCUSDT', 'BUY', 'MARKET', 0.001);
  // const userBalances = await binance.spot.getUserBalances();
  // const filters = await binance.spot.filters();

  console.log(candlesticks);
};

test();
