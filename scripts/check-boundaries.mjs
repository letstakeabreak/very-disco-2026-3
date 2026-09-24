import { readdirSync, readFileSync } from 'node:fs';
import { dirname, relative, resolve, sep } from 'node:path';
import ts from 'typescript';

const files = [];
function walk(dir) { for (const item of readdirSync(dir, { withFileTypes: true })) { const path = `${dir}/${item.name}`; if (item.isDirectory()) walk(path); else if (path.endsWith('.ts')) files.push(path); } }
walk('src');
const errors = [];
const owner = (path) => path.startsWith('src/core/') || path.startsWith('src/content/') ? 'A' : path.startsWith('src/render/') ? 'B' : path.startsWith('src/app/') || path === 'src/main.ts' ? 'C' : 'shared';
for (const file of files) {
  const source = readFileSync(file, 'utf8');
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  function inspect(node) {
    let moduleName;
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) moduleName = node.moduleSpecifier.text;
    if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword || (ts.isIdentifier(node.expression) && node.expression.text === 'require'))) {
      if (!node.arguments[0] || !ts.isStringLiteral(node.arguments[0])) errors.push(`${file}: computed imports are not part of the frozen module contract`);
      else moduleName = node.arguments[0].text;
    }
    if (moduleName) {
      if (!moduleName.startsWith('.')) {
        if (!(owner(file) === 'B' && (moduleName === 'three' || moduleName.startsWith('three/')))) errors.push(`${file}: forbidden external import ${moduleName}`);
      } else {
        const target = relative(process.cwd(), resolve(dirname(file), moduleName)).split(sep).join('/').replace(/\.ts$/, '');
        const targetOwner = owner(target.endsWith('/index') ? `${target}.ts` : `${target}/index.ts`);
        const own = owner(file);
        const allowed = target.startsWith('src/contracts/') || target === 'src/contracts' || own === targetOwner || (own === 'C' && ['src/core', 'src/core/index', 'src/render', 'src/render/index'].includes(target));
        if (!target.startsWith('src/') || !allowed) errors.push(`${file}: forbidden cross-role import ${moduleName}`);
      }
    }
    if (owner(file) === 'A' && ts.isIdentifier(node) && ['window', 'document', 'requestAnimationFrame', 'performance', 'Date', 'setTimeout', 'setInterval', 'process'].includes(node.text)) errors.push(`${file}: core/content must stay independent of browser, wall-clock and process globals (${node.text})`);
    if (owner(file) === 'A' && ts.isPropertyAccessExpression(node) && node.expression.getText(ast) === 'Math' && node.name.text === 'random') errors.push(`${file}: use seeded randomness, not Math.random`);
    ts.forEachChild(node, inspect);
  }
  inspect(ast);
}
if (errors.length) { console.error([...new Set(errors)].join('\n')); process.exitCode = 1; }
else console.log(`Module boundary lint passed (${files.length} TypeScript files).`);
