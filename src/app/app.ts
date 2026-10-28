import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { isPlatformBrowser, NgTemplateOutlet } from '@angular/common';
import { Component, computed, inject, signal, TemplateRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { PLATFORM_ID } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ModalHost } from './modal-host';
import { ModalService } from './modal.service';
import {
  defaultTheme,
  PALETTE_FIELDS,
  Palette,
  SiteSettings,
  SiteSettingsService,
  Theme,
} from './site-settings.service';

type Section = 'pages' | 'menus' | 'branding' | 'styles';

type UserRole = 'admin' | 'editor';
type PageStatus = 'draft' | 'published';
type BlockType = 'hero' | 'heading' | 'image' | 'button' | 'faq';

interface User {
  id: string;
  email: string;
  role: UserRole;
}

interface ContentBlock {
  id: string;
  type: BlockType;
  data: Record<string, string>;
}

interface Page {
  id: string;
  title: string;
  slug: string;
  status: PageStatus;
  blocks: ContentBlock[];
  createdAt: string;
  updatedAt: string;
}

interface Invitation {
  email: string;
  token: string;
  expiresAt: string;
}

@Component({
  imports: [FormsModule, ModalHost, NgTemplateOutlet],
  selector: 'app-root',
  styleUrl: './app.css',
  templateUrl: './app.html',
})
export class App {
  private readonly http = inject(HttpClient);
  protected readonly modal = inject(ModalService);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  readonly user = signal<User | null>(null);
  readonly pages = signal<Page[]>([]);
  readonly selectedPageId = signal<string | null>(null);
  readonly selectedPage = computed(
    () => this.pages().find((page) => page.id === this.selectedPageId()) ?? null,
  );
  readonly checkingSession = signal(true);
  readonly loadingPages = signal(false);
  readonly savingPage = signal(false);
  readonly authMode = signal<'login' | 'register'>('login');
  readonly authError = signal('');
  readonly pageError = signal('');
  readonly pageNotice = signal('');
  readonly inviteNotice = signal('');
  readonly inviteResult = signal<Invitation | null>(null);
  private readonly siteSettings = inject(SiteSettingsService);
  readonly section = signal<Section>('pages');
  readonly draft = signal<SiteSettings | null>(null);
  readonly savingSettings = signal(false);
  readonly settingsError = signal('');
  readonly settingsNotice = signal('');
  readonly paletteFields = PALETTE_FIELDS;
  readonly menuDefs: { key: 'navigation' | 'footer'; title: string; help: string }[] = [
    { key: 'navigation', title: 'Navigation menu', help: 'Links shown in the site header.' },
    { key: 'footer', title: 'Footer menu', help: 'Links shown in the site footer.' },
  ];
  readonly modes: { key: 'light' | 'dark'; title: string }[] = [
    { key: 'light', title: 'Light mode colors' },
    { key: 'dark', title: 'Dark mode colors' },
  ];

  addPageFromSelect(menu: 'navigation' | 'footer', event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLSelectElement)) {
      return;
    }
    const page = this.pages().find((item) => item.id === target.value);
    if (page) {
      this.addPageToMenu(menu, page);
    }
    target.value = '';
  }
  readonly sections: { id: Section; label: string; icon: string }[] = [
    { id: 'pages', label: 'Pages', icon: '▤' },
    { id: 'menus', label: 'Menus', icon: '☰' },
    { id: 'branding', label: 'Branding & SEO', icon: '◎' },
    { id: 'styles', label: 'Styles & colors', icon: '◐' },
  ];

  authEmail = '';
  authPassword = '';
  inviteToken = '';
  inviteEmail = '';

  readonly blockOptions: { type: BlockType; title: string; description: string }[] = [
    { type: 'hero', title: 'Hero section', description: 'A featured headline and call to action' },
    { type: 'heading', title: 'Heading & text', description: 'An eyebrow, heading, and body copy' },
    { type: 'image', title: 'Image', description: 'An image with alt text and a caption' },
    { type: 'button', title: 'Button', description: 'A standalone link or call to action' },
    { type: 'faq', title: 'FAQ', description: 'A question with its answer' },
  ];

  blockTitle(type: BlockType): string {
    return this.blockOptions.find((option) => option.type === type)?.title ?? 'Content block';
  }

  constructor() {
    if (this.isBrowser) {
      const params = new URLSearchParams(window.location.search);
      this.inviteToken = params.get('invite') ?? '';
      this.authEmail = params.get('email') ?? '';
      if (this.inviteToken) {
        this.authMode.set('register');
      }
      void this.restoreSession();
    }
  }

  openAdmin(template: TemplateRef<unknown>): void {
    this.inviteNotice.set('');
    this.inviteResult.set(null);
    this.modal.open(template, { kicker: 'TEAM ACCESS', title: 'Invite a teammate' });
  }

  async signIn(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    this.authError.set('');
    try {
      const user = await firstValueFrom(
        this.http.post<User>('/api/auth/login', {
          email: this.authEmail,
          password: this.authPassword,
        }),
      );
      this.authPassword = '';
      await this.acceptUser(user);
    } catch (error) {
      this.authError.set(this.errorMessage(error));
    }
  }

  async register(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    this.authError.set('');
    try {
      const user = await firstValueFrom(
        this.http.post<User>('/api/auth/register', {
          email: this.authEmail,
          password: this.authPassword,
          inviteToken: this.inviteToken,
        }),
      );
      this.authPassword = '';
      window.history.replaceState({}, '', window.location.pathname);
      this.inviteToken = '';
      await this.acceptUser(user);
    } catch (error) {
      this.authError.set(this.errorMessage(error));
    }
  }

  async signOut(): Promise<void> {
    this.authError.set('');
    try {
      await firstValueFrom(this.http.post<void>('/api/auth/logout', {}));
      this.user.set(null);
      this.pages.set([]);
      this.selectedPageId.set(null);
      this.draft.set(null);
      this.section.set('pages');
      this.authMode.set('login');
    } catch (error) {
      this.authError.set(this.errorMessage(error));
    }
  }

  async createPage(): Promise<void> {
    this.pageError.set('');
    this.pageNotice.set('');
    try {
      const page = await firstValueFrom(
        this.http.post<Page>('/api/pages', {
          title: 'Untitled page',
          status: 'draft',
          blocks: [],
        }),
      );
      this.pages.update((pages) => [page, ...pages]);
      this.selectedPageId.set(page.id);
      this.pageNotice.set('Page created.');
    } catch (error) {
      this.pageError.set(this.errorMessage(error));
    }
  }

  async savePage(): Promise<void> {
    const page = this.selectedPage();
    if (!page) {
      return;
    }
    this.pageError.set('');
    this.pageNotice.set('');
    this.savingPage.set(true);
    try {
      const savedPage = await firstValueFrom(
        this.http.put<Page>(`/api/pages/${encodeURIComponent(page.id)}`, {
          title: page.title,
          status: page.status,
          blocks: page.blocks,
        }),
      );
      this.pages.update((pages) => pages.map((item) => (item.id === savedPage.id ? savedPage : item)));
      this.pageNotice.set('All changes saved.');
    } catch (error) {
      this.pageError.set(this.errorMessage(error));
    } finally {
      this.savingPage.set(false);
    }
  }

  async deletePage(): Promise<void> {
    const page = this.selectedPage();
    if (!page || !window.confirm(`Delete "${page.title}"? This cannot be undone.`)) {
      return;
    }
    this.pageError.set('');
    this.pageNotice.set('');
    try {
      await firstValueFrom(this.http.delete<void>(`/api/pages/${encodeURIComponent(page.id)}`));
      this.pages.update((pages) => pages.filter((item) => item.id !== page.id));
      this.selectedPageId.set(null);
    } catch (error) {
      this.pageError.set(this.errorMessage(error));
    }
  }

  updateTitle(event: Event): void {
    const target = event.target;
    if (target instanceof HTMLInputElement) {
      this.updateSelectedPage({ title: target.value });
    }
  }

  updateStatus(event: Event): void {
    const target = event.target;
    if (target instanceof HTMLSelectElement && (target.value === 'draft' || target.value === 'published')) {
      this.updateSelectedPage({ status: target.value });
    }
  }

  addBlock(type: BlockType): void {
    const defaults: Record<BlockType, Record<string, string>> = {
      hero: { title: 'A bold headline', subtitle: 'Add a short supporting message.', buttonLabel: 'Get started', buttonUrl: '', imageUrl: '' },
      heading: { eyebrow: '', text: 'Your heading', body: 'Add your content here.' },
      image: { url: '', alt: '', caption: '' },
      button: { label: 'Learn more', url: '' },
      faq: { question: 'Frequently asked question', answer: 'Write a helpful answer.' },
    };
    const page = this.selectedPage();
    if (!page) {
      return;
    }
    this.updateSelectedPage({
      blocks: [...page.blocks, { id: crypto.randomUUID(), type, data: { ...defaults[type] } }],
    });
  }

  updateBlockField(blockId: string, field: string, event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)) {
      return;
    }
    this.updateSelectedPage({
      blocks: this.selectedPage()?.blocks.map((block) =>
        block.id === blockId ? { ...block, data: { ...block.data, [field]: target.value } } : block,
      ),
    });
  }

  removeBlock(blockId: string): void {
    const blocks = this.selectedPage()?.blocks.filter((block) => block.id !== blockId);
    if (blocks) {
      this.updateSelectedPage({ blocks });
    }
  }

  async createInvitation(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    this.inviteNotice.set('');
    this.inviteResult.set(null);
    try {
      const invitation = await firstValueFrom(
        this.http.post<Invitation>('/api/auth/invitations', { email: this.inviteEmail }),
      );
      this.inviteResult.set(invitation);
      this.inviteNotice.set('Invitation ready. Share this one-time link with the invited user.');
      this.inviteEmail = '';
    } catch (error) {
      this.inviteNotice.set(this.errorMessage(error));
    }
  }

  invitationUrl(invitation: Invitation): string {
    const query = new URLSearchParams({ invite: invitation.token, email: invitation.email });
    return `${window.location.origin}/?${query.toString()}`;
  }

  async copyInvitation(): Promise<void> {
    const invitation = this.inviteResult();
    if (!invitation) {
      return;
    }
    try {
      await navigator.clipboard.writeText(this.invitationUrl(invitation));
      this.inviteNotice.set('Invitation link copied.');
    } catch {
      this.inviteNotice.set('Copy failed. Select and copy the invitation link below.');
    }
  }

  useInvitation(): void {
    this.authMode.set('register');
    this.authError.set('');
  }

  useLogin(): void {
    this.authMode.set('login');
    this.authError.set('');
  }

  private async restoreSession(): Promise<void> {
    try {
      const user = await firstValueFrom(this.http.get<User>('/api/auth/me'));
      await this.acceptUser(user);
    } catch (error) {
      if (!(error instanceof HttpErrorResponse && error.status === 401)) {
        this.authError.set(this.errorMessage(error));
      }
    } finally {
      this.checkingSession.set(false);
    }
  }

  private async acceptUser(user: User): Promise<void> {
    this.user.set(user);
    void this.loadSettings();
    this.loadingPages.set(true);
    try {
      const pages = await firstValueFrom(this.http.get<Page[]>('/api/pages'));
      this.pages.set(pages);
      this.selectedPageId.set(pages[0]?.id ?? null);
    } catch (error) {
      this.pageError.set(this.errorMessage(error));
    } finally {
      this.loadingPages.set(false);
    }
  }

  private async loadSettings(): Promise<void> {
    try {
      this.draft.set(await this.siteSettings.load());
    } catch (error) {
      this.settingsError.set(this.errorMessage(error));
    }
  }

  async saveSettings(): Promise<void> {
    const draft = this.draft();
    if (!draft) {
      return;
    }
    this.settingsError.set('');
    this.settingsNotice.set('');
    this.savingSettings.set(true);
    try {
      this.draft.set(await this.siteSettings.save(draft));
      this.settingsNotice.set('Settings saved.');
    } catch (error) {
      this.settingsError.set(this.errorMessage(error));
    } finally {
      this.savingSettings.set(false);
    }
  }

  openSection(section: Section): void {
    this.section.set(section);
    this.settingsError.set('');
    this.settingsNotice.set('');
  }

  addMenuItem(menu: 'navigation' | 'footer'): void {
    this.draft()?.menus[menu].push({ label: '', url: '/' });
  }

  removeMenuItem(menu: 'navigation' | 'footer', index: number): void {
    this.draft()?.menus[menu].splice(index, 1);
  }

  moveMenuItem(menu: 'navigation' | 'footer', index: number, offset: number): void {
    const items = this.draft()?.menus[menu];
    const target = index + offset;
    if (!items || target < 0 || target >= items.length) {
      return;
    }
    [items[index], items[target]] = [items[target], items[index]];
  }

  addPageToMenu(menu: 'navigation' | 'footer', page: Page): void {
    this.draft()?.menus[menu].push({ label: page.title, url: `/${page.slug}` });
  }

  resetTheme(): void {
    const draft = this.draft();
    if (draft) {
      draft.theme = defaultTheme();
    }
  }

  previewVars(theme: Theme, palette: Palette): Record<string, string> {
    return {
      '--p-primary': palette.primary,
      '--p-secondary': palette.secondary,
      '--p-background': palette.background,
      '--p-surface': palette.surface,
      '--p-text': palette.text,
      '--p-radius': `${theme.cornerRadius}px`,
      '--p-padding': `${theme.padding}px`,
    };
  }

  private updateSelectedPage(patch: Partial<Page>): void {
    const id = this.selectedPageId();
    if (!id) {
      return;
    }
    this.pages.update((pages) => pages.map((page) => (page.id === id ? { ...page, ...patch } : page)));
    this.pageNotice.set('');
  }

  private errorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      const message = error.error?.error;
      if (typeof message === 'string') {
        return message;
      }
      return error.status === 0
        ? 'Could not reach the server. Check that the development server and API are running.'
        : error.message;
    }
    return error instanceof Error ? error.message : 'An unexpected error occurred.';
  }
}
