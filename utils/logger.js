import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const LOG_DIR = path.join(__dirname, "..", "logs")

// Ensure logs directory exists
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true })
}

class Logger {
  constructor() {
    this.logFile = path.join(LOG_DIR, `bot-${new Date().toISOString().split("T")[0]}.log`)
  }

  log(level, message, data = null) {
    const timestamp = new Date().toISOString()
    const logEntry = `[${timestamp}] [${level.toUpperCase()}] ${message}${data ? ` | Data: ${JSON.stringify(data)}` : ""}`

    // Console output
    console.log(`${level === "error" ? "❌" : level === "warn" ? "⚠️" : "ℹ️"} ${message}`)

    // File output
    try {
      fs.appendFileSync(this.logFile, logEntry + "\n")
    } catch (error) {
      console.error("Failed to write to log file:", error)
    }
  }

  info(message, data = null) {
    this.log("info", message, data)
  }

  warn(message, data = null) {
    this.log("warn", message, data)
  }

  error(message, data = null) {
    this.log("error", message, data)
  }

  debug(message, data = null) {
    if (process.env.NODE_ENV === "development") {
      this.log("debug", message, data)
    }
  }
}

export const logger = new Logger()
