import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const isWindows = process.platform === 'win32';
const tsxBin = path.join(rootDir, 'server', 'node_modules', '.bin', isWindows ? 'tsx.cmd' : 'tsx');

const env = {
  ...process.env,
  NODE_PATH: path.join(rootDir, 'server', 'node_modules')
};

const testDir = path.join(rootDir, 'tests', 'unit');
const testFiles = fs.readdirSync(testDir)
  .filter((f) => f.endsWith('.test.ts'))
  .sort()
  .map((f) => path.join('tests', 'unit', f));

const args = ['--test', ...testFiles];

const child = spawn(tsxBin, args, {
  cwd: rootDir,
  env,
  shell: isWindows,
  stdio: 'inherit'
});

child.on('close', (code) => {
  process.exit(code || 0);
});
