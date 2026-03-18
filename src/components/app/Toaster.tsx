import { Toaster as HotToaster } from 'react-hot-toast';

const defaultStyle = {
  border: '1px solid hsl(var(--border))',
};

export function Toaster() {
  return (
    <HotToaster
      position="bottom-right"
      toastOptions={{
        duration: 4000,
        style: {
          background: 'hsl(var(--card))',
          color: 'hsl(var(--foreground))',
          ...defaultStyle,
        },
        success: {
          style: {
            background: '#16a34a',
            color: '#fff',
            border: '1px solid #15803d',
          },
          iconTheme: { primary: '#fff', secondary: '#16a34a' },
        },
        error: {
          style: {
            background: '#dc2626',
            color: '#fff',
            border: '1px solid #b91c1c',
          },
          iconTheme: { primary: '#fff', secondary: '#dc2626' },
        },
        loading: {
          style: {
            background: '#2563eb',
            color: '#fff',
            border: '1px solid #1d4ed8',
          },
          iconTheme: { primary: '#fff', secondary: '#2563eb' },
        },
        custom: {
          style: {
            background: 'hsl(var(--card))',
            color: 'hsl(var(--foreground))',
            ...defaultStyle,
          },
        },
        blank: {
          style: {
            background: 'hsl(var(--card))',
            color: 'hsl(var(--foreground))',
            ...defaultStyle,
          },
        },
      }}
    />
  );
}
