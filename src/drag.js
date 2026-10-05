/** Pointer dragging is only a preview; onDrop owns all persistent state changes. */
export function attachDrag({root = document, canStart = () => true, onDrop, announce = () => {}}) {
  const doc = root.ownerDocument || root;
  const win = doc.defaultView;
  let active = null;
  let suppressedClick = null;
  const inside = element => Boolean(element?.isConnected && root.contains(element));
  const handleFor = target => target?.closest?.('[data-drag-handle]');
  const disabled = element => element.matches(':disabled') || Boolean(element.closest('[aria-disabled="true"]'));

  function clear() {
    if (!active) return null;
    const previous = active;
    active = null; // Releasing capture can synchronously fire lostpointercapture.
    previous.observer.disconnect();
    previous.ghost?.remove();
    previous.source.classList.remove('dragging');
    previous.zones.forEach(zone => zone.classList.remove('drop-available', 'drop-over'));
    // A rerender may have copied a transient class into a replacement element.
    root.querySelectorAll('.dragging,.drop-available,.drop-over').forEach(element => {
      element.classList.remove('dragging', 'drop-available', 'drop-over');
    });
    if (previous.captured) {
      try { previous.handle.releasePointerCapture(previous.pointerId); } catch { /* Capture can be lost on detach. */ }
    }
    if (previous.started) suppressedClick = {pointerId: previous.pointerId, until: Date.now() + 500};
    return previous;
  }

  function cancel() {
    const previous = clear();
    if (previous?.started) announce('카드 이동을 취소했어요.');
  }

  function valid() {
    return active && inside(active.source) && inside(active.handle) && !disabled(active.handle) && canStart();
  }

  function targetAt(event) {
    // Pointer capture retargets events to the handle, so event.target is not the drop target.
    const target = doc.elementFromPoint?.(event.clientX, event.clientY)?.closest('[data-drop-zone]');
    return inside(target) && target.dataset.dropGroup === active.group && !disabled(target) ? target : null;
  }

  function preview(event) {
    const target = targetAt(event);
    if (active.over !== target) {
      active.over?.classList.remove('drop-over');
      target?.classList.add('drop-over');
      active.over = target;
    }
    active.ghost.style.transform = `translate(${event.clientX + 12}px, ${event.clientY + 12}px)`;
  }

  root.addEventListener('pointerdown', event => {
    if (active || event.isPrimary === false || event.button !== 0) return;
    suppressedClick = null;
    const handle = handleFor(event.target);
    const source = handle?.closest('[data-drag-source]');
    if (!inside(source) || !inside(handle) || disabled(handle) || !source.dataset.dragGroup || !canStart()) return;
    const observer = new win.MutationObserver(() => {
      if (active && (!inside(active.source) || !inside(active.handle))) cancel();
    });
    active = {source, handle, group: source.dataset.dragGroup, pointerId: event.pointerId,
      x: event.clientX, y: event.clientY, started: false, captured: false, zones: [], over: null, ghost: null, observer};
    observer.observe(root, {childList: true, subtree: true});
    try {
      if (handle.setPointerCapture) {
        handle.setPointerCapture(event.pointerId);
        active.captured = true;
      }
    } catch { /* Document listeners still provide a safe fallback. */ }
  });

  doc.addEventListener('pointermove', event => {
    if (!active || event.pointerId !== active.pointerId) return;
    if (!valid()) { cancel(); return; }
    if (!active.started) {
      if (Math.hypot(event.clientX - active.x, event.clientY - active.y) < 8) return;
      active.started = true;
      active.source.classList.add('dragging');
      active.zones = [...root.querySelectorAll('[data-drop-zone]')].filter(zone => zone.dataset.dropGroup === active.group && !disabled(zone));
      active.zones.forEach(zone => zone.classList.add('drop-available'));
      active.ghost = doc.createElement('div');
      active.ghost.className = 'drag-ghost';
      active.ghost.textContent = active.source.dataset.dragLabel || active.source.textContent.trim();
      active.ghost.setAttribute('aria-hidden', 'true');
      Object.assign(active.ghost.style, {position: 'fixed', left: '0', top: '0', pointerEvents: 'none'});
      doc.body.append(active.ghost);
      announce('카드를 끌고 있어요. 강조된 위치에 놓으세요. Escape 키로 취소할 수 있어요.');
    }
    event.preventDefault();
    preview(event);
  }, {passive: false});

  doc.addEventListener('pointerup', event => {
    if (!active || event.pointerId !== active.pointerId) return;
    if (!valid()) { cancel(); return; }
    const target = active.started ? targetAt(event) : null;
    const previous = clear();
    if (!previous.started) return;
    event.preventDefault();
    // Clean before the callback: onDrop may synchronously replace the whole editor.
    if (!target || onDrop(previous.source, target) !== true) announce('카드 이동을 취소했어요.');
  }, {passive: false});

  for (const type of ['pointercancel', 'lostpointercapture']) {
    doc.addEventListener(type, event => {
      if (active && event.pointerId === active.pointerId) cancel();
    }, true);
  }
  doc.addEventListener('keydown', event => {
    if (active && event.key === 'Escape') { event.preventDefault(); cancel(); }
  });
  win.addEventListener('blur', cancel);
  win.addEventListener('pagehide', cancel);
  root.addEventListener('dragstart', event => {
    if (handleFor(event.target)) event.preventDefault();
  });
  doc.addEventListener('click', event => {
    if (!suppressedClick || event.detail === 0 || Date.now() > suppressedClick.until) return;
    if (event.pointerId !== undefined && event.pointerId !== suppressedClick.pointerId) return;
    suppressedClick = null;
    event.preventDefault();
    event.stopImmediatePropagation();
  }, true);

  return {cancel};
}
