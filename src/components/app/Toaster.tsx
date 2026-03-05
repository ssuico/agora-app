import { Toaster as HotToaster } from 'react-hot-toast';

export function Toaster() {
  return (
    <HotToaster
      position="bottom-right"
      toastOptions={{
        duration: 4000,
        style: {
          background: 'hsl(var(--card))',
          color: 'hsl(var(--foreground))',
          border: '1px solid hsl(var(--border))',
        },
        success: { iconTheme: { primary: 'hsl(var(--primary))' } },
        error: { iconTheme: { primary: 'hsl(var(--destructive))' } },
      }}
    />
  );
}
