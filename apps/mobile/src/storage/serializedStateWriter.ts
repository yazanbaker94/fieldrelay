export type StateTransition<State> = (current: State) => State | Promise<State>;

export interface SerializedStateWriter<State> {
  transition(update: StateTransition<State>): Promise<State>;
  whenIdle(): Promise<void>;
}

export function createSerializedStateWriter<State>(options: {
  read: () => State;
  persist: (next: State) => Promise<void>;
  publish: (next: State) => void;
}): SerializedStateWriter<State> {
  let tail: Promise<void> = Promise.resolve();

  return {
    transition(update) {
      const result = tail.then(async () => {
        // The updater is deliberately evaluated inside the queue. A caller may
        // enqueue while another SQLite write is pending, but it cannot capture
        // and later overwrite that older state.
        const next = await update(options.read());
        await options.persist(next);
        options.publish(next);
        return next;
      });

      // A rejected write is reported to its caller without poisoning later
      // transitions. Since publish happens only after persistence, the next
      // updater still reads the last durable state.
      tail = result.then(
        () => undefined,
        () => undefined,
      );
      return result;
    },
    whenIdle() {
      return tail;
    },
  };
}
