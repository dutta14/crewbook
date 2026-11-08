import { render, type RenderResult } from '@testing-library/react';
import type { ReactElement, ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { ToastProvider } from '../components/Toast';
import type { AppData } from '../types';

export interface RenderWithProvidersOptions {
  route?: string;
  // Accepted now so tests written against the final signature keep compiling. They take effect
  // once the encrypted-storage and settings providers exist (issues #2 and #3).
  initialData?: Partial<AppData>;
  passphrase?: string;
}

export function renderWithProviders(
  ui: ReactElement,
  { route = '/' }: RenderWithProvidersOptions = {},
): RenderResult {
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={[route]}>
      <ToastProvider>{children}</ToastProvider>
    </MemoryRouter>
  );
  return render(ui, { wrapper: Wrapper });
}
