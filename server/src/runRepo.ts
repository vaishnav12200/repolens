import { spawn } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { createServer } from 'node:net'
import { extname, join } from 'node:path'
import type { RuntimeSession, StackItem } from './types.js'

type StartRepoInput = {
  dir: string
  repoUrl?: string
  stack: StackItem[]
  preferredInstallCommand?: string
  preferredStartCommand?: string
}

type StartRepoResult = {
  port: number
  url: string
  command: string
  pid?: number
}

type RunningProcess = RuntimeSession & {
  stop: () => void
}

const runningProcesses = new Map<string, RunningProcess>()

async function hasFile(dir: string, target: string) {
  try {
    await readFile(join(dir, target), 'utf-8')
    return true
  } catch {
    return false
  }
}

function stackHas(stack: StackItem[], name: string) {
  return stack.some((item) => item.name.toLowerCase() === name.toLowerCase())
}

async function inferInstallCommand(dir: string, stack: StackItem[], preferredInstallCommand?: string) {
  if (preferredInstallCommand?.trim()) {
    return preferredInstallCommand.trim()
  }

  if (stackHas(stack, 'Python') || (await hasFile(dir, 'requirements.txt'))) {
    return 'python -m pip install -r requirements.txt || pip install -r requirements.txt'
  }

  if (await hasFile(dir, 'pnpm-lock.yaml')) {
    return 'pnpm install'
  }

  if (await hasFile(dir, 'yarn.lock')) {
    return 'yarn install --frozen-lockfile || yarn install'
  }

  if (await hasFile(dir, 'package.json')) {
    return 'npm install'
  }

  return 'echo "No dependency install step detected"'
}

async function inferStartCommand(dir: string, stack: StackItem[], port: number, preferredStartCommand?: string) {
  if (preferredStartCommand?.trim()) {
    if (preferredStartCommand.includes('--port') || preferredStartCommand.includes('PORT=')) {
      return preferredStartCommand.trim()
    }
    return `PORT=${port} ${preferredStartCommand.trim()}`
  }

  if (stackHas(stack, 'Vite')) {
    return `npm run dev -- --host 0.0.0.0 --port ${port}`
  }

  if (stackHas(stack, 'Next.js')) {
    return `PORT=${port} npm run dev`
  }

  if (stackHas(stack, 'Python') || (await hasFile(dir, 'requirements.txt'))) {
    if (await hasFile(dir, 'main.py')) {
      return `PORT=${port} python main.py`
    }

    if (await hasFile(dir, 'app.py')) {
      return `PORT=${port} python app.py`
    }

    return `python -m http.server ${port}`
  }

  if (await hasFile(dir, 'package.json')) {
    return `PORT=${port} npm run dev || PORT=${port} npm start`
  }

  const staticFileExtensions = ['.html', '.md']
  const canServeStatic = staticFileExtensions.some((extension) => extname(dir).toLowerCase() === extension)
  if (canServeStatic) {
    return `python -m http.server ${port}`
  }

  return `python -m http.server ${port}`
}

async function findFreePort() {
  return new Promise<number>((resolve, reject) => {
    const server = createServer()
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      if (!address || typeof address === 'string') {
        server.close(() => reject(new Error('Unable to allocate a free port')))
        return
      }

      const { port } = address
      server.close((error) => {
        if (error) {
          reject(error)
          return
        }
        resolve(port)
      })
    })

    server.on('error', reject)
  })
}

function runShellCommand(command: string, cwd: string, env: NodeJS.ProcessEnv) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(command, {
      cwd,
      env,
      shell: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    const logs: string[] = []
    child.stdout.on('data', (chunk) => {
      logs.push(chunk.toString())
    })
    child.stderr.on('data', (chunk) => {
      logs.push(chunk.toString())
    })

    child.on('error', (error) => {
      reject(new Error(`Command failed to start: ${error.message}`))
    })

    child.on('exit', (code) => {
      if (code === 0) {
        resolve()
        return
      }

      reject(new Error(`Command exited with code ${code ?? -1}: ${logs.join('').slice(-1200)}`))
    })
  })
}

async function waitForHttp(url: string, timeoutMs = 20000) {
  const started = Date.now()

  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(url, { method: 'GET' })
      if (response.status < 500) {
        return true
      }
    } catch {
      // Keep polling.
    }

    await new Promise((resolve) => setTimeout(resolve, 600))
  }

  return false
}

function stopSession(session: RunningProcess) {
  session.stop()
  runningProcesses.delete(session.repoDir)
}

export async function startRepo(input: StartRepoInput): Promise<StartRepoResult> {
  const existing = runningProcesses.get(input.dir)
  if (existing) {
    stopSession(existing)
  }

  const port = await findFreePort()
  const env = {
    ...process.env,
    PORT: String(port),
    HOST: '0.0.0.0',
    REACT_APP_PORT: String(port),
    VITE_PORT: String(port),
  }

  const installCommand = await inferInstallCommand(input.dir, input.stack, input.preferredInstallCommand)
  const startCommand = await inferStartCommand(input.dir, input.stack, port, input.preferredStartCommand)

  if (!installCommand.startsWith('echo')) {
    await runShellCommand(installCommand, input.dir, env)
  }

  const child = spawn(startCommand, {
    cwd: input.dir,
    env,
    shell: true,
    detached: false,
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  child.stdout.on('data', (chunk) => {
    process.stdout.write(`[runRepo:${port}] ${chunk.toString()}`)
  })

  child.stderr.on('data', (chunk) => {
    process.stderr.write(`[runRepo:${port}:err] ${chunk.toString()}`)
  })

  child.on('exit', () => {
    runningProcesses.delete(input.dir)
  })

  const url = `http://localhost:${port}`
  const ready = await waitForHttp(url)
  if (!ready) {
    child.kill('SIGTERM')
    throw new Error('Started process but preview URL did not become reachable in time')
  }

  const session: RunningProcess = {
    repoDir: input.dir,
    repoUrl: input.repoUrl,
    port,
    url,
    command: startCommand,
    pid: child.pid,
    startedAt: new Date().toISOString(),
    stop: () => {
      if (child.exitCode === null) {
        child.kill('SIGTERM')
      }
    },
  }

  runningProcesses.set(input.dir, session)

  return {
    port,
    url,
    command: startCommand,
    pid: child.pid,
  }
}

export function listRunningRepoSessions(): RuntimeSession[] {
  return [...runningProcesses.values()].map(({ stop: _stop, ...session }) => session)
}

export function stopRepoRunByDir(repoDir: string) {
  const session = runningProcesses.get(repoDir)
  if (!session) {
    return false
  }

  stopSession(session)
  return true
}

export function stopAllRepoRuns() {
  for (const session of runningProcesses.values()) {
    session.stop()
  }
  runningProcesses.clear()
}
