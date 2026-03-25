import React, { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { StacksProvider } from '../app/components/StacksProvider';
import { ToastProvider } from '../providers/ToastProvider';

const AllTheProviders = ({ children }: { children: React.ReactNode }) => {
  return (
    <StacksProvider>
      <ToastProvider>
        {children}
      </ToastProvider>
    </StacksProvider>
  );
};

const customRender = (
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) => render(ui, { wrapper: AllTheProviders, ...options });

export * from '@testing-library/react';
export { customRender as render };
