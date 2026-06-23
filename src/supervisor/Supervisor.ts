import type { FrameworkDriver } from '../types';

const POLL_INTERVAL_MS = 3000;

// Markers that indicate a blocking overlay is present in the hierarchy
const BLOCKING_MARKERS = ['xcuielementtypealert', 'xcuielementtypesheet', 'android.app.dialog'];

// Out-of-hierarchy overlays (Cast SDK, system permission in some OS versions)
// are detected by the app being visually blocked but no marker in XML.
// We use a secondary heuristic: if XML has no interactive elements visible,
// attempt to dismiss by probing known dismiss labels.
const NATIVE_DISMISS_LABELS = [
  'OK',
  'Cancel',
  'Allow',
  'Deny',
  'Dismiss',
  'Got it',
  'Done',
  'Log In',
];

export class Supervisor {
  private timer: NodeJS.Timeout | null = null;
  private paused = false;
  private busy = false;
  private driver: FrameworkDriver;

  constructor(driver: FrameworkDriver) {
    this.driver = driver;
  }

  start(): void {
    this.timer = setInterval(() => {
      void this.poll();
    }, POLL_INTERVAL_MS);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  pause(): void {
    this.paused = true;
  }
  resume(): void {
    this.paused = false;
  }

  private async poll(): Promise<void> {
    if (this.paused || this.busy) return;
    this.busy = true;
    try {
      const xml = await this.driver.captureViewHierarchy();
      const lower = xml.toLowerCase();

      // Hierarchy-visible blocking overlay
      const hasBlockingOverlay = BLOCKING_MARKERS.some((m) => lower.includes(m));
      if (!hasBlockingOverlay) {
        // Check for out-of-hierarchy overlays by probing dismiss labels
        // Only if XML shows no enabled interactive elements (app appears frozen)
        const hasInteractiveElements =
          lower.includes('enabled="true"') && lower.includes('visible="true"');
        if (hasInteractiveElements) return; // App is fine, nothing to dismiss
      }

      // Attempt dismissal — stop at first successful tap
      for (const label of NATIVE_DISMISS_LABELS) {
        const dismissed = await this.tryTap(label);
        if (dismissed) return;
      }
    } catch {
      // Non-fatal — main test flow continues
    } finally {
      this.busy = false;
    }
  }

  private async tryTap(label: string): Promise<boolean> {
    try {
      await this.driver.executeCode(`await element(by.label('${label}')).atIndex(0).tap();`, {});
      return true;
    } catch {
      return false;
    }
  }
}
