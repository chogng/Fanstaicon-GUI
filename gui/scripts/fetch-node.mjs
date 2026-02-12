import fs from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import path from 'node:path';
import https from 'node:https';
import { pipeline } from 'node:stream/promises';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

function exec(cmd, args, { cwd } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { cwd, stdio: 'inherit' });
    child.on('error', reject);
    child.on('close', code => {
      if (code === 0) resolve();
      else reject(new Error(`${cmd} ${args.join(' ')} exited with ${code}`));
    });
  });
}

function download(url, destPath) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, res => {
      if (
        res.statusCode &&
        res.statusCode >= 300 &&
        res.statusCode < 400 &&
        res.headers.location
      ) {
        resolve(download(res.headers.location, destPath));
        return;
      }
      if (res.statusCode !== 200) {
        reject(new Error(`Download failed: ${res.statusCode} ${url}`));
        return;
      }
      const file = createWriteStream(destPath);
      pipeline(res, file).then(resolve, reject);
    });
    req.on('error', reject);
  });
}

async function pathExists(p) {
  try {
    await fs.stat(p);
    return true;
  } catch {
    return false;
  }
}

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..', '..');

const nodeVersion =
  process.env.FANTASTICON_NODE_VERSION || process.versions.node;
const platform = process.platform;
const arch =
  process.arch === 'x64' || process.arch === 'arm64' ? process.arch : 'x64';

const outDir = path.join(repoRoot, 'build', 'node');
const cacheDir = path.join(repoRoot, 'build', 'node-cache');
const tmpDir = path.join(repoRoot, 'build', 'node-tmp');

await fs.mkdir(outDir, { recursive: true });
await fs.mkdir(cacheDir, { recursive: true });
await fs.mkdir(tmpDir, { recursive: true });

let filename;
let url;

if (platform === 'darwin') {
  filename = `node-v${nodeVersion}-darwin-${arch}.tar.gz`;
  url = `https://nodejs.org/dist/v${nodeVersion}/${filename}`;
} else if (platform === 'win32') {
  const winArch = arch === 'arm64' ? 'arm64' : 'x64';
  filename = `node-v${nodeVersion}-win-${winArch}.zip`;
  url = `https://nodejs.org/dist/v${nodeVersion}/${filename}`;
} else {
  throw new Error(`Unsupported platform for bundling Node: ${platform}`);
}

const archivePath = path.join(cacheDir, filename);
if (!(await pathExists(archivePath))) {
  // eslint-disable-next-line no-console
  console.log(`Downloading Node ${nodeVersion} (${platform}-${arch})...`);
  await download(url, archivePath);
}

await fs.rm(tmpDir, { recursive: true, force: true });
await fs.mkdir(tmpDir, { recursive: true });

if (platform === 'darwin') {
  await exec('tar', ['-xzf', archivePath, '-C', tmpDir]);
  const entries = await fs.readdir(tmpDir);
  const root = entries.find(
    x => x.startsWith('node-v') && x.includes('darwin')
  );
  if (!root) throw new Error('Failed to locate extracted Node folder');
  const nodeBin = path.join(tmpDir, root, 'bin', 'node');
  const target = path.join(outDir, 'node');
  await fs.copyFile(nodeBin, target);
  await fs.chmod(target, 0o755);
} else {
  const target = path.join(outDir, 'node.exe');
  // Prefer PowerShell for Windows zip extraction.
  await exec('powershell', [
    '-NoProfile',
    '-Command',
    `Expand-Archive -Force "${archivePath}" "${tmpDir}"`
  ]);
  const entries = await fs.readdir(tmpDir);
  const root = entries.find(x => x.startsWith('node-v') && x.includes('win'));
  if (!root) throw new Error('Failed to locate extracted Node folder');
  const nodeExe = path.join(tmpDir, root, 'node.exe');
  await fs.copyFile(nodeExe, target);
}

// eslint-disable-next-line no-console
console.log(`Bundled Node into ${outDir}`);
