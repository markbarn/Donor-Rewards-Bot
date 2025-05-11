// crypto-price-api.js
import fetch from 'node-fetch';

// API Configuration
const API_KEYS = {
  COINMARKETCAP: process.env.COINMARKETCAP_API_KEY || '', // Add your key here or in .env
  COINGECKO_PRO: process.env.COINGECKO_PRO_API_KEY || '', // Optional, for pro tier
  COINPAPRIKA_PRO: process.env.COINPAPRIKA_PRO_API_KEY || '' // Optional, for pro tier
};

// API Base URLs
const API_URLS = {
  COINGECKO: 'https://api.coingecko.com/api/v3',
  COINMARKETCAP: 'https://pro-api.coinmarketcap.com/v1',
  COINPAPRIKA: 'https://api.coinpaprika.com/v1'
};

// Cache for crypto prices to avoid excessive API calls
const priceCache = {
  prices: {},
  lastUpdated: {}
};

// Cache expiration time (5 minutes)
const CACHE_EXPIRY = 5 * 60 * 1000;

// Common symbol mappings across APIs
// This helps with standardizing symbols that might be different across APIs
const SYMBOL_MAPPINGS = {
  // Add any special mappings here
  'USDT': 'tether',
  'BTC': 'bitcoin',
  'ETH': 'ethereum',
  'TON': 'the-open-network',
  'PEPE': 'pepecoin-network',
  'BONC': 'bonc1-bonkcoin',
  'SHIC': 'shic-shibacoin',
  'AEGS': 'aegs-aegisum',
  'BNB': 'binancecoin',
  'USDC': 'usd-coin',
  'LTC': 'litecoin',
  'XRP': 'ripple',
  'ADA': 'cardano',
  'AVAX': 'avalanche-2',
  'TRX': 'tron',
  'DOGE': 'dogecoin',
  'SHIB': 'shiba-inu',
  // Add more as needed
};

// Then, in the MANUAL_PRICE_OVERRIDES object, remove the PEPE entry or comment it out
const MANUAL_PRICE_OVERRIDES = {
  // 'PEPE': 0.0000002071, // Removing this override to use API pricing
  // 'SHIC': 0.00000001, // Removing this override to use API pricing
  // Add more as needed
};

// Logging function
function logMessage(message) {
  console.log(`[Crypto API] ${message}`);
}

/**
 * Get cryptocurrency price from CoinGecko
 * @param {string} symbol - Cryptocurrency symbol
 * @returns {Promise<number|null>} - Price in USD or null if not found
 */
async function getPriceFromCoinGecko(symbol) {
  try {
    const normalizedSymbol = symbol.toLowerCase();
    
    // Try direct ID first (for common coins)
    let coinId = SYMBOL_MAPPINGS[symbol.toUpperCase()] || normalizedSymbol;
    
    // API URL with or without key
    let apiUrl = `${API_URLS.COINGECKO}/simple/price?ids=${coinId}&vs_currencies=usd`;
    if (API_KEYS.COINGECKO_PRO) {
      apiUrl += `&x_cg_pro_api_key=${API_KEYS.COINGECKO_PRO}`;
    }
    
    const response = await fetch(apiUrl);
    
    if (!response.ok) {
      // If direct ID fails, try searching
      if (response.status === 404) {
        return await searchCoinGecko(symbol);
      }
      throw new Error(`CoinGecko API error: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data[coinId] && data[coinId].usd) {
      logMessage(`CoinGecko price for ${symbol}: $${data[coinId].usd}`);
      return data[coinId].usd;
    }
    
    // If direct lookup fails, try searching
    return await searchCoinGecko(symbol);
    
  } catch (error) {
    logMessage(`CoinGecko error for ${symbol}: ${error.message}`);
    return null;
  }
}

/**
 * Search for a coin on CoinGecko
 * @param {string} symbol - Cryptocurrency symbol
 * @returns {Promise<number|null>} - Price in USD or null if not found
 */
async function searchCoinGecko(symbol) {
  try {
    const normalizedSymbol = symbol.toLowerCase();
    
    // Search for the coin
    const searchUrl = `${API_URLS.COINGECKO}/search?query=${normalizedSymbol}`;
    const searchResponse = await fetch(searchUrl);
    
    if (!searchResponse.ok) {
      throw new Error(`CoinGecko search API error: ${searchResponse.status}`);
    }
    
    const searchData = await searchResponse.json();
    
    if (!searchData.coins || searchData.coins.length === 0) {
      return null;
    }
    
    // Find exact symbol match
    const exactMatch = searchData.coins.find(
      coin => coin.symbol.toLowerCase() === normalizedSymbol
    );
    
    const coinId = exactMatch ? exactMatch.id : searchData.coins[0].id;
    
    // Get price for the found coin
    const priceUrl = `${API_URLS.COINGECKO}/simple/price?ids=${coinId}&vs_currencies=usd`;
    const priceResponse = await fetch(priceUrl);
    
    if (!priceResponse.ok) {
      throw new Error(`CoinGecko price API error: ${priceResponse.status}`);
    }
    
    const priceData = await priceResponse.json();
    
    if (priceData[coinId] && priceData[coinId].usd) {
      logMessage(`CoinGecko search price for ${symbol}: $${priceData[coinId].usd}`);
      return priceData[coinId].usd;
    }
    
    return null;
  } catch (error) {
    logMessage(`CoinGecko search error for ${symbol}: ${error.message}`);
    return null;
  }
}

/**
 * Get cryptocurrency price from CoinMarketCap
 * @param {string} symbol - Cryptocurrency symbol
 * @returns {Promise<number|null>} - Price in USD or null if not found
 */
async function getPriceFromCoinMarketCap(symbol) {
  // Skip if no API key
  if (!API_KEYS.COINMARKETCAP) {
    return null;
  }
  
  try {
    const normalizedSymbol = symbol.toUpperCase();
    
    const response = await fetch(
      `${API_URLS.COINMARKETCAP}/cryptocurrency/quotes/latest?symbol=${normalizedSymbol}`, 
      {
        headers: {
          'X-CMC_PRO_API_KEY': API_KEYS.COINMARKETCAP,
          'Accept': 'application/json'
        }
      }
    );
    
    if (!response.ok) {
      throw new Error(`CoinMarketCap API error: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.data && data.data[normalizedSymbol] && 
        data.data[normalizedSymbol].quote && 
        data.data[normalizedSymbol].quote.USD) {
      const price = data.data[normalizedSymbol].quote.USD.price;
      logMessage(`CoinMarketCap price for ${symbol}: $${price}`);
      return price;
    }
    
    return null;
  } catch (error) {
    logMessage(`CoinMarketCap error for ${symbol}: ${error.message}`);
    return null;
  }
}

/**
 * Get cryptocurrency price from CoinPaprika
 * @param {string} symbol - Cryptocurrency symbol
 * @returns {Promise<number|null>} - Price in USD or null if not found
 */
async function getPriceFromCoinPaprika(symbol) {
  try {
    const normalizedSymbol = symbol.toLowerCase();
    
    // First, search for the coin to get its ID
    const searchResponse = await fetch(`${API_URLS.COINPAPRIKA}/search?q=${normalizedSymbol}&c=currencies`);
    
    if (!searchResponse.ok) {
      throw new Error(`CoinPaprika search API error: ${searchResponse.status}`);
    }
    
    const searchData = await searchResponse.json();
    
    // Find the coin with matching symbol
    const matchingCoin = searchData.currencies?.find(
      coin => coin.symbol.toLowerCase() === normalizedSymbol
    );
    
    if (!matchingCoin) {
      return null;
    }
    
    // Get price using the coin ID
    const priceResponse = await fetch(`${API_URLS.COINPAPRIKA}/tickers/${matchingCoin.id}`);
    
    if (!priceResponse.ok) {
      throw new Error(`CoinPaprika price API error: ${priceResponse.status}`);
    }
    
    const priceData = await priceResponse.json();
    
    if (priceData.quotes && priceData.quotes.USD && priceData.quotes.USD.price) {
      const price = priceData.quotes.USD.price;
      logMessage(`CoinPaprika price for ${symbol}: $${price}`);
      return price;
    }
    
    return null;
  } catch (error) {
    logMessage(`CoinPaprika error for ${symbol}: ${error.message}`);
    return null;
  }
}

/**
 * Extract USD price from tip.cc message
 * @param {string} message - The tip.cc message content
 * @param {number} cryptoAmount - The cryptocurrency amount
 * @returns {number|null} - Calculated price per unit or null if not found
 */
export function extractPriceFromTipMessage(message, cryptoAmount) {
  try {
    // Look for patterns like "(≈ $1.00)" in the message
    const usdPattern = /$$≈\s*\$([0-9,.]+)$$/i;
    const match = message.match(usdPattern);
    
    if (match && match[1] && cryptoAmount > 0) {
      // Extract the USD amount and calculate price per unit
      const totalUsdValue = parseFloat(match[1].replace(/,/g, ''));
      const pricePerUnit = totalUsdValue / cryptoAmount;
      
      logMessage(`Extracted price from tip.cc message: $${pricePerUnit}`);
      return pricePerUnit;
    }
    
    return null;
  } catch (error) {
    logMessage(`Error extracting price from tip.cc message: ${error.message}`);
    return null;
  }
}

/**
 * Get cryptocurrency price from all available APIs with fallbacks
 * @param {string} symbol - Cryptocurrency symbol
 * @param {string} [tipMessage] - Optional tip.cc message for price extraction
 * @param {number} [cryptoAmount] - Optional crypto amount for price calculation
 * @returns {Promise<number|null>} - Price in USD or null if not found
 */
export async function getCryptoPrice(symbol, tipMessage = null, cryptoAmount = null) {
  if (!symbol) return null;
  
  const normalizedSymbol = symbol.toUpperCase();
  
  // Check for manual price override first
  if (MANUAL_PRICE_OVERRIDES[normalizedSymbol]) {
    logMessage(`Using manual price override for ${normalizedSymbol}: $${MANUAL_PRICE_OVERRIDES[normalizedSymbol]}`);
    return MANUAL_PRICE_OVERRIDES[normalizedSymbol];
  }
  
  // Check cache next
  if (priceCache.prices[normalizedSymbol] && 
      (Date.now() - priceCache.lastUpdated[normalizedSymbol] < CACHE_EXPIRY)) {
    logMessage(`Using cached price for ${normalizedSymbol}: $${priceCache.prices[normalizedSymbol]}`);
    return priceCache.prices[normalizedSymbol];
  }
  
  // Extract price from tip.cc message if available
  let tipPrice = null;
  if (tipMessage && cryptoAmount) {
    tipPrice = extractPriceFromTipMessage(tipMessage, cryptoAmount);
  }
  
  // Try each API in sequence until we get a price
  let apiPrice = null;
  
  // Try CoinGecko first (most generous free tier)
  apiPrice = await getPriceFromCoinGecko(normalizedSymbol);
  
  // If CoinGecko fails, try CoinMarketCap
  if (apiPrice === null && API_KEYS.COINMARKETCAP) {
    apiPrice = await getPriceFromCoinMarketCap(normalizedSymbol);
  }
  
  // If both fail, try CoinPaprika
  if (apiPrice === null) {
    apiPrice = await getPriceFromCoinPaprika(normalizedSymbol);
  }
  
  // Determine which price to use
  let finalPrice = null;
  
  if (tipPrice !== null && apiPrice !== null) {
    // If both prices are available, check if they're significantly different
    const priceDifference = Math.abs(tipPrice - apiPrice) / Math.max(tipPrice, apiPrice);
    
    if (priceDifference > 0.2) { // If more than 20% difference
      logMessage(`Large price discrepancy for ${normalizedSymbol}: tip.cc $${tipPrice} vs API $${apiPrice}`);
      // Prefer tip.cc price for meme coins and tokens
      if (['PEPE', 'SHIB', 'DOGE', 'SHIC', 'BONC'].includes(normalizedSymbol)) {
        finalPrice = tipPrice;
      } else {
        finalPrice = apiPrice;
      }
    } else {
      // If prices are close, use API price as it's likely more accurate for most coins
      finalPrice = apiPrice;
    }
  } else {
    // Use whichever price is available
    finalPrice = tipPrice !== null ? tipPrice : apiPrice;
  }
  
  // If we got a price, update the cache
  if (finalPrice !== null) {
    priceCache.prices[normalizedSymbol] = finalPrice;
    priceCache.lastUpdated[normalizedSymbol] = Date.now();
  }
  
  return finalPrice;
}

/**
 * Get multiple cryptocurrency prices at once
 * @param {string[]} symbols - Array of cryptocurrency symbols
 * @returns {Promise<Object>} - Object mapping symbols to prices
 */
export async function getMultipleCryptoPrices(symbols) {
  const prices = {};
  
  for (const symbol of symbols) {
    if (!symbol) continue;
    const normalizedSymbol = symbol.toUpperCase();
    prices[normalizedSymbol] = await getCryptoPrice(normalizedSymbol);
  }
  
  return prices;
}

/**
 * Clear the price cache
 */
export function clearPriceCache() {
  priceCache.prices = {};
  priceCache.lastUpdated = {};
  logMessage('Price cache cleared');
}

/**
 * Get information about the price cache
 * @returns {Object} - Cache statistics
 */
export function getCacheStats() {
  return {
    cacheSize: Object.keys(priceCache.prices).length,
    cachedCoins: Object.keys(priceCache.prices),
    oldestCacheEntry: Math.min(...Object.values(priceCache.lastUpdated)),
    newestCacheEntry: Math.max(...Object.values(priceCache.lastUpdated))
  };
}
