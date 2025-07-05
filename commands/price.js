import { SlashCommandBuilder, EmbedBuilder, MessageFlags } from "discord.js"
import { getDatabase } from "../utils/database.js"
import { logger } from "../utils/logger.js"
import fetch from "node-fetch"

export const data = new SlashCommandBuilder()
  .setName("price")
  .setDescription("Show current cryptocurrency prices")
  .addStringOption((option) =>
    option
      .setName("symbol")
      .setDescription("Cryptocurrency symbol (e.g., BTC, ETH, AEGS)")
      .setRequired(false)
  )

export async function execute(interaction) {
  try {
    const serverId = interaction.guildId
    const db = getDatabase(serverId)
    const symbol = interaction.options.getString("symbol")?.toUpperCase()

    // Defer reply as this might take some time
    await interaction.deferReply()

    if (symbol) {
      // Show price for a specific cryptocurrency
      await showSinglePrice(interaction, db, symbol)
    } else {
      // Show prices for all accepted cryptocurrencies
      await showAllPrices(interaction, db)
    }
  } catch (error) {
    logger.error("Error in price command:", error)
    
    try {
      if (interaction.deferred) {
        await interaction.editReply({
          content: "❌ An error occurred while fetching cryptocurrency prices.",
          embeds: []
        })
      } else {
        await interaction.reply({
          content: "❌ An error occurred while fetching cryptocurrency prices.",
          flags: MessageFlags.Ephemeral
        })
      }
    } catch (followUpError) {
      logger.error("Error sending price error message:", followUpError)
    }
  }
}

async function showSinglePrice(interaction, db, symbol) {
  // Get price data
  const priceData = await getCryptoPrice(symbol)
  
  if (!priceData) {
    await interaction.editReply({
      content: `❌ Could not fetch price data for ${symbol}. Please check the symbol and try again.`,
      embeds: []
    })
    return
  }
  
  // Create embed
  const embed = new EmbedBuilder()
    .setTitle(`${priceData.name} (${symbol}) Price`)
    .setDescription(`Current price information for ${priceData.name}`)
    .setColor(priceData.priceChange24h >= 0 ? "#4CAF50" : "#F44336")
    .addFields(
      { 
        name: "Current Price", 
        value: `$${priceData.price.toFixed(8)}`, 
        inline: true 
      },
      { 
        name: "24h Change", 
        value: `${priceData.priceChange24h >= 0 ? "🟢" : "🔴"} ${priceData.priceChange24h.toFixed(2)}%`, 
        inline: true 
      },
      { 
        name: "24h Volume", 
        value: `$${formatNumber(priceData.volume24h)}`, 
        inline: true 
      },
      { 
        name: "Market Cap", 
        value: `$${formatNumber(priceData.marketCap)}`, 
        inline: true 
      },
      { 
        name: "Circulating Supply", 
        value: `${formatNumber(priceData.circulatingSupply)} ${symbol}`, 
        inline: true 
      }
    )
    .setFooter({ text: "Powered By Aegisum Eco System • Prices update every minute" })
    .setTimestamp()
  
  // Add thumbnail if available
  if (priceData.logoUrl) {
    embed.setThumbnail(priceData.logoUrl)
  }
  
  await interaction.editReply({ embeds: [embed] })
}

async function showAllPrices(interaction, db) {
  // Get accepted cryptocurrencies from database
  const acceptedCurrencies = db.config?.acceptedCryptocurrencies || [
    "AEGS", "BTC", "ETH", "USDT", "SOL", "XRP", "DOGE", "SHIB", "BNB", "LTC"
  ]
  
  // Fetch prices for all currencies
  const pricePromises = acceptedCurrencies.map(symbol => getCryptoPrice(symbol))
  const priceResults = await Promise.all(pricePromises)
  
  // Filter out failed requests
  const prices = priceResults.filter(price => price !== null)
  
  if (prices.length === 0) {
    await interaction.editReply({
      content: "❌ Could not fetch price data for any cryptocurrencies. Please try again later.",
      embeds: []
    })
    return
  }
  
  // Create embed
  const embed = new EmbedBuilder()
    .setTitle("Cryptocurrency Prices")
    .setDescription("Current prices for accepted cryptocurrencies")
    .setColor(db.config?.theme?.info || "#00BCD4")
    .setFooter({ text: "Powered By Aegisum Eco System • Prices update every minute" })
    .setTimestamp()
  
  // Add fields for each cryptocurrency
  for (const price of prices) {
    embed.addFields({
      name: `${price.name} (${price.symbol})`,
      value: `$${price.price.toFixed(8)} ${price.priceChange24h >= 0 ? "🟢" : "🔴"} ${price.priceChange24h.toFixed(2)}%`,
      inline: true
    })
  }
  
  await interaction.editReply({ embeds: [embed] })
}

async function getCryptoPrice(symbol) {
  try {
    // Normalize symbol
    const normalizedSymbol = symbol.toUpperCase()
    
    // Try Aegisum API first for AEGS
    if (normalizedSymbol === 'AEGS') {
      const aegsPrice = await getAegisumPrice(normalizedSymbol)
      if (aegsPrice) return aegsPrice
    }
    
    // Try CoinGecko API
    const geckoPrice = await getCoinGeckoPrice(normalizedSymbol)
    if (geckoPrice) return geckoPrice
    
    // Try CoinMarketCap API as fallback
    const cmcPrice = await getCoinMarketCapPrice(normalizedSymbol)
    if (cmcPrice) return cmcPrice
    
    // If all APIs fail, log warning
    logger.warn(`❌ Could not fetch price for ${normalizedSymbol} from any API`)
    return null
  } catch (error) {
    logger.error(`Error in getCryptoPrice for ${symbol}:`, error)
    return null
  }
}

async function getAegisumPrice(symbol) {
  try {
    if (symbol !== 'AEGS') return null
    
    const response = await fetch('https://aegisum.com/api/coins/aegs/')
    
    if (!response.ok) {
      logger.warn(`Aegisum API returned status ${response.status} for ${symbol}`)
      return null
    }
    
    const data = await response.json()
    
    if (data && data.price) {
      return {
        symbol: 'AEGS',
        name: 'Aegisum',
        price: parseFloat(data.price),
        priceChange24h: parseFloat(data.priceChange24h) || 0,
        volume24h: parseFloat(data.volume24h) || 0,
        marketCap: parseFloat(data.marketCap) || 0,
        circulatingSupply: parseFloat(data.circulatingSupply) || 0,
        logoUrl: data.logoUrl || 'https://aegisum.com/aegs.png'
      }
    }
    
    return null
  } catch (error) {
    logger.error(`Error fetching Aegisum price for ${symbol}:`, error)
    return null
  }
}

async function getCoinGeckoPrice(symbol) {
  try {
    // Map of common symbols to CoinGecko IDs
    const symbolToId = {
      'BTC': 'bitcoin',
      'ETH': 'ethereum',
      'USDT': 'tether',
      'SOL': 'solana',
      'XRP': 'ripple',
      'DOGE': 'dogecoin',
      'SHIB': 'shiba-inu',
      'BNB': 'binancecoin',
      'LTC': 'litecoin'
    }
    
    const coinId = symbolToId[symbol]
    if (!coinId) return null
    
    const response = await fetch(`https://api.coingecko.com/api/v3/coins/${coinId}?localization=false&tickers=false&community_data=false&developer_data=false`)
    
    if (!response.ok) {
      logger.warn(`CoinGecko API returned status ${response.status} for ${symbol}`)
      return null
    }
    
    const data = await response.json()
    
    if (data && data.market_data && data.market_data.current_price) {
      return {
        symbol: symbol,
        name: data.name,
        price: data.market_data.current_price.usd,
        priceChange24h: data.market_data.price_change_percentage_24h || 0,
        volume24h: data.market_data.total_volume.usd || 0,
        marketCap: data.market_data.market_cap.usd || 0,
        circulatingSupply: data.market_data.circulating_supply || 0,
        logoUrl: data.image?.small
      }
    }
    
    return null
  } catch (error) {
    logger.error(`Error fetching CoinGecko price for ${symbol}:`, error)
    return null
  }
}

async function getCoinMarketCapPrice(symbol) {
  try {
    const apiKey = process.env.COINMARKETCAP_API_KEY
    if (!apiKey) return null

    const response = await fetch(
      `https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest?symbol=${symbol}`,
      {
        headers: {
          "X-CMC_PRO_API_KEY": apiKey,
        },
      },
    )

    if (!response.ok) {
      logger.warn(`CoinMarketCap API returned status ${response.status} for ${symbol}`)
      return null
    }

    const data = await response.json()
    const coinData = data.data?.[symbol]
    
    if (coinData) {
      return {
        symbol: symbol,
        name: coinData.name,
        price: coinData.quote.USD.price,
        priceChange24h: coinData.quote.USD.percent_change_24h || 0,
        volume24h: coinData.quote.USD.volume_24h || 0,
        marketCap: coinData.quote.USD.market_cap || 0,
        circulatingSupply: coinData.circulating_supply || 0,
        logoUrl: null // CMC API doesn't provide logo URLs in this endpoint
      }
    }

    return null
  } catch (error) {
    logger.error(`Error fetching CoinMarketCap price for ${symbol}:`, error)
    return null
  }
}

function formatNumber(num) {
  if (num === undefined || num === null) return "N/A"
  
  if (num >= 1e9) {
    return `${(num / 1e9).toFixed(2)}B`
  } else if (num >= 1e6) {
    return `${(num / 1e6).toFixed(2)}M`
  } else if (num >= 1e3) {
    return `${(num / 1e3).toFixed(2)}K`
  } else {
    return num.toFixed(2)
  }
}