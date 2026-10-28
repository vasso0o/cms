import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';

const MAX_IMAGE_SIDE = 1920;

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
  domain: string;
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
  published: boolean;
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

  async uploadImage(file: File): Promise<string> {
    const body = new FormData();
    body.append('file', await this.downscale(file));
    const result = await firstValueFrom(this.http.post<{ url: string }>('/api/media', body));
    return result.url;
  }

  /** Shrinks images wider or taller than MAX_IMAGE_SIDE. GIFs are left alone to keep animation. */
  private async downscale(file: File): Promise<File> {
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      return file;
    }
    try {
      const bitmap = await createImageBitmap(file);
      const scale = Math.min(1, MAX_IMAGE_SIDE / Math.max(bitmap.width, bitmap.height));
      if (scale === 1) {
        bitmap.close();
        return file;
      }
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(bitmap.width * scale);
      canvas.height = Math.round(bitmap.height * scale);
      canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      bitmap.close();
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, file.type, 0.85));
      return blob && blob.size < file.size ? new File([blob], file.name, { type: file.type }) : file;
    } catch {
      return file;
    }
  }
}
