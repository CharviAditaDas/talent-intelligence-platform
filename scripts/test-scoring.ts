import { computeScore, normaliseWeights, categorise, type ScoredRequirement } from '../lib/scoring/engine';

let pass = 0, fail = 0;
function check(name: string, cond: boolean, extra = '') {
  if (cond) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name} ${extra}`); }
}

const req = (label: string, kind: string, importance: any, state: any): ScoredRequirement =>
  ({ id: label, label, kind, importance, state });

console.log('\n[weights]');
const w = normaliseWeights(null);
check('baseline sums to 1', Math.abs(Object.values(w).reduce((a,b)=>a+b,0) - 1) < 0.001);
const skewed = normaliseWeights({ technical_skills: 0.99, experience: 0, education: 0, projects: 0, certifications: 0, semantic_fit: 0 });
check('extreme AI weights are clamped', skewed.technical_skills <= 0.46, JSON.stringify(skewed));
check('clamped weights still sum to 1', Math.abs(Object.values(skewed).reduce((a,b)=>a+b,0) - 1) < 0.001);
check('no dimension can be zeroed out', Object.values(skewed).every(v => v > 0));

console.log('\n[determinism]');
const reqs = [
  req('Python','skill','required','demonstrated'),
  req('AWS','skill','required','not_demonstrated'),
  req('Docker','skill','preferred','insufficient'),
  req('BSc CS','education','required','demonstrated'),
];
const a = computeScore({ requirements: reqs, semanticFit: 0.7, candidateYears: 3, jobMinYears: 2 });
const b = computeScore({ requirements: reqs, semanticFit: 0.7, candidateYears: 3, jobMinYears: 2 });
check('same input -> identical score', a.overall === b.overall, `${a.overall} vs ${b.overall}`);
check('score within 0-100', a.overall >= 0 && a.overall <= 100, String(a.overall));

console.log('\n[monotonicity]');
const allNo  = computeScore({ requirements: reqs.map(r=>({...r,state:'not_demonstrated' as const})), semanticFit: 0.5 });
const allYes = computeScore({ requirements: reqs.map(r=>({...r,state:'demonstrated' as const})), semanticFit: 0.5 });
check('all demonstrated > all not demonstrated', allYes.overall > allNo.overall, `${allYes.overall} vs ${allNo.overall}`);
const partial = computeScore({ requirements: reqs.map(r=>({...r,state:'insufficient' as const})), semanticFit: 0.5 });
check('insufficient sits strictly between', partial.overall > allNo.overall && partial.overall < allYes.overall, `${allNo.overall} < ${partial.overall} < ${allYes.overall}`);

console.log('\n[evidence credit]');
const oneReq = (s:any) => computeScore({ requirements: [req('X','skill','required',s)] }).overall;
check('demonstrated=100 when sole dimension', oneReq('demonstrated') === 100, String(oneReq('demonstrated')));
check('not_demonstrated=0 when sole dimension', oneReq('not_demonstrated') === 0, String(oneReq('not_demonstrated')));
check('insufficient=40 when sole dimension', Math.abs(oneReq('insufficient') - 40) < 0.01, String(oneReq('insufficient')));

console.log('\n[importance]');
const reqOnly = computeScore({ requirements: [req('A','skill','required','not_demonstrated'), req('B','skill','nice_to_have','demonstrated')] });
const niceOnly = computeScore({ requirements: [req('A','skill','required','demonstrated'), req('B','skill','nice_to_have','not_demonstrated')] });
check('missing a REQUIRED costs more than missing a nice-to-have', niceOnly.overall > reqOnly.overall, `${niceOnly.overall} vs ${reqOnly.overall}`);

console.log('\n[weight redistribution]');
const noCerts = computeScore({ requirements: [req('Python','skill','required','demonstrated')] });
check('unspecified dimensions do not drag score down', noCerts.overall === 100, String(noCerts.overall));
const certsComp = noCerts.components.find(c=>c.dimension==='certifications')!;
check('unused dimension gets zero effective weight', certsComp.weight === 0);

console.log('\n[explainability]');
check('components sum to overall', Math.abs(a.components.reduce((s,c)=>s+c.contribution,0) - a.overall) < 0.05);
check('every dimension reported', a.components.length === 6);
check('unmet required surfaced, not auto-rejected', a.requiredUnmet.includes('AWS') && a.overall > 0);

console.log('\n[categories]');
check('85 -> strong', categorise(85) === 'strong');
check('84.9 -> good', categorise(84.9) === 'good');
check('70 -> good', categorise(70) === 'good');
check('69 -> potential', categorise(69) === 'potential');
check('49 -> low', categorise(49) === 'low');

console.log('\n[experience band]');
const under = computeScore({ requirements: [req('E','experience','required','insufficient')], candidateYears: 1, jobMinYears: 4 });
const over  = computeScore({ requirements: [req('E','experience','required','insufficient')], candidateYears: 8, jobMinYears: 4 });
check('meeting the band scores higher than falling short', over.overall > under.overall, `${over.overall} vs ${under.overall}`);

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
