import { existsSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const hasSource = existsSync(join(root, 'src/index.ts'))
const hasTsdown = existsSync(join(root, 'node_modules/tsdown'))
if (!hasSource || !hasTsdown) process.exit(0)

const tsdown = spawnSync('pnpm', ['exec', 'tsdown'], { cwd: root, stdio: 'inherit' })
process.exit(tsdown.status ?? 1)
