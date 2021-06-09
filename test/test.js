require('dotenv').config();

const Binance = require('../main');

const test = async () => {
  const binance = new Binance({
    API_KEY: process.env.API_KEY,
    SECRET_KEY: process.env.SECRET_KEY,
  });

  try {
    // const candlesticks = await binance
    //   .spot
    //   .candlesticks('BTCUSDT', '1h', /* { limit: 20 } */ { startTime: new Date().getTime() - 1000 * 60 * 60 * 24, endTime: new Date().getTime() });
    // console.log(new Date(candlesticks[0].openTime), new Date(candlesticks[candlesticks.length - 1].openTime), candlesticks.length);
    // candlesticks.forEach(({ openTime }) => console.log(new Date(openTime)));
    // console.log(await binance.spot.candlesticks('BTCUSDT', '1h', { limit: 10 }));

    // console.log(await binance.spot.accountBalances());

    // console.log(await binance.spot.sendOrder('BTCUSDT', 'BUY', 'MARKET', 0.001));

    // console.log(await binance.spot.filters());

    // console.log(await binance.spot.openOrders());

    // binance.spotWebsockets.candlesticks([['ETHUSDT', '1m']], (data) => {
    //   console.log(data);
    // });

    // binance.spotWebsockets.allTickers((data) => {
    //   console.log(data);
    // });
  } catch (error) {
    console.error(error);
  }
};

test();
