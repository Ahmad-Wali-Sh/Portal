require('dotenv').config()
const express = require('express')
const cors = require('cors')

const { registerRoutes } = require('./factory/routeFactory')
const { routeConfig } = require('./routes/routeConfig')
// const { errorHandler } = require('./middlewares/error.middleware')

const app = express()

// ── Core Middleware ──────────────────────────────────────────────────────────
app.use(cors())
app.use(express.json())


// ── Factory Routes (all resources) ───────────────────────────────────────────
registerRoutes(app, routeConfig)

// ── Health Check ──────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// ── Global Error Handler (must be last) ───────────────────────────────────────
// app.use(errorHandler)

app.listen(8000, () => {
  console.log('Sever is runnong...')
})

module.exports = app