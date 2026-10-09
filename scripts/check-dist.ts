import { resolve } from 'node:path';
import { checkDist } from './dist-check.ts';

const dist = resolve(import.meta.dirname, '..', 'dist');
const problems = checkDist(dist);
for (const problem of problems) console.error(problem);
if (problems.length > 0) process.exit(1);
console.log('dist: every page has its twin and its discovery entries');
