import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { rm } from 'node:fs/promises';
import type { ChildProcess } from 'node:child_process';
import type { StackItem } from './types.js';

const execAsync = promisify(exec);

const runningProcesses = new Map<string, { port: number, process: ChildProcess, dir: string }>();
let nextPort = 3100;

export async function startRepo(dir: string, stack: StackItem[]): Promise<{ port: number, url: string }> {
  const port = nextPort++;
  
  try {
    let installCmd = 'npm install';
    let startCmd = `PORT=${port} npm start`;

    if (stack.some(s => s.name === 'Vite')) {
      startCmd = `npm run dev -- --port ${port}`;
    } else if (stack.some(s => s.name === 'Python')) {
      installCmd = 'pip install -r requirements.txt || true';
      startCmd = `PORT=${port} python app.py || PORT=${port} python main.py || python -m http.server ${port}`;
    }

    // Install dependencies
    await execAsync(installCmd, { cwd: dir, timeout: 120000 });

    // Start process
    const child = exec(startCmd, { cwd: dir });
    
    // Store reference to kill later if needed
    runningProcesses.set(dir, { port, process: child, dir });

    return {
      port,
      url: `http://localhost:${port}`
    };
  } catch (err) {
    throw new Error(`Failed to run repo: ${err instanceof Error ? err.message : String(err)}`);
  }
}

export async function cleanupRepoRun(dir: string) {
  const p = runningProcesses.get(dir);
  if (p) {
    p.process.kill();
    runningProcesses.delete(dir);
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}
