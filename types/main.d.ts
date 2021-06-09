export = Binance;

declare namespace Binance {
  export interface BinanceOptions {
    API_KEY: string;
    SECRET_KEY: string;
  }
  
  // TODO: Use namespaces such as options...
  // METHOD OPTIONS

  export interface CandlesticksOptions {
    startTime?: number;
    endTime?: number;
    limit?: number;
  }

  export interface OpenOrdersOptions {
    symbol?: string;
    recvWindow?: number;
  }

  export type OrderSide = 'BUY' | 'SELL';

  // TODO: Add more send order types
  export type OrderType = 'MARKET' | 'LIMIT' | string;

  export interface SendOrderOptions {
    // TODO: Add specific timeInForce types
    timeInForce?: string;
    newClientOrderId?: string;
    stopPrice?: number;
    icebergQty?: number;
    quoteOrderQty?: number;
    recvWindow?: number;
  }

  // METHOD RESPONSES

  export interface CandlesticksResponse {
    openTime: number;
    closeTime: number;
    numberOfTrades: number;
    o: number;
    h: number;
    l: number;
    c: number;
    volume: number;
    quoteVolume: number;
    takerBuyVolume: number;
    takerBuyQuoteVolume: number;
  }



  export namespace FilterTypes {
    export interface PriceFilter {
      minPrice: string;
      maxPrice: string;
      tickSize: string;
    }

    export interface PercentPrice {
      multiplierUp: string,
      multiplierDown: string,
      avgPriceMins: number,
    }

    export interface LotSize {
      minQty: string;
      maxQty: string;
      stepSize: string;
    }

    export interface MinNotional {
      minNotional: string;
      applyToMarket: boolean;
      avgPriceMins: number;
    }

    export interface IcebergParts {
      limit: number;
    }

    export interface MarketLotSize {
      minQty: string;
      maxQty: string;
      stepSize: string;
    }

    export interface MaxNumOrders {
      maxNumOrders: number;
    }

    export interface MaxNumAlgoOrders {
      maxNumAlgoOrders: number;
    }
  }

  export interface Filters {
    PRICE_FILTER: FilterTypes.PriceFilter;
    PERCENT_PRICE: FilterTypes.PercentPrice;
    LOT_SIZE: FilterTypes.LotSize;
    MIN_NOTIONAL: FilterTypes.MinNotional;
    ICEBERG_PARTS: FilterTypes.IcebergParts,
    MARKET_LOT_SIZE: FilterTypes.MarketLotSize;
    MAX_NUM_ORDERS: FilterTypes.MaxNumOrders,
    MAX_NUM_ALGO_ORDERS: FilterTypes.MaxNumAlgoOrders;
  }

  export interface FiltersResponse {
    [market: string]: Filters;
  }


  export interface OpenOrdersResponse {
    symbol: string;
    orderId: number;
    orderListId: number;
    clientOrderId: string;
    price: string;
    origQty: string;
    executedQty: string;
    cummulativeQuoteQty: string;
    status: string;
    timeInForce: string;
    type: string;
    side: string;
    stopPrice: string;
    icebergQty: string;
    time: number;
    updateTime: number;
    isWorking: boolean;
    origQuoteOrderQty: string;
  }

  export interface AccountBalancesResponse {
    asset: string;
    available: string;
    inOrder: string;
  }

  
  export interface OrderFill {
    price: string;
    qty: string;
    commission: string;
    commissionAsset: string;
  }

  export interface NewOrderResponse {
    symbol: string;
    orderId: number;
    orderListId: number;
    clientOrderId: string;
    transactTime: number;
    price: string;
    origQty: string;
    executedQty: string;
    cummulativeQuoteQty: string;
    status: string;
    timeInForce: string;
    type: OrderType;
    side: OrderSide;
    fills: OrderFill[];
  }

  // STREAMS OPTIONS

  export type StreamNames = [string, string];

  // STREAM MESSAGE

  export interface StreamMessage {
    stream: string;
  }


  export interface CandlesticksData {
    e: string;
    E: number;
    s: string;
    k: {
      t: number;
      T: number;
      s: string;
      i: string;
      f: number;
      L: number;
      o: string;
      c: string;
      h: string;
      l: string;
      v: string;
      n: number;
      x: boolean;
      q: string;
      V: string;
      Q: string;
      B: string;
    }
  }

  export interface CandlesticksMessage extends StreamMessage {
    data: CandlesticksData;
  }

  export interface AllTickersData {
    e: string,
    E: number,
    s: string,
    p: string,
    P: string,
    w: string,
    x: string;
    c: string;
    Q: string;
    b: string;
    B: string;
    a: string;
    A: string;
    o: string;
    h: string;
    l: string;
    v: string;
    q: string;
    O: number;
    C: number;
    F: number;
    L: number;
    n: number;
  }
  
  export interface AllTickersMessage extends StreamMessage {
    data: AllTickersData[];
  }
}

declare class Binance {
  constructor(options?: Binance.BinanceOptions);
  public API_URL: string;
  public WS_URL: string;
  public API_KEY: string;
  public SECRET_KEY: string;

  private _timeDiff;
  private _websocket;
  private _streams;
  private _onMessageFunctions;
  private _setBinanceTimeDiff;
  private _binanceFetch

  get spot(): {
      candlesticks: (symbol: string, interval: string, options?: Binance.CandlesticksOptions) => Promise<Binance.CandlesticksResponse[]>;

      filters: () => Promise<Binance.FiltersResponse>;

      openOrders: (options: Binance.OpenOrdersOptions) => Promise<Binance.OpenOrdersResponse[]>;

      accountBalances: () => Promise<Binance.AccountBalancesResponse[]>;

      sendOrder: (symbol: string, side: Binance.OrderSide, type: Binance.OrderType, quantity: number, options?: Binance.SendOrderOptions) => Promise<Binance.NewOrderResponse>;
  };

  get spotWebsockets(): {
      candlesticks: (streamNames: Binance.StreamNames[], callback: (message: Binance.CandlesticksMessage) => void) => void;

      allTickers: (callback: (message: Binance.AllTickersData) => void) => void;
  };

  private _initWebsocket;
  private _subscribe;
}
