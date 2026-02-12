/* global fantasticonGui */

const DEFAULT_FONT_TYPES = ['eot', 'woff2', 'woff'];
const DEFAULT_ASSET_TYPES = ['css', 'html', 'json', 'ts'];

const ALL_FONT_TYPES = ['eot', 'woff2', 'woff', 'ttf', 'svg'];
const ALL_ASSET_TYPES = ['css', 'scss', 'sass', 'html', 'json', 'ts'];

function el(id) {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Missing element: ${id}`);
  return node;
}

function setText(id, text) {
  el(id).textContent = text;
}

function setValue(id, text, { placeholder } = {}) {
  const node = el(id);
  node.textContent = text;
  node.classList.toggle('placeholder', Boolean(placeholder));
}

function makeCheck(container, value, checked) {
  const label = document.createElement('label');
  label.className = 'check';

  const input = document.createElement('input');
  input.type = 'checkbox';
  input.value = value;
  input.checked = checked;

  const span = document.createElement('span');
  span.textContent = value;

  label.appendChild(input);
  label.appendChild(span);
  container.appendChild(label);
}

function getCheckedValues(containerId) {
  const container = el(containerId);
  return Array.from(container.querySelectorAll('input[type="checkbox"]'))
    .filter(x => x.checked)
    .map(x => x.value);
}

function setBusy(busy) {
  el('run').disabled = busy;
  el('pickInput').disabled = busy;
  el('pickOutput').disabled = busy;
  el('pickConfig').disabled = busy;
}

let inputDir = null;
let outputDir = null;
let configPath = null;

function appendLog(text) {
  const node = el('log');
  node.textContent = `${node.textContent}${text}`;
  node.scrollTop = node.scrollHeight;
}

function clearLog() {
  el('log').textContent = '';
}

function setStatus(text) {
  setText('status', text);
}

function initChecks() {
  const fontTypes = el('fontTypes');
  const assetTypes = el('assetTypes');

  for (const ft of ALL_FONT_TYPES)
    makeCheck(fontTypes, ft, DEFAULT_FONT_TYPES.includes(ft));
  for (const at of ALL_ASSET_TYPES)
    makeCheck(assetTypes, at, DEFAULT_ASSET_TYPES.includes(at));
}

async function pickInputDir() {
  const picked = await fantasticonGui.chooseDir({
    title: 'Select Input Directory'
  });
  if (!picked) return;
  inputDir = picked;
  setValue('inputDir', picked, { placeholder: false });
}

async function pickOutputDir() {
  const picked = await fantasticonGui.chooseDir({
    title: 'Select Output Directory'
  });
  if (!picked) return;
  outputDir = picked;
  setValue('outputDir', picked, { placeholder: false });
}

async function pickConfigFile() {
  const picked = await fantasticonGui.chooseFile({
    title: 'Select Config File',
    filters: [
      { name: 'Fantasticon Config', extensions: ['js', 'cjs', 'mjs', 'json'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  });
  if (!picked) return;
  configPath = picked;
  setValue('configPath', picked, { placeholder: false });
}

async function run() {
  if (!inputDir) {
    setStatus('Select an input directory first');
    return;
  }
  if (!outputDir) {
    setStatus('Select an output directory first');
    return;
  }

  clearLog();
  setBusy(true);
  setStatus('Running...');

  const opts = {
    inputDir,
    outputDir,
    name: el('name').value.trim() || 'icons',
    prefix: el('prefix').value.trim() || undefined,
    tag: el('tag').value.trim() || undefined,
    fontsUrl: el('fontsUrl').value.trim() || undefined,
    configPath: configPath || undefined,
    fontTypes: getCheckedValues('fontTypes'),
    assetTypes: getCheckedValues('assetTypes')
  };

  appendLog(`Running fantasticon...\n`);
  appendLog(`inputDir: ${opts.inputDir}\n`);
  appendLog(`outputDir: ${opts.outputDir}\n\n`);

  const result = await fantasticonGui.run(opts);

  if (!result?.ok) {
    setStatus('Failed');
    appendLog(`\n[ERROR]\n${result?.error ?? 'Unknown error'}\n`);
    if (result?.stderr) appendLog(`\n[stderr]\n${result.stderr}\n`);
    setBusy(false);
    return;
  }

  setStatus('Done');
  const data = result.data ?? {};
  const writeResults = Array.isArray(data.writeResults)
    ? data.writeResults
    : [];
  const codepoints = data.codepoints ?? {};

  appendLog(`\n[DONE] wrote ${writeResults.length} files\n\n`);
  for (const r of writeResults) {
    const bytes = r?.bytes != null ? `${r.bytes} bytes` : 'unknown size';
    appendLog(`- ${r?.writePath ?? '(unknown)'} (${bytes})\n`);
  }

  const cpKeys = Object.keys(codepoints);
  appendLog(`\ncodepoints: ${cpKeys.length}\n`);
  setBusy(false);
}

initChecks();

setValue('inputDir', '(Not Selected)', { placeholder: true });
setValue('outputDir', '(Not Selected)', { placeholder: true });
setValue('configPath', '(None)', { placeholder: true });

async function sizeWindowToFit() {
  const main = document.querySelector('main');
  if (!main) return;

  // Let layout settle before measuring.
  await new Promise(resolve => requestAnimationFrame(resolve));
  await new Promise(resolve => requestAnimationFrame(resolve));

  const height = Math.ceil(main.scrollHeight);
  const width = Math.ceil(main.scrollWidth);

  await fantasticonGui.setContentSize({ width, height });
}

sizeWindowToFit();

el('pickInput').addEventListener('click', pickInputDir);
el('pickOutput').addEventListener('click', pickOutputDir);
el('pickConfig').addEventListener('click', pickConfigFile);
el('run').addEventListener('click', run);
