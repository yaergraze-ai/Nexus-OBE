import test from 'node:test';
import assert from 'node:assert/strict';
import {calculateFinal,calculateCplAttainment,coursePassed,validRpsWeights} from '../src/lib/utils/grade-calculator';
import {demoCpl,demoCpmk,demoSub} from '../src/lib/demo-data';
const scores=(n:number)=>({attendance:n,uts:n,uas:n,daily_task:n,group_task:n,major_project:n});
test('PAP: cutoffs and quality points',()=>{
  const cases:Array<[number,string,number]> = [[100,'A',4],[85,'A',4],[84.99,'B',3],[70,'B',3],[55,'C',2],[40,'D',1],[39.99,'E',0],[0,'E',0]];
  for(const [n,letter,quality] of cases){const output=calculateFinal(scores(n));assert.equal(output.letter,letter);assert.equal(output.quality,quality);}
});
test('weighted final is independent from CPL attainment',()=>{
 const input={attendance:0,uts:80,uas:80,daily_task:80,group_task:80,major_project:80};
 assert.equal(calculateFinal(input).numeric,72);
 const cpl=calculateCplAttainment(input,demoCpl,demoCpmk,demoSub);
 assert.deepEqual(cpl.map(x=>x.attainment),[80,80]);
});
test('CPL mapping is consistent with 38/62 split and 100% Sub',()=>{
 assert.equal(demoCpl.reduce((s,x)=>s+x.weight,0),100);
 assert.equal(demoSub.reduce((s,x)=>s+x.weight,0),100);
 assert.equal(demoCpmk.reduce((s,x)=>s+x.weight,0),100);
 assert.equal(validRpsWeights(demoCpl,demoCpmk,demoSub),true);
});
test('grade guards reject invalid inputs and weights',()=>{
 assert.throws(()=>calculateFinal({...scores(100),uts:101}));
 assert.throws(()=>calculateFinal({...scores(100),attendance:NaN}));
 assert.throws(()=>calculateFinal(scores(50),{...scores(20),attendance:10}));
});
test('course passing threshold is compared to quality points',()=>{
 assert.equal(coursePassed(3,2.75),true);
 assert.equal(coursePassed(2,2.75),false);
 assert.equal(coursePassed(3,3),true);
});
