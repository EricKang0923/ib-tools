import test from 'node:test';
import assert from 'node:assert/strict';
import { delayedSaver } from '../src/saver.js';

function setUp(save) {
  const statuses = [];
  const saver = delayedSaver({ save, onStatus: (s) => statuses.push(s), delay: 10000 });
  return { saver, statuses };
}

test('several quick changes become one save, with the latest values', async () => {
  const saves = [];
  const { saver, statuses } = setUp(async (c) => saves.push(c));
  saver.change({ calculator: 1 });
  saver.change({ calculator: 2 });
  saver.change({ deadlines: 3 });
  await saver.flush();
  assert.deepEqual(saves, [{ calculator: 2, deadlines: 3 }]);
  assert.deepEqual(statuses, ['saving', 'saved']);
});

test('flush with nothing to save does nothing', async () => {
  const saves = [];
  const { saver, statuses } = setUp(async (c) => saves.push(c));
  await saver.flush();
  assert.equal(saves.length, 0);
  assert.equal(statuses.length, 0);
});

test('a failed save is kept and sent again', async () => {
  const saves = [];
  let fail = true;
  const { saver, statuses } = setUp(async (c) => {
    if (fail) throw new Error('offline');
    saves.push(c);
  });
  saver.change({ calculator: 1 });
  await saver.flush();
  assert.equal(statuses.at(-1), 'failed');
  fail = false;
  await saver.flush();
  assert.deepEqual(saves, [{ calculator: 1 }]);
  assert.equal(statuses.at(-1), 'saved');
});

test('a newer change is not replaced by an older failed save', async () => {
  const saves = [];
  let fail = true;
  const { saver } = setUp(async (c) => {
    if (fail) throw new Error('offline');
    saves.push(c);
  });
  saver.change({ calculator: 'old' });
  const first = saver.flush();
  saver.change({ calculator: 'new' });
  await first;
  fail = false;
  await saver.flush();
  assert.deepEqual(saves, [{ calculator: 'new' }]);
});

test('saves run in order', async () => {
  const order = [];
  const { saver } = setUp(async (c) => {
    await new Promise((resolve) => setTimeout(resolve, c.calculator === 1 ? 20 : 0));
    order.push(c.calculator);
  });
  saver.change({ calculator: 1 });
  const first = saver.flush();
  saver.change({ calculator: 2 });
  await Promise.all([first, saver.flush()]);
  assert.deepEqual(order, [1, 2]);
});
