import cors from 'cors'
import express from 'express'
import { createApiRouter } from './routes.js'

const app = express()
app.use(cors())
app.use(express.json({ limit: '1mb' }))

app.use('/api', createApiRouter())

const port = Number(process.env.PORT ?? 8787)
app.listen(port, () => {
  console.log(`RepoLens API listening on http://localhost:${port}`)
})
