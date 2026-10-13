import type { ReactNode } from 'react';

interface PreviewFrameProps {
  path: string;
  caption: string;
  children: ReactNode;
}

export function PreviewFrame({ path, caption, children }: PreviewFrameProps) {
  return (
    <figure className="flex h-full flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <div className="flex items-center gap-2 border-b border-border bg-muted px-3 py-2" aria-hidden="true">
        <span className="flex shrink-0 gap-1">
          <span className="size-2 rounded-full bg-error/70" />
          <span className="size-2 rounded-full bg-warning/70" />
          <span className="size-2 rounded-full bg-success/70" />
        </span>
        <span className="min-w-0 truncate font-mono text-[11px] text-muted-foreground">{path}</span>
      </div>
      <div className="bg-canvas p-2.5 sm:p-3" aria-hidden="true">
        {children}
      </div>
      <figcaption className="mt-auto border-t border-border px-3 py-2.5 text-xs leading-relaxed text-muted-foreground">
        {caption}
      </figcaption>
    </figure>
  );
}
