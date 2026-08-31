import * as React from 'react';

const MOBILE_BREAKPOINT = 768;

export function useIsMobile() {
  return React.useSyncExternalStore(
    (onStoreChange) => {
      const media = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
      media.addEventListener('change', onStoreChange);
      return () => media.removeEventListener('change', onStoreChange);
    },
    () => window.innerWidth < MOBILE_BREAKPOINT,
    () => false,
  );
}
