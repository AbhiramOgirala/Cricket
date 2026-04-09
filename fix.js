const fs = require('fs');
const glob = require('glob');

const files = glob.sync('app/**/*.jsx');
files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  if (content.includes('SafeAreaView') && !content.includes('react-native-safe-area-context')) {
    // Replace "SafeAreaView," or ", SafeAreaView" with empty string
    content = content.replace(/\s*SafeAreaView\s*,/g, '');
    content = content.replace(/,\s*SafeAreaView/g, '');
    content = content.replace(/\{\s*SafeAreaView\s*\}/g, '{}');
    
    // Add new import
    const newContext = "import { SafeAreaView } from 'react-native-safe-area-context';\n";
    // find index to insert
    const lines = content.split('\n');
    lines.splice(1, 0, newContext);
    
    fs.writeFileSync(file, lines.join('\n'));
    console.log('Fixed:', file);
  }
});
