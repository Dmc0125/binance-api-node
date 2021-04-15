require('dotenv').config();

const Binance = require('../main');

const test = async () => {
  const binance = new Binance({
    API_KEY: process.env.API_KEY,
    SECRET_KEY: process.env.SECRET_KEY,
  });
  await binance.init();

  // const candlesticks = await binance.spot.candlesticks('BTCUSDT', '4h', { limit: 100 });
  // const userBalances = await binance.spot.sendOrder('BTCUSDT', 'BUY', 'MARKET', 0.001);

  // console.log(userBalances);
};

test();
