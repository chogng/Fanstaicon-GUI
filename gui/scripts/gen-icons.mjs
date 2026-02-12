import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import png2icons from 'png2icons';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..', '..');

const iconSvgPath = path.join(repoRoot, 'assets', 'icon.svg');
const iconPngPath = path.join(repoRoot, 'build', 'icon.png');
const iconIcoPath = path.join(repoRoot, 'build', 'icon.ico');
const iconIcnsPath = path.join(repoRoot, 'build', 'icon.icns');
const buildDir = path.dirname(iconPngPath);

const svg = await fs.readFile(iconSvgPath);

const png1024 = await sharp(svg, { density: 288 })
  .resize(1024, 1024, { fit: 'cover' })
  .png({ compressionLevel: 9 })
  .toBuffer();

await fs.mkdir(buildDir, { recursive: true });
await fs.writeFile(iconPngPath, png1024);

const ico = png2icons.createICO(png1024, png2icons.BILINEAR, 0, true);
if (!ico) throw new Error('Failed to generate .ico');
await fs.writeFile(iconIcoPath, ico);

const icns = png2icons.createICNS(png1024, png2icons.BILINEAR, 0);
if (!icns) throw new Error('Failed to generate .icns');
await fs.writeFile(iconIcnsPath, icns);

// eslint-disable-next-line no-console
console.log('Generated:', { iconPngPath, iconIcoPath, iconIcnsPath });
