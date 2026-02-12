import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

async function readStdin() {
  return await new Promise((resolve, reject) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', chunk => {
      data += chunk;
    });
    process.stdin.on('end', () => resolve(data));
    process.stdin.on('error', reject);
  });
}

async function loadUserConfig(configPath) {
  if (!configPath) return null;

  const abs = path.resolve(configPath);
  if (abs.endsWith('.json')) {
    const raw = await fs.readFile(abs, 'utf8');
    return JSON.parse(raw);
  }

  try {
    const mod = await import(pathToFileURL(abs).href);
    return mod?.default ?? mod;
  } catch (err) {
    throw new Error(
      `Failed to load configPath: ${abs}\n${err?.stack ?? String(err)}`
    );
  }
}

function slimWriteResults(writeResults) {
  return (writeResults ?? []).map(r => {
    const content = r?.content;
    const bytes = Buffer.isBuffer(content)
      ? content.length
      : typeof content === 'string'
        ? Buffer.byteLength(content, 'utf8')
        : null;
    return { writePath: r?.writePath, bytes };
  });
}

const here = path.dirname(fileURLToPath(import.meta.url));
const distEntry = pathToFileURL(path.join(here, '..', 'dist', 'index.js')).href;
const fantasticon = await import(distEntry);
const generateFonts = fantasticon.generateFonts ?? fantasticon.default;

const raw = await readStdin();
const opts = raw ? JSON.parse(raw) : {};

try {
  const userConfig = await loadUserConfig(opts.configPath);
  const merged = { ...(userConfig ?? {}), ...(opts ?? {}) };

  const results = await generateFonts(merged, true);

  const out = {
    ok: true,
    data: {
      options: results.options,
      writeResults: slimWriteResults(results.writeResults),
      codepoints: results.codepoints
    }
  };

  process.stdout.write(`${JSON.stringify(out)}\n`);
} catch (err) {
  const out = { ok: false, error: err?.stack ?? String(err) };
  process.stdout.write(`${JSON.stringify(out)}\n`);
  process.exitCode = 1;
}
