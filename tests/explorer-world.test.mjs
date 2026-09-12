import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import * as THREE from '../js/vendor/three.module.min.js';

// Exercise the actual geometry and choreography without requiring a GPU or browser.
function scene(reducedMotion = false) {
  const events=()=>({listeners:{},addEventListener(name,fn){(this.listeners[name]??=[]).push(fn);},dispatchEvent(event){this.listeners[event.type]?.forEach(fn=>fn(event));}});
  const thought = {style: {setProperty() {}}, addEventListener() {}};
  const canvas = {...events(),attributes:{},setAttribute(name,value){this.attributes[name]=value;},clientWidth: 1000, clientHeight: 500};
  const host = {classList: {add() {}}, querySelector: selector =>
    selector === '.loss-surface' ? canvas : selector === '.explorer-thought' ? thought : null};
  let frames = 0;
  class Renderer {
    constructor() { this.shadowMap = {}; }
    setClearColor() {} setPixelRatio() {} setSize() {}
    render(world, camera) { world.updateMatrixWorld(true); camera.updateMatrixWorld(true); }
  }
  const context = {
    THREE: {...THREE, WebGLRenderer: Renderer}, devicePixelRatio: 1,
    document: {...events(),hidden: false, querySelector: () => host},
    CustomEvent: class {constructor(type,options){this.type=type;Object.assign(this,options);}},
    matchMedia: () => ({matches: reducedMotion, addEventListener() {}}),
    localStorage: {getItem: () => 'true'}, // An old pause must not stall a fresh visit.
    requestAnimationFrame: () => ++frames, cancelAnimationFrame() {},
    IntersectionObserver: class { observe() {} },
    ResizeObserver: class { constructor(fn) { this.fn = fn; } observe() { this.fn(); } }
  };
  let source = readFileSync(new URL('../js/explorer-world.js', import.meta.url), 'utf8').replace(/^import[^\n]*\n/, '');
  source = source.replace("host.classList.add('world-ready');draw();sync();",
    "globalThis.rig={pose,phaseAt,heightAt,actor,head,book,world,camera,ground,timetable,total,walkingFoot,routeLengths,CHARACTER_SCALE,legs,arms};host.classList.add('world-ready');draw();sync();");
  vm.runInNewContext(source, context);
  assert(context.rig, 'The scene must initialize');
  return {...context.rig, frames, thought, canvas};
}

function exposure(rig, group) {
  rig.world.updateMatrixWorld(true);
  const towardCamera = rig.camera.getWorldDirection(new THREE.Vector3()).negate();
  let exposed = 0, total = 0;
  group.traverse(mesh => {
    if (!mesh.isMesh) return;
    for (let parent = mesh; parent; parent = parent.parent) if (!parent.visible) return;
    const positions = mesh.geometry.attributes.position;
    const step = Math.max(1, Math.floor(positions.count / 35));
    for (let i = 0; i < positions.count; i += step) {
      const point = new THREE.Vector3().fromBufferAttribute(positions, i).applyMatrix4(mesh.matrixWorld);
      const ray = new THREE.Raycaster(point.addScaledVector(towardCamera, .0001), towardCamera, .0001, 30);
      if (!ray.intersectObject(rig.ground).length) exposed++;
      total++;
    }
  });
  return exposed / Math.max(1, total);
}

const rig = scene();
test('a fresh visit starts moving behind a hill and reveals the explorer within a second', () => {
  assert(rig.frames > 0);
  assert.equal(rig.phaseAt(0).kind, 'walk');
  rig.pose(0);
  assert.equal(exposure(rig, rig.actor), 0);
  const start = rig.actor.position.clone();
  rig.pose(1 / 60);
  assert(rig.actor.position.distanceTo(start) > .001, 'The first step must not wait');
  rig.pose(.8);
  assert(exposure(rig, rig.head) > .1, 'The head should begin appearing promptly');
});

test('the landscape has many modest peaks and valleys', () => {
  const n = 128;
  const heights = Array.from({length: n + 1}, (_, i) =>
    Array.from({length: n + 1}, (_, j) => rig.heightAt(-3.7 + 7.4 * i / n, -3.7 + 7.4 * j / n)));
  let peaks = 0, valleys = 0, low = Infinity, high = -Infinity;
  for (let i = 1; i < n; i++) for (let j = 1; j < n; j++) {
    const h = heights[i][j], neighbors = [];
    low = Math.min(low, h); high = Math.max(high, h);
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++)
      if (a || b) neighbors.push(heights[i + a][j + b]);
    if (neighbors.every(value => value < h)) peaks++;
    if (neighbors.every(value => value > h)) valleys++;
  }
  assert(peaks >= 8 && valleys >= 8);
  assert(high - low < 1.5, 'A single oversized mountain should not dominate');
});

test('the complete walk preserves limb lengths and keeps foot contacts above terrain', () => {
  for (let time = 0; time < rig.total; time += 1 / 30) {
    rig.pose(time);
    for (const limb of [...rig.legs, ...rig.arms]) {
      const [start, joint, end] = limb.shape.joints;
      assert(Math.abs(start.distanceTo(joint) - limb.upperLength) < .0001, `Unreachable upper limb at ${time}`);
      assert(Math.abs(joint.distanceTo(end) - limb.lowerLength) < .0001, `Unreachable lower limb at ${time}`);
      assert(limb.shape.mesh.geometry.attributes.position.array.every(Number.isFinite));
    }
    for(const leg of rig.legs) {
      const [hip,knee,ankle]=leg.shape.joints;
      const flex=hip.clone().sub(knee).normalize().dot(ankle.clone().sub(knee).normalize());
      const degrees=180-Math.acos(Math.max(-1,Math.min(1,flex)))*180/Math.PI;
      assert(degrees<110,`Knee folds excessively at ${time}`);
    }
  }
  for (let route = 0; route < rig.routeLengths.length; route++) {
    for (let distance = 0; distance < rig.routeLengths[route]; distance += .01) {
      for (const side of [-1, 1]) {
        const {point} = rig.walkingFoot(route, distance, side);
        assert(point.y >= rig.heightAt(point.x, point.z) + .035 * rig.CHARACTER_SCALE - 1e-7);
      }
    }
  }
});

test('reading stops show both the face and the book', () => {
  let time = 0;
  for (const stage of rig.timetable) {
    if (stage.kind === 'read') {
      rig.pose(time + 6);
      assert(exposure(rig, rig.head) > .7, `Face hidden at reading stop ${stage.place}`);
      assert(exposure(rig, rig.book) > .7, `Book hidden at reading stop ${stage.place}`);
    } else {
      rig.pose(time + 2);
      assert.equal(rig.book.visible, false);
    }
    time += stage.duration;
  }
});

test('walking arms hang almost straight without flaring sideways', () => {
  let time = 0;
  for (const stage of rig.timetable) {
    if (stage.kind === 'walk') {
      for (let age = 0; age < stage.duration; age += .15) {
        rig.pose(time + age);
        for (const arm of rig.arms) {
          const [shoulder, elbow, wrist] = arm.shape.joints;
          assert(shoulder.distanceTo(wrist) / (arm.upperLength + arm.lowerLength) > .998);
          assert(Math.abs(elbow.x - shoulder.x) < .028, 'Elbow flares out');
          assert(shoulder.y - wrist.y > .32);
          const fingers=new THREE.Vector3(0,-1,0).applyQuaternion(arm.hand.quaternion);
          const forearm=wrist.clone().sub(elbow).normalize();
          assert(fingers.dot(forearm) > .999, 'Wrist must follow the forearm');
          const thumb=new THREE.Vector3(-arm.side,0,0).applyQuaternion(arm.hand.quaternion);
          assert(thumb.z > .9, 'Relaxed thumbs should point forward, not backward');
        }
      }
    }
    time += stage.duration;
  }
});

test('limbs stay straight between joints throughout walking and reading', () => {
  for(let time=0;time<rig.total;time+=.25) {
    rig.pose(time);
    for(const arm of [...rig.arms,...rig.legs]) {
      const positions=arm.shape.mesh.geometry.attributes.position;
      const [shoulder,elbow,wrist]=arm.shape.joints;
      for(const [start,end,first,last] of [[shoulder,elbow,2,8],[elbow,wrist,12,18]]) {
        const axis=end.clone().sub(start).normalize();
        for(let ring=first;ring<=last;ring++) {
          const center=new THREE.Vector3();
          for(let j=0;j<12;j++) center.add(new THREE.Vector3().fromBufferAttribute(positions,ring*13+j));
          center.divideScalar(12).sub(start);
          assert(center.clone().addScaledVector(axis,-center.dot(axis)).length()<.000001, 'Limb bends between joints');
        }
      }
    }
  }
});

test('the open pages face the reader and his gaze lowers toward the book',()=>{
  let time=0;
  for(const stage of rig.timetable) {
    if(stage.kind==='read') {
      rig.pose(time+3);
      const pages=new THREE.Vector3(0,0,1).applyEuler(rig.book.rotation);
      const towardFace=rig.head.position.clone().sub(rig.book.position).normalize();
      assert(pages.dot(towardFace)>.9,'Pages face away from the reader');
      assert(rig.head.rotation.x>.7,'Reader is looking over the book');
    }
    time+=stage.duration;
  }
});

test('reading and book transitions keep elbows low and near the body',()=>{
  for(let time=0;time<rig.total;time+=.08) {
    if(rig.phaseAt(time).kind!=='read')continue;
    rig.pose(time);
    for(const arm of rig.arms) {
      const [shoulder,elbow]=arm.shape.joints;
      assert(arm.side*(elbow.x-shoulder.x)<.04,`Elbow flares outward at ${time}`);
      assert(shoulder.y-elbow.y>.10,`Elbow rises to shoulder height at ${time}`);
    }
  }
});

test('the scene can pause by click or keyboard without a visible control',()=>{
  rig.canvas.dispatchEvent({type:'click'});
  assert.equal(rig.canvas.attributes['aria-pressed'],'true');
  rig.canvas.dispatchEvent({type:'keydown',key:' ',preventDefault(){}});
  assert.equal(rig.canvas.attributes['aria-pressed'],'false');
});

test('reduced motion keeps a visible, static reader', () => {
  const still = scene(true);
  assert.equal(still.frames, 0);
  assert.equal(still.book.visible, true);
  assert(exposure(still, still.head) > .7);
});
