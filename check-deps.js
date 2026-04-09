const fs = require('fs');
const path = require('path');

const imports = new Set();
const builtin = require('module').builtinModules;

function extractImports(fullPath) {
  const code = fs.readFileSync(fullPath, 'utf8');
  const importRe = /import(?:(?:[\s\n]+[^\s\n"']+[\s\n]*\,?)+)?(?:[\s\n]+)?(?:from[\s\n]+)?['"]([^"']+)['"]/g;
  const requireRe = /require\(['"]([^"']+)['"]\)/g;
  
  let match;
  while ((match = importRe.exec(code)) !== null) imports.add(match[1]);
  while ((match = requireRe.exec(code)) !== null) imports.add(match[1]);
}

function parseFiles(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      parseFiles(fullPath);
    } else if (fullPath.endsWith('.js') || fullPath.endsWith('.jsx')) {
      extractImports(fullPath);
    }
  }
}

parseFiles('./app');
parseFiles('./src');

const packageJson = JSON.parse(fs.readFileSync('./package.json', 'utf8'));
const deps = Object.keys(packageJson.dependencies || {});

for (const imp of imports) {
  if (imp.startsWith('.') || imp.startsWith('/')) continue;
  const pkgName = imp.startsWith('@') ? imp.split('/').slice(0, 2).join('/') : imp.split('/')[0];
  if (!builtin.includes(pkgName) && !deps.includes(pkgName)) {
    console.log(`Missing dependency: ${pkgName} (imported as ${imp})`);
  }
}
console.log('Dependency check complete.');
