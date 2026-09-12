import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../js/paper-rotation.js', import.meta.url), 'utf8');
function setup() {
  const events = () => ({listeners: {}, addEventListener(name, fn) { this.listeners[name] = fn; }});
  const groups = Array.from({length: 4}, (_, i) => ({
    hidden: i > 0, inert: i > 0, classes: new Set(), open: false,
    querySelector() { return this.open; },
    getBoundingClientRect() { return {}; },
    get classList() { return {add: name => this.classes.add(name), remove: (...names) => names.forEach(n => this.classes.delete(n))}; }
  }));
  const button = {...events(), setAttribute() {}};
  const stage = {querySelectorAll: () => groups};
  const research = {...events(), open: false, matches: () => false,
    contains: node => !!node?.inside,
    querySelector: selector => ({'.paper-rotation': stage, '.papers-pause': button, '.publication-details': research}[selector])};
  const document = {...events(), hidden: false, activeElement: null, querySelector: () => research};
  const reduced = {...events(), matches: false};
  let observer, now = 0, id = 0;
  const timers = new Map();
  vm.runInNewContext(source, {document, matchMedia: () => reduced,
    setTimeout(fn, wait) { timers.set(++id, {fn, at: now + wait}); return id; },
    clearTimeout(id) { timers.delete(id); }, queueMicrotask: fn => fn(),
    IntersectionObserver: class { constructor(fn) { observer = fn; } observe() {} }
  });
  const tick = milliseconds => {
    const end = now + milliseconds;
    while (true) {
      const next = [...timers].sort((a,b) => a[1].at - b[1].at)[0];
      if (!next || next[1].at > end) break;
      now = next[1].at; timers.delete(next[0]); next[1].fn();
    }
    now = end;
  };
  const active = () => groups.findIndex(group => !group.hidden);
  const emit = (name, data = {}) => research.listeners[name](data);
  const visible = value => observer([{isIntersecting: value}]);
  return {groups, button, research, document, reduced, tick, active, emit, visible};
}

test('four sets cycle in order; only the current set is interactive', () => {
  const s = setup();
  s.tick(10000); assert.equal(s.active(), 0);
  s.visible(true);
  for (const expected of [1, 2, 3, 0]) {
    s.tick(5320); assert.equal(s.active(), expected);
    assert.equal(s.groups.filter(g => !g.inert).length, 1);
    assert.equal(s.groups.filter(g => !g.hidden).length, 1);
  }
});

test('hover during a fade cancels replacement and resumes after a full hold', () => {
  const s = setup(); s.visible(true); s.tick(5100);
  assert(s.groups[0].classes.has('is-leaving'));
  s.emit('pointerenter', {pointerType: 'mouse'}); s.tick(10000);
  assert.equal(s.active(), 0); assert.equal(s.groups[0].classes.size, 0);
  s.emit('pointerleave'); s.tick(5319); assert.equal(s.active(), 0);
  s.tick(1); assert.equal(s.active(), 1);
});

test('focus and open Details stay paused independently of pointer position', () => {
  const s = setup(); s.visible(true);
  s.document.activeElement = {inside: true}; s.emit('focusin');
  s.emit('pointerenter'); s.emit('pointerleave'); s.tick(10000);
  assert.equal(s.active(), 0);
  s.groups[0].open = true; s.emit('toggle');
  s.document.activeElement = null; s.emit('focusout'); s.tick(10000);
  assert.equal(s.active(), 0);
  s.groups[0].open = false; s.emit('toggle'); s.tick(5320);
  assert.equal(s.active(), 1);
});

test('closing All papers resumes even if a nested disclosure remains open', () => {
  const s = setup(); s.visible(true); s.research.open = true; s.emit('toggle');
  s.research.nestedOpen = true; s.tick(10000); assert.equal(s.active(), 0);
  s.research.open = false; s.emit('toggle'); s.tick(5320);
  assert.equal(s.active(), 1);
});

test('manual pause survives hover and visibility changes', () => {
  const s = setup(); s.visible(true); s.button.listeners.click();
  s.emit('pointerenter'); s.emit('pointerleave'); s.visible(false); s.visible(true);
  s.tick(10000); assert.equal(s.active(), 0); assert.equal(s.button.textContent, 'Resume');
  s.button.listeners.click(); s.tick(5320); assert.equal(s.active(), 1);
});

test('hidden tabs, offscreen lists and reduced motion cancel pending fades', () => {
  for (const reason of ['tab', 'offscreen', 'reduced']) {
    const s = setup(); s.visible(true); s.tick(5100);
    const change = value => {
      if (reason === 'tab') { s.document.hidden = value; s.document.listeners.visibilitychange(); }
      if (reason === 'offscreen') s.visible(!value);
      if (reason === 'reduced') { s.reduced.matches = value; s.reduced.listeners.change(); }
    };
    change(true); s.tick(10000); assert.equal(s.active(), 0, reason);
    change(false); s.tick(5319); assert.equal(s.active(), 0, reason);
    s.tick(1); assert.equal(s.active(), 1, reason);
  }
});
