/* eslint-disable @typescript-eslint/no-empty-object-type, @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any */
import type { AxeMatchers } from 'vitest-axe/matchers';

// vitest-axe still augments the legacy `Vi` namespace; vitest 3+ reads these from the module.
declare module 'vitest' {
  interface Assertion<T = any> extends AxeMatchers {}
  interface AsymmetricMatchersContaining extends AxeMatchers {}
}
