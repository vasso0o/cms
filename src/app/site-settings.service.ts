import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';

export interface Branding {
  siteName: string;
  tagline: string;
  logoUrl: string;
  faviconUrl: string;
  contactEmail: string;
  metaTitle: string;
  metaDescription: string;
  metaKeywords: string;
  ogImageUrl: string;
}

export interface MenuItem {
  label: string;
  url: string;
}

export interface Palette {
  primary: string;
  secondary: string;
  background: string;
  surface: string;
  text: string;
}

export type PaletteKey = keyof Palette;
export type ThemeMode = 'light' | 'dark' | 'auto';

export interface Theme {
  defaultMode: ThemeMode;
  light: Palette;
  dark: Palette;
  cornerRadius: number;
  padding: number;
}

export interface SiteSettings {
  branding: Branding;
  menus: { navigation: MenuItem[]; footer: MenuItem[] };
  theme: Theme;
}

export const PALETTE_FIELDS: { key: PaletteKey; label: string }[] = [
  { key: 'primary', label: 'Primary' },
  { key: 'secondary', label: 'Secondary' },
  { key: 'background', label: 'Background' },
  { key: 'surface', label: 'Surface' },
  { key: 'text', label: 'Text' },
];

export function defaultTheme(): Theme {
  return {
    defaultMode: 'auto',
    light: { primary: '#5b4bff', secondary: '#ff7a59', background: '#ffffff', surface: '#f6f5fb', text: '#1b1a2e' },
    dark: { primary: '#8b7fff', secondary: '#ff9a7e', background: '#12111d', surface: '#1d1c2c', text: '#ecebf7' },
    cornerRadius: 8,
    padding: 24,
  };
}

@Injectable({ providedIn: 'root' })
export class SiteSettingsService {
  private readonly http = inject(HttpClient);

  load(): Promise<SiteSettings> {
    return firstValueFrom(this.http.get<SiteSettings>('/api/site'));
  }

  save(settings: SiteSettings): Promise<SiteSettings> {
    return firstValueFrom(this.http.put<SiteSettings>('/api/site', settings));
  }
}
