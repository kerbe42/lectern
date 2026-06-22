import AdmZip from 'adm-zip';
import { execSync } from 'node:child_process';

// Build, then zip the CONTENTS of dist/ (manifest.json ends up at the zip root,
// which is what mobile Chromium browsers expect when loading an unpacked .zip).
execSync('node build.mjs', { stdio: 'inherit' });

const zip = new AdmZip();
zip.addLocalFolder('dist');
zip.writeZip('lectern.zip');
console.log('Lectern: wrote lectern.zip (manifest at root)');
