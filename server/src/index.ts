import 'dotenv/config'
import cors from 'cors'
import express from 'express'
import { createApiRouter } from './routes.js'
import { stopAllRepoRuns } from './runRepo.js'

const app = express()
app.use(cors())
app.use(express.json({ limit: '1mb' }))

app.use('/api', createApiRouter())

const port = Number(process.env.PORT ?? 8787)
const server = app.listen(port, () => {
  console.log(`RepoLens API listening on http://localhost:${port}`)
})

const shutdown = (signal: string) => {
  console.log(`Received ${signal}. Shutting down RepoLens API...`)
  stopAllRepoRuns()
  server.close(() => {
    process.exit(0)
  })
}

process.on('SIGINT', () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))
