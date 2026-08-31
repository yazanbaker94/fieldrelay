import { describe, expect, it } from 'vitest';
import { createSerializedStateWriter } from './serializedStateWriter';

interface TestState {
  online: boolean;
  queue: string[];
}

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((complete) => {
    resolve = complete;
  });
  return { promise, resolve };
}

describe('serialized state writer', () => {
  it('evaluates concurrent transitions in invocation order against the latest durable state', async () => {
    let current: TestState = { online: false, queue: [] };
    const firstWriteStarted = deferred();
    const releaseFirstWrite = deferred();
    const writes: TestState[] = [];
    const writer = createSerializedStateWriter<TestState>({
      read: () => current,
      persist: async (next) => {
        writes.push(structuredClone(next));
        if (writes.length === 1) {
          firstWriteStarted.resolve();
          await releaseFirstWrite.promise;
        }
      },
      publish: (next) => {
        current = next;
      },
    });

    const toggle = writer.transition((state) => ({ ...state, online: true }));
    await firstWriteStarted.promise;
    const enqueue = writer.transition((state) => ({ ...state, queue: [...state.queue, 'OP-2'] }));

    await Promise.resolve();
    expect(writes).toEqual([{ online: true, queue: [] }]);
    releaseFirstWrite.resolve();
    await Promise.all([toggle, enqueue]);

    expect(writes).toEqual([
      { online: true, queue: [] },
      { online: true, queue: ['OP-2'] },
    ]);
    expect(current).toEqual({ online: true, queue: ['OP-2'] });
  });

  it('continues from the last durable state after an earlier write fails', async () => {
    let current: TestState = { online: false, queue: [] };
    let attempt = 0;
    const writer = createSerializedStateWriter<TestState>({
      read: () => current,
      persist: async () => {
        attempt += 1;
        if (attempt === 1) throw new Error('disk full');
      },
      publish: (next) => {
        current = next;
      },
    });

    const failed = writer.transition((state) => ({ ...state, online: true }));
    const succeeded = writer.transition((state) => ({ ...state, queue: [...state.queue, 'OP-2'] }));

    await expect(failed).rejects.toThrow('disk full');
    await expect(succeeded).resolves.toEqual({ online: false, queue: ['OP-2'] });
    await writer.whenIdle();
    expect(current).toEqual({ online: false, queue: ['OP-2'] });
  });
});
