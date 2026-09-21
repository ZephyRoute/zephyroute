'use client';

import { useId, useState, type ReactNode } from 'react';
import styles from './Disclosure.module.css';

export interface DisclosureProps {
  summary: string;
  children: ReactNode;
}

/**
 * "See full quote" and the Custody Fund-Flow Diagram are inline
 * expansions, never modal dialogs (Additional Patterns, Overlay
 * pattern): a modal would interrupt the single continuous surface
 * Guided Status is built around.
 */
export function Disclosure({ summary, children }: DisclosureProps) {
  const [open, setOpen] = useState(false);
  const contentId = useId();

  return (
    <div>
      <button
        type="button"
        className={styles.trigger}
        aria-expanded={open}
        aria-controls={contentId}
        onClick={() => setOpen((value) => !value)}
      >
        {summary}
      </button>
      {open && (
        <div id={contentId} className={styles.content}>
          {children}
        </div>
      )}
    </div>
  );
}
