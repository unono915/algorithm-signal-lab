import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {attachDrag} from '../src/drag.js';

function setup({canStart = () => true, onDrop} = {}) {
  const dom = new JSDOM(`<!doctype html><main>
    <article id="source" data-drag-source data-drag-group="order" data-drag-label="Move <img> card"><button id="handle" data-drag-handle><span>Grip</span></button><p id="body">Card body</p></article>
    <article id="other" data-drag-source data-drag-group="order"><button data-drag-handle>Other grip</button></article>
    <div id="zone" data-drop-zone data-drop-group="order"><span id="zone-child">Drop here</span></div>
    <div id="wrong" data-drop-zone data-drop-group="condition">Wrong group</div>
  </main>`, {pretendToBeVisual: true});
  const {window} = dom, {document} = window;
  const $ = selector => document.querySelector(selector);
  const calls = [], announcements = [], captures = [], releases = [];
  let hit = $('#zone-child');
  document.elementFromPoint = () => hit;
  $('#handle').setPointerCapture = id => captures.push(id);
  $('#handle').releasePointerCapture = id => releases.push(id);
  const controller = attachDrag({root: document, canStart, onDrop: (source, target) => {
    calls.push([source.id, target.id]);
    return onDrop ? onDrop(source, target) : true;
  }, announce: message => announcements.push(message)});
  function pointer(type, target = $('#handle'), data = {}) {
    const event = new window.Event(type, {bubbles: true, cancelable: true});
    Object.assign(event, {pointerId: 1, pointerType: 'mouse', isPrimary: true, button: 0, clientX: 20, clientY: 20}, data);
    target.dispatchEvent(event);
    return event;
  }
  function begin(data = {}) { pointer('pointerdown', $('#handle span'), data); pointer('pointermove', document, {clientX: 40, ...data}); }
  function clean() {
    assert.equal($('.drag-ghost'), null);
    assert.equal($('.dragging'), null);
    assert.equal($('.drop-available'), null);
    assert.equal($('.drop-over'), null);
  }
  return {window, document, $, calls, announcements, captures, releases, pointer, begin, clean, controller,
    hit: element => {hit = element;}, close: () => {controller.cancel(); window.close();}};
}

test('deliberate handle dragging uses hit testing and commits a compatible drop once', () => {
  const a = setup();
  try {
    a.begin();
    assert.ok(a.$('#source').classList.contains('dragging'));
    assert.ok(a.$('#zone').classList.contains('drop-available'));
    assert.ok(a.$('#zone').classList.contains('drop-over'));
    assert.equal(a.$('#wrong').classList.contains('drop-available'), false);
    assert.equal(a.$('.drag-ghost').textContent, 'Move <img> card');
    assert.equal(a.$('.drag-ghost img'), null);
    assert.deepEqual(a.captures, [1]);
    a.pointer('pointerup', a.$('#handle'), {clientX: 40});
    a.pointer('pointerup', a.document, {clientX: 40});
    assert.deepEqual(a.calls, [['source', 'zone']]);
    assert.deepEqual(a.releases, [1]);
    a.clean();
  } finally {a.close();}
});

test('a handle tap or movement below eight pixels preserves the normal click', () => {
  const a = setup();
  try {
    a.pointer('pointerdown');
    a.pointer('pointermove', a.document, {clientX: 27});
    assert.equal(a.$('.drag-ghost'), null);
    a.pointer('pointerup', a.document, {clientX: 27});
    const click = new a.window.MouseEvent('click', {bubbles: true, cancelable: true, detail: 1});
    a.$('#handle').dispatchEvent(click);
    assert.equal(click.defaultPrevented, false);
    assert.deepEqual(a.calls, []);
    a.clean();
  } finally {a.close();}
});

test('eight pixels starts a touch drag while card-body touch remains scrollable', () => {
  const a = setup();
  try {
    const bodyDown = a.pointer('pointerdown', a.$('#body'), {pointerType: 'touch'});
    const bodyMove = a.pointer('pointermove', a.document, {pointerType: 'touch', clientY: 70});
    assert.equal(bodyDown.defaultPrevented, false);
    assert.equal(bodyMove.defaultPrevented, false);
    assert.equal(a.$('.drag-ghost'), null);
    a.pointer('pointerdown', a.$('#handle'), {pointerType: 'touch'});
    const dragMove = a.pointer('pointermove', a.document, {pointerType: 'touch', clientX: 28});
    assert.equal(dragMove.defaultPrevented, true);
    assert.ok(a.$('.drag-ghost'));
    a.pointer('pointerup', a.document, {pointerType: 'touch', clientX: 28});
    assert.deepEqual(a.calls, [['source', 'zone']]);
    a.clean();
  } finally {a.close();}
});

test('secondary buttons, secondary pointers, disabled handles, and denied starts do nothing', () => {
  for (const kind of ['button', 'secondary', 'disabled', 'denied']) {
    const a = setup({canStart: () => kind !== 'denied'});
    try {
      if (kind === 'disabled') a.$('#handle').disabled = true;
      a.pointer('pointerdown', a.$('#handle'), kind === 'button' ? {button: 2} : kind === 'secondary' ? {isPrimary: false} : {});
      a.pointer('pointermove', a.document, {clientX: 50});
      a.pointer('pointerup', a.document, {clientX: 50});
      assert.deepEqual(a.calls, [], kind);
      assert.deepEqual(a.captures, [], kind);
      a.clean();
    } finally {a.close();}
  }
});

test('a second pointer cannot take over or finish the active drag', () => {
  const a = setup();
  try {
    a.begin();
    a.pointer('pointerdown', a.$('#other button'), {pointerId: 2, isPrimary: false});
    a.pointer('pointermove', a.document, {pointerId: 2, clientX: 80});
    a.pointer('pointerup', a.document, {pointerId: 2, clientX: 80});
    assert.deepEqual(a.calls, []);
    assert.ok(a.$('.drag-ghost'));
    a.pointer('pointerup', a.document, {clientX: 40});
    assert.deepEqual(a.calls, [['source', 'zone']]);
  } finally {a.close();}
});

test('incompatible and outside drops never call onDrop', () => {
  for (const selector of ['#wrong', null]) {
    const a = setup();
    try {
      a.begin();
      a.hit(selector ? a.$(selector) : null);
      a.pointer('pointermove', a.document, {clientX: 60});
      assert.equal(a.$('.drop-over'), null);
      a.pointer('pointerup', a.$('#handle'), {clientX: 60});
      assert.deepEqual(a.calls, []);
      a.clean();
    } finally {a.close();}
  }
});

for (const reason of ['pointercancel', 'lostpointercapture', 'Escape', 'blur', 'explicit']) {
  test(`${reason} cancels without committing and clears every drag affordance`, () => {
    const a = setup();
    try {
      a.begin();
      if (reason === 'Escape') a.document.dispatchEvent(new a.window.KeyboardEvent('keydown', {key: 'Escape', bubbles: true}));
      else if (reason === 'blur') a.window.dispatchEvent(new a.window.Event('blur'));
      else if (reason === 'explicit') a.controller.cancel();
      else a.pointer(reason);
      a.pointer('pointerup', a.document, {clientX: 40});
      assert.deepEqual(a.calls, []);
      assert.deepEqual(a.releases, [1]);
      assert.ok(a.announcements.length);
      a.clean();
    } finally {a.close();}
  });
}

test('rerendering the source immediately removes transient drag UI', async () => {
  const a = setup();
  try {
    a.begin();
    a.$('#source').replaceWith(a.$('#source').cloneNode(true));
    await Promise.resolve();
    a.clean();
    a.pointer('pointerup', a.document, {clientX: 40});
    assert.deepEqual(a.calls, []);
  } finally {a.close();}
});

test('the delegated listener supports newly rendered handles', () => {
  const a = setup();
  try {
    const source = a.$('#source');
    source.outerHTML = '<article id="replacement" data-drag-source data-drag-group="order"><button id="new-handle" data-drag-handle>New card</button></article>';
    a.pointer('pointerdown', a.$('#new-handle'));
    a.pointer('pointermove', a.document, {clientX: 50});
    a.pointer('pointerup', a.document, {clientX: 50});
    assert.deepEqual(a.calls, [['replacement', 'zone']]);
    a.clean();
  } finally {a.close();}
});

test('a state change during dragging prevents an otherwise valid drop', () => {
  let allowed = true;
  const a = setup({canStart: () => allowed});
  try {
    a.begin();
    allowed = false;
    a.pointer('pointerup', a.document, {clientX: 40});
    assert.deepEqual(a.calls, []);
    a.clean();
  } finally {a.close();}
});

test('real drags suppress the trailing click but preserve keyboard and subsequent deliberate clicks', () => {
  const a = setup();
  try {
    let clicks = 0;
    a.document.addEventListener('click', () => clicks++);
    a.begin();
    a.pointer('pointerup', a.document, {clientX: 40});
    const trailing = new a.window.MouseEvent('click', {bubbles: true, cancelable: true, detail: 1});
    a.$('#handle').dispatchEvent(trailing);
    assert.equal(trailing.defaultPrevented, true);
    assert.equal(clicks, 0);
    a.$('#handle').click();
    assert.equal(clicks, 1);
    a.pointer('pointerdown');
    a.pointer('pointerup');
    a.$('#handle').dispatchEvent(new a.window.MouseEvent('click', {bubbles: true, detail: 1}));
    assert.equal(clicks, 2);
  } finally {a.close();}
});

test('native drag is prevented on custom drag handles only', () => {
  const a = setup();
  try {
    const grip = new a.window.Event('dragstart', {bubbles: true, cancelable: true});
    a.$('#handle').dispatchEvent(grip);
    assert.equal(grip.defaultPrevented, true);
    const body = new a.window.Event('dragstart', {bubbles: true, cancelable: true});
    a.$('#body').dispatchEvent(body);
    assert.equal(body.defaultPrevented, false);
  } finally {a.close();}
});
