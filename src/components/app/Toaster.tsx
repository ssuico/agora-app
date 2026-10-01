import { Toaster as HotToaster } from 'react-hot-toast';

const neutralStyle = {
  background: 'var(--card)',
  color: 'var(--foreground)',
  border: '1px solid var(--border)',
};

function solid(token: string) {
  return {
    style: {
      background: `var(--${token})`,
      color: '#fff',
      border: `1px solid var(--${token})`,
    },
    iconTheme: { primary: '#fff', secondary: `var(--${token})` },
  };
}

export function Toaster() {
  return (
    <HotToaster
      position="top-center"
      toastOptions={{
        duration: 4000,
        style: neutralStyle,
        success: solid('success'),
        error: solid('error'),
        loading: solid('info'),
        custom: { style: neutralStyle },
        blank: { style: neutralStyle },
      }}
    />
  );
}
