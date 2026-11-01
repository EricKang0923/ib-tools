// Waits until typing pauses, then saves, so each keystroke isn't a separate save.
export function delayedSaver({ save, onStatus, delay = 800 }) {
  let pending = null;
  let timer = null;
  let running = Promise.resolve();

  function flush() {
    clearTimeout(timer);
    timer = null;
    if (!pending) return running;
    const changes = pending;
    pending = null;
    onStatus('saving');
    // Saves run one at a time so an older one can't overwrite a newer one.
    running = running.then(async () => {
      try {
        await save(changes);
        if (!pending) onStatus('saved');
      } catch {
        // Keep what failed so the next change or flush tries again.
        pending = { ...changes, ...pending };
        onStatus('failed');
      }
    });
    return running;
  }

  function change(changes) {
    pending = { ...pending, ...changes };
    clearTimeout(timer);
    timer = setTimeout(flush, delay);
  }

  return { change, flush };
}
