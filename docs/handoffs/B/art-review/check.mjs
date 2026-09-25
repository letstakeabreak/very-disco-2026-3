import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root=fileURLToPath(new URL('../../../../',import.meta.url));
execFileSync(process.execPath,['node_modules/typescript/bin/tsc','--project','docs/handoffs/B/art-review/tsconfig.json','--noEmit'],{cwd:root,stdio:'inherit'});
console.log('Art evidence viewer typecheck passed.');
