import { Injectable, signal } from '@angular/core';

export type AppTheme = 'dark' | 'light';
const KEY = 'autoridad-politica-app-theme';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  readonly theme = signal<AppTheme>('dark');

  constructor() {
    try {
      const stored = localStorage.getItem(KEY);
      if (stored === 'light' || stored === 'dark') this.theme.set(stored);
    } catch { /* Storage may be unavailable in some webviews. */ }
    this.apply();
  }

  setTheme(next: AppTheme): void {
    this.theme.set(next);
    try { localStorage.setItem(KEY, next); } catch { /* Keep in-memory selection. */ }
    this.apply();
  }

  toggle(): void { this.setTheme(this.theme() === 'dark' ? 'light' : 'dark'); }

  private apply(): void {
    if (typeof document === 'undefined') return;
    document.documentElement.classList.toggle('app-light', this.theme() === 'light');
    document.documentElement.classList.toggle('app-dark', this.theme() === 'dark');
    document.documentElement.style.colorScheme = this.theme();
  }
}
