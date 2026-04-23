import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.resolve(__dirname, '../dist');
const packageJsonPath = path.join(distDir, 'package.json');

await mkdir(distDir, { recursive: true });
await writeFile(
  packageJsonPath,
  JSON.stringify(
    {
      type: 'module',
    },
    null,
    2,
  ),
);
