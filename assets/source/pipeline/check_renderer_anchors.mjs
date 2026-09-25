/** Check the renderer constants against the actual anchor-only Blender result. */
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { PRESS_ANCHORS } from '../../../src/render/ram.ts';
const here=fileURLToPath(new URL('./',import.meta.url));
const root=fileURLToPath(new URL('../../../',import.meta.url));
const read=path=>JSON.parse(readFileSync(path,'utf8'));
const sha=path=>createHash('sha256').update(readFileSync(path)).digest('hex');
const report=read(here+'anchor-recalculation.json'), summary=read(here+'runtime-anchors.json');
const expected=report.anchors;
const fields={workbedY:expected.workbedTopY,platenY:expected.platenRestBottomY,topY:expected.ramTopConnectionY,
  flangeY:expected.ramLowerFlangeTopY,x:expected.ramCenterXZ[0],z:expected.ramCenterXZ[1],
  clearance:expected.floorClearance,travel:expected.maxDownwardTravel};
for(const [name,value]of Object.entries(fields))if(Math.abs(PRESS_ANCHORS[name]-value)>1e-9)throw new Error(`Renderer anchor drift: ${name}`);
if(Math.abs(PRESS_ANCHORS.workbedY+PRESS_ANCHORS.clearance-expected.specimenBase[1])>1e-12)throw new Error('Specimen base drift');
if(Math.abs(PRESS_ANCHORS.travel-(PRESS_ANCHORS.platenY-expected.specimenBase[1]))>1e-12)throw new Error('Travel arithmetic drift');
for(const [path,value]of Object.entries(report.runtimeHashesAfter))if(sha(root+path)!==value)throw new Error(`Runtime changed since measurement: ${path}`);
for(const [path,value]of Object.entries(report.sourceCodeSha256))if(sha(here+path)!==value)throw new Error(`Recalculation code changed: ${path}`);
if(sha(here+report.historicalLineageReport)!==report.historicalLineageReportSha256)throw new Error('Historical lineage changed since measurement');
for(const [name,value]of Object.entries(expected))if(JSON.stringify(summary.press[name])!==JSON.stringify(value))throw new Error(`Runtime summary drift: ${name}`);
const result={checkedAt:new Date().toISOString(),validation:'passed',scope:'Anchor consistency and unchanged asset hashes only; not browser, gameplay, continuous contact or device QA',rendererSha256:sha(root+'src/render/ram.ts'),recalculationSha256:sha(here+'anchor-recalculation.json'),specimenBaseY:expected.specimenBase[1],workbedY:PRESS_ANCHORS.workbedY,clearance:PRESS_ANCHORS.clearance,travel:PRESS_ANCHORS.travel,checkedFields:Object.keys(fields),runtimeFilesUnchanged:4};
writeFileSync(here+'anchor-consistency.json',JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result,null,2));
