const getResolution = (timeframe) => {
  let resolution;

  switch (timeframe) {
    case '1m':
      resolution = 60;
      break;
    case '3m':
      resolution = 60 * 3;
      break;
    case '5m':
      resolution = 60 * 5;
      break;
    case '15m':
      resolution = 60 * 15;
      break;
    case '30m':
      resolution = 60 * 15 * 2;
      break;
    case '1h':
      resolution = 60 * 60;
      break;
    case '2h':
      resolution = 60 * 60 * 2;
      break;
    case '4h':
      resolution = 60 * 60 * 4;
      break;
    case '8h':
      resolution = 60 * 60 * 8;
      break;
    case '12h':
      resolution = 60 * 60 * 12;
      break;
    case '1d':
      resolution = 60 * 60 * 24;
      break;
    case '3d':
      resolution = 60 * 60 * 24 * 3;
      break;
    case '1w':
      resolution = 60 * 60 * 24 * 7;
      break;
    case '2w':
      resolution = 60 * 60 * 24 * 7 * 2;
      break;
    case '1M':
      resolution = 60 * 60 * 24 * 7 * 4;
      break;
    default:
      resolution = 1;
  }

  return resolution * 1000;
};

module.exports = getResolution;
