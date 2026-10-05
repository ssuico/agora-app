import { Toaster as HotToaster } from 'react-hot-toast';

const neutralStyle = {
  background: 'var(--popover)',
  color: 'var(--popover-foreground)',
  border: '1px solid var(--border)',
};

// Text on a solid status fill is the page surface color: white in light, near-black in dark.
function solid(token: string) {
  return {
    style: {
      background: `var(--${token})`,
      color: 'var(--card)',
      border: `1px solid var(--${token})`,
    },
    iconTheme: { primary: 'var(--card)', secondary: `var(--${token})` },
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
