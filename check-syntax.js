const fs = require('fs');
const path = require('path');
const babel = require('@babel/core');

function parseFiles(dir) {
  let hasErrors = false;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      hasErrors = parseFiles(fullPath) || hasErrors;
    } else if (fullPath.endsWith('.js') || fullPath.endsWith('.jsx')) {
      try {
        babel.parseSync(fs.readFileSync(fullPath, 'utf8'), {
          filename: fullPath,
          presets: ['babel-preset-expo'],
        });
      } catch (e) {
        console.error(`Syntax error in ${fullPath}: ${e.message}`);
        hasErrors = true;
      }
    }
  }
  return hasErrors;
}

const errApp = parseFiles('./app');
const errSrc = parseFiles('./src');

if (errApp || errSrc) {
  process.exit(1);
} else {
  console.log('No syntax errors found.');
}
