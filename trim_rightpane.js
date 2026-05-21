const fs = require('fs');
const p = 'app/chat/RightPane.tsx';
const content = fs.readFileSync(p, 'utf8');
const lines = content.split(/\r?\n/);
console.log('Total lines:', lines.length);
const kept = [...lines.slice(0, 5), ...lines.slice(358)];
console.log('Kept lines:', kept.length);
fs.writeFileSync(p, kept.join('\n'), 'utf8');
console.log('Done');
