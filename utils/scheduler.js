import schedule from "node-schedule"
import { logger } from "./logger.js"

class Scheduler {
  constructor() {
    this.jobs = new Map()
  }

  scheduleJob(name, cronExpression, callback) {
    try {
      // Cancel existing job if it exists
      if (this.jobs.has(name)) {
        this.jobs.get(name).cancel()
      }

      const job = schedule.scheduleJob(cronExpression, callback)
      this.jobs.set(name, job)

      logger.info(`Scheduled job: ${name} with expression: ${cronExpression}`)
      return job
    } catch (error) {
      logger.error(`Failed to schedule job ${name}:`, error)
      return null
    }
  }

  cancelJob(name) {
    if (this.jobs.has(name)) {
      this.jobs.get(name).cancel()
      this.jobs.delete(name)
      logger.info(`Cancelled job: ${name}`)
      return true
    }
    return false
  }

  listJobs() {
    return Array.from(this.jobs.keys())
  }
}

export const scheduler = new Scheduler()
