import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const clientPkgPath = path.join(rootDir, 'client', 'package.json');
const serverPkgPath = path.join(rootDir, 'server', 'package.json');
const readmePath = path.join(rootDir, 'README.md');

// 1. Determine target version
const targetVersion = process.argv[2];

const clientPkg = JSON.parse(fs.readFileSync(clientPkgPath, 'utf-8'));
const newVersion = targetVersion || clientPkg.version;

if (!newVersion) {
    console.error('❌ Could not determine version.');
    process.exit(1);
}

console.log(`\n🔄 Syncing Slothify version to v${newVersion}...\n`);

// 2. Update client/package.json
clientPkg.version = newVersion;
fs.writeFileSync(clientPkgPath, JSON.stringify(clientPkg, null, 4) + '\n', 'utf-8');
console.log(`✅ client/package.json -> ${newVersion}`);

// 3. Update server/package.json
if (fs.existsSync(serverPkgPath)) {
    const serverPkg = JSON.parse(fs.readFileSync(serverPkgPath, 'utf-8'));
    serverPkg.version = newVersion;
    fs.writeFileSync(serverPkgPath, JSON.stringify(serverPkg, null, 4) + '\n', 'utf-8');
    console.log(`✅ server/package.json -> ${newVersion}`);
}

// 4. Update README.md badge
if (fs.existsSync(readmePath)) {
    let readme = fs.readFileSync(readmePath, 'utf-8');
    const badgeRegex = /!\[Version\]\(https:\/\/img\.shields\.io\/badge\/Version-[^-\)]+-007ACC\.svg\?style=for-the-badge\)/g;
    const replacement = `![Version](https://img.shields.io/badge/Version-${newVersion}-007ACC.svg?style=for-the-badge)`;

    if (badgeRegex.test(readme)) {
        readme = readme.replace(badgeRegex, replacement);
        fs.writeFileSync(readmePath, readme, 'utf-8');
        console.log(`✅ README.md badge -> ${newVersion}`);
    } else {
        console.log('⚠️ Version badge pattern not found in README.md.');
    }
}

console.log(`\n🎉 Slothify version v${newVersion} synchronized!`);
console.log('💡 Note: The Settings page in the web app reads client/package.json automatically via Vite.\n');
