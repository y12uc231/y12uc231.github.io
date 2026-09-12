import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../js/opening-quotes.js', import.meta.url), 'utf8');
const quoteData = JSON.parse(readFileSync(new URL('../data/quotes.json', import.meta.url), 'utf8'));
function setup() {
  const events = () => ({listeners: {},
    addEventListener(name, fn) { (this.listeners[name] ??= []).push(fn); },
    dispatchEvent(event) { this.listeners[event.type]?.forEach(fn => fn(event)); }
  });
  const quotes = quoteData.map((_, i) => ({
    hidden: i > 0, inert: i > 0, classes: new Set(), getBoundingClientRect() {},
    get classList() { return {add: name => this.classes.add(name), remove: (...names) => names.forEach(n => this.classes.delete(n))}; }
  }));
  const heading = {...events(), matches: () => false, querySelectorAll: () => quotes, contains: node => !!node?.inHeading};
  const document = {...events(), hidden: false,
    querySelector: selector => selector === '#opening-line' ? heading : null};
  const reduced = {...events(), matches: false};
  let observer, now = 0, id = 0;
  const timers = new Map();
  vm.runInNewContext(source, {document, matchMedia: () => reduced,
    setTimeout(fn, wait) { timers.set(++id, {fn, at: now + wait}); return id; },
    clearTimeout(id) { timers.delete(id); }, queueMicrotask: fn => fn(),
    CustomEvent: class { constructor(type, options) { this.type = type; Object.assign(this, options); } },
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
  return {quotes, heading, document, reduced, tick,
    active: () => quotes.findIndex(quote => !quote.hidden),
    visible: value => observer([{isIntersecting: value}])};
}

test('quotes rotate every seven seconds, with only the current quote exposed', () => {
  const s = setup(); s.visible(true);
  for (let step = 1; step <= quoteData.length; step++) {
    const next = step % quoteData.length;
    s.tick(6999); assert.notEqual(s.active(), next);
    s.tick(1); assert.equal(s.active(), next);
    assert.equal(s.quotes.filter(q => !q.inert).length, 1);
  }
});

test('hover during a fade restores the current quote; focus continues to hold it', () => {
  const s = setup(); s.visible(true); s.tick(6700);
  assert(s.quotes[0].classes.has('is-leaving'));
  s.heading.dispatchEvent({type: 'pointerenter', pointerType: 'mouse'});
  s.heading.dispatchEvent({type: 'focusin'});
  s.heading.dispatchEvent({type: 'pointerleave'});
  s.tick(20000); assert.equal(s.active(), 0); assert.equal(s.quotes[0].classes.size, 0);
  s.heading.dispatchEvent({type: 'focusout'}); s.tick(7000); assert.equal(s.active(), 1);
});

test('quotes honor motion state from the explorer without a separate button', () => {
  const s = setup(); s.visible(true);
  s.document.dispatchEvent({type:'sk-motion-change',detail:{paused:true}});
  s.tick(20000); assert.equal(s.active(),0);
  s.document.dispatchEvent({type:'sk-motion-change',detail:{paused:false}});
  s.tick(7000); assert.equal(s.active(),1);
});

test('an attribution link retains keyboard focus without rotating away', () => {
  const s = setup(); s.visible(true);
  s.heading.dispatchEvent({type: 'focusin'});
  s.document.activeElement = {inHeading: true};
  s.heading.dispatchEvent({type: 'focusout'});
  s.tick(20000); assert.equal(s.active(), 0);
  s.document.activeElement = null;
  s.heading.dispatchEvent({type: 'focusout'});
  s.tick(7000); assert.equal(s.active(), 1);
});

test('offscreen and reduced-motion states suspend rotation without catching up', () => {
  const s = setup(); s.tick(20000); assert.equal(s.active(), 0);
  s.visible(true); s.tick(6700);
  s.reduced.matches = true; s.reduced.dispatchEvent({type: 'change'});
  s.tick(20000); assert.equal(s.active(), 0);
  s.reduced.matches = false; s.reduced.dispatchEvent({type: 'change'});
  s.tick(6999); assert.equal(s.active(), 0);
  s.tick(1); assert.equal(s.active(), 1);
});
