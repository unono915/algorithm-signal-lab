import test from 'node:test';
import assert from 'node:assert/strict';
import {execute} from '../src/engine.js';
const op=op=>({op});
const normal=[op('rotate'),op('flip'),{op:'if',condition:'dark',body:[op('lightLast')]}];
const stream=body=>({body:[{op:'repeat',mode:'input',body:[op('read'),...body]}]});
test('rotation followed by first-cell flip matches all eight truth cases',()=>{
 const expected=['100','110','000','010','101','111','001','011'];
 for(let n=0;n<8;n++){const r=execute({body:[op('read'),op('rotate'),op('flip'),op('emit')]},[n.toString(2).padStart(3,'0')]);assert.equal(r.error,null);assert.deepEqual(r.final.outputs,[expected[n]]);}
});
test('normalization applies darkness guard after transformation',()=>{
 const r=execute(stream([...normal,op('emit')]),['000','010','101']);assert.deepEqual(r.final.outputs,['100','001','111']);
});
test('output values and trace snapshots remain immutable across later edits',()=>{
 const r=execute({body:[op('read'),op('emit'),op('flip'),op('emit')]},['100']);assert.deepEqual(r.final.outputs,['100','000']);const initial=r.trace[0];assert.equal(initial.current,null);assert.deepEqual(initial.outputs,[]);assert.deepEqual(r.trace.find(s=>s.op==='emit').outputs,['100']);
});
test('sentinel is consumed while every following token remains unconsumed',()=>{
 const r=execute(stream([op('stopIfEnd'),{op:'if',condition:'intact',body:[...normal,op('emit')]}]),['100','END','!111','101']);assert.equal(r.final.position,2);assert.equal(r.final.stopped,true);assert.deepEqual(r.final.outputs,['101']);
});
test('shared function returns transformed signal and creates call/return traces',()=>{
 const r=execute({functions:{restore:normal},body:[op('read'),{op:'call',name:'restore'},op('emit')]},['010']);assert.deepEqual(r.final.outputs,['001']);assert.equal(r.final.calls,1);assert.ok(r.trace.some(s=>s.op==='call'));assert.ok(r.trace.some(s=>s.op==='return'));
});
test('empty input never reads and finishes with zero initialized energy',()=>{const r=execute({body:[op('init'),{op:'repeat',mode:'input',body:[op('read'),op('charge')]}]},[]);assert.equal(r.error,null);assert.equal(r.final.energy,0)});
for(const [name,program,input,code] of [
 ['empty read',{body:[op('read')]},[],'EMPTY_INPUT'],
 ['uninitialized charge',{body:[op('read'),op('charge')]},['100'],'UNINITIALIZED'],
 ['end signal transform',{body:[op('read'),op('rotate')]},['END'],'INVALID_SIGNAL'],
 ['missing current signal',{body:[op('emit')]},['100'],'NO_SIGNAL'],
 ['unknown operation',{body:[op('teleport')]},[],'INVALID_PROGRAM'],
 ['unknown function',{body:[{op:'call',name:'missing'}]},[],'INVALID_FUNCTION'],
 ['invalid input',{body:[]},['abc'],'INVALID_INPUT'],
 ['nonconsuming loop',{body:[{op:'repeat',mode:'input',body:[]}]},['100'],'STEP_LIMIT'],
 ['recursive function',{body:[{op:'call',name:'restore'}],functions:{restore:[{op:'call',name:'restore'}]}},['100'],'INVALID_FUNCTION'],
]) test(`safe error for ${name}`,()=>{const r=execute(program,input,{maxSteps:20});assert.equal(r.error?.code,code);assert.ok(r.trace.length<=21)});
