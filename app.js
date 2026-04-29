require('dotenv').config()
const express = require('express')
const cors = require('cors')

const { registerRoutes } = require('./factory/routeFactory')
const { routeConfig } = require('./routes/routeConfig')
const settingsRouter = require('./routes/settings.routes')
const overviewRoutes = require('./routes/custom/overview.routes')
// const { errorHandler } = require('./middlewares/error.middleware')

const app = express()

// ── Core Middleware ──────────────────────────────────────────────────────────
app.use(cors())
app.use(express.json())


// ── Factory Routes (all resources) ───────────────────────────────────────────
registerRoutes(app, routeConfig)

// ── Settings (custom routes) ──────────────────────────────────────────────────
app.use('/api/settings', settingsRouter)
// ── Custom Routes ────────────────────────────────────────────────────────────
app.use('/api/overview', overviewRoutes)

// ── Health Check ──────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// ── Global Error Handler (must be last) ───────────────────────────────────────
// app.use(errorHandler)

app.listen(8000, () => {
  console.log(process.env.DATABASE_URL)
  console.log('Server is Running')
})

module.exports = app