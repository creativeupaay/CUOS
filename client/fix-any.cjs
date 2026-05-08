const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(filePath));
    } else {
      if (filePath.endsWith('.ts') || filePath.endsWith('.tsx')) {
        results.push(filePath);
      }
    }
  });
  return results;
}

const files = walk(path.join(__dirname, 'src'));

let totalReplacements = 0;

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let originalContent = content;

  // Replace `(a: any)` with `(a: Record<string, unknown> | string | any)` wait, `any` is still there.
  // Replace `: any` with `: Record<string, unknown>`
  // But wait, there are places like `as any`.
  // `as any` -> `as unknown`
  // `: any` -> `: unknown`

  content = content.replace(/: any\b/g, ': unknown');
  content = content.replace(/as any\b/g, 'as unknown');
  content = content.replace(/<any>/g, '<unknown>');

  if (content !== originalContent) {
    fs.writeFileSync(file, content, 'utf8');
    totalReplacements++;
    console.log(`Updated ${file}`);
  }
});

console.log(`Total files updated: ${totalReplacements}`);
