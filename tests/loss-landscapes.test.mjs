import {test} from 'node:test';
import assert from 'node:assert/strict';
import {LANDSCAPES,selectLandscape} from '../js/loss-landscapes.js';

const memory=()=>{
  const values=new Map();
  return {getItem:key=>values.get(key),setItem:(key,value)=>values.set(key,value)};
};

test('refreshes visit all twelve landscapes before repeating, without adjacent repeats',()=>{
  const storage=memory(),picks=Array.from({length:48},()=>selectLandscape(storage).id);
  for(let start=0;start<picks.length;start+=12) assert.equal(new Set(picks.slice(start,start+12)).size,12);
  for(let i=1;i<picks.length;i++)assert.notEqual(picks[i],picks[i-1]);
});

test('invalid or unavailable browser storage cannot break the scene',()=>{
  const storage=memory();
  for(const invalid of ['{','null','{"last":99,"remaining":[0]}','{"last":1,"remaining":[2,2]}']) {
    storage.setItem('sk-landscapes-v1',invalid);
    assert(LANDSCAPES.includes(selectLandscape(storage)));
  }
  const blocked={getItem(){throw Error('blocked');},setItem(){throw Error('blocked');}};
  assert(LANDSCAPES.includes(selectLandscape(blocked)));
  assert(LANDSCAPES.includes(selectLandscape(undefined)));
});

test('the catalog contains distinct finite surfaces with multiple peaks and valleys',()=>{
  assert.equal(LANDSCAPES.length,12);
  const samples=LANDSCAPES.map(landscape=>{
    const grid=Array.from({length:81},(_,i)=>Array.from({length:81},(_,j)=>landscape.height(-3.7+i*7.4/80,-3.7+j*7.4/80)));
    let peaks=0,valleys=0;
    for(let i=1;i<80;i++)for(let j=1;j<80;j++){
      const h=grid[i][j],neighbors=[];
      assert(Number.isFinite(h)&&h>-.1&&h<1.5,`${landscape.id} height out of range`);
      for(let a=-1;a<=1;a++)for(let b=-1;b<=1;b++)if(a||b)neighbors.push(grid[i+a][j+b]);
      if(neighbors.every(n=>n<h))peaks++;
      if(neighbors.every(n=>n>h))valleys++;
    }
    assert(peaks>=6&&valleys>=6,`${landscape.id} needs several distinct hills and valleys`);
    return grid.flat();
  });
  for(let i=0;i<samples.length;i++)for(let j=0;j<i;j++) {
    const rms=Math.sqrt(samples[i].reduce((sum,value,k)=>sum+(value-samples[j][k])**2,0)/samples[i].length);
    assert(rms>.15,`${LANDSCAPES[i].id} looks too similar to ${LANDSCAPES[j].id}`);
  }
});
