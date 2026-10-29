import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { isPlatformBrowser, NgTemplateOutlet } from '@angular/common';
import { Component, computed, inject, signal, TemplateRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { PLATFORM_ID } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ModalHost } from './modal-host';
import { ModalService } from './modal.service';
import { BLOCK_DEFS, BlockDef, BlockItem, HEADING_STYLE_FIELDS, BlockType as ImportedBlockType } from './block-types';
import {
  defaultTheme,
  FONT_CHOICES,
  WEIGHT_CHOICES,
  SOCIAL_PLATFORMS,
  PALETTE_FIELDS,
  Palette,
  SiteSettings,
  SiteSettingsService,
  Theme,
} from './site-settings.service';

type Section = 'pages' | 'menus' | 'footer' | 'branding' | 'styles';

type UserRole = 'admin' | 'editor';
type PageStatus = 'draft' | 'published';
type BlockType = ImportedBlockType;

interface User {
  id: string;
  email: string;
  role: UserRole;
}

interface ContentBlock {
  id: string;
  type: BlockType;
  data: Record<string, string>;
  order?: number;
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
  readonly publishingSite = signal(false);
  readonly settingsError = signal('');
  readonly settingsNotice = signal('');
  readonly paletteFields = PALETTE_FIELDS;
  readonly headingStyleFields = HEADING_STYLE_FIELDS;
  readonly fontChoices = FONT_CHOICES;
  readonly weightChoices = WEIGHT_CHOICES;
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
    { id: 'footer', label: 'Footer', icon: '▁' },
    { id: 'branding', label: 'Branding & SEO', icon: '◎' },
    { id: 'styles', label: 'Styles & colors', icon: '◐' },
  ];

  authEmail = '';
  authPassword = '';
  inviteToken = '';
  inviteEmail = '';

  readonly blockOptions = BLOCK_DEFS;

  blockTitle(type: BlockType): string {
    return this.blockDef(type)?.title ?? 'Content block';
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
          blocks: page.blocks.map((block, order) => ({ ...block, order })),
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

  /** Color-schema choices stored as CSS variable names (e.g. "--primary"). */
  schemaColors(): { token: string; label: string; color: string }[] {
    const palette = this.draft()?.theme.light ?? defaultTheme().light;
    return PALETTE_FIELDS.map((field) => ({
      token: `--${field.key}`,
      label: field.label,
      color: palette[field.key],
    }));
  }

  isHexColor(value: string | undefined): boolean {
    return !!value && /^#[0-9a-fA-F]{6}$/.test(value);
  }

  blockFieldHandler(blockId: string, field: string): (event: Event) => void {
    return (event) => this.updateBlockField(blockId, field, event);
  }

  blockUploadHandler(blockId: string, field: string): (event: Event) => void {
    return (event) => void this.uploadBlockImage(blockId, field, event);
  }

  itemFieldHandler(block: ContentBlock, index: number, field: string): (event: Event) => void {
    return (event) => this.updateItemField(block, index, field, event);
  }

  itemUploadHandler(block: ContentBlock, index: number, field: string): (event: Event) => void {
    return (event) => void this.uploadItemImage(block, index, field, event);
  }

  addBlock(type: BlockType): void {
    const def = this.blockDef(type);
    const page = this.selectedPage();
    if (!def || !page) {
      return;
    }
    this.updateSelectedPage({
      blocks: [...page.blocks, { id: crypto.randomUUID(), type, data: { ...def.defaults } }],
    });
  }

  blockDef(type: BlockType): BlockDef | undefined {
    return BLOCK_DEFS.find((def) => def.type === type);
  }

  blockItems(block: ContentBlock): BlockItem[] {
    try {
      const parsed: unknown = JSON.parse(block.data['items'] || '[]');
      return Array.isArray(parsed) ? (parsed as BlockItem[]) : [];
    } catch {
      return [];
    }
  }

  addItem(block: ContentBlock): void {
    const def = this.blockDef(block.type);
    if (def?.itemDefaults) {
      this.setItems(block.id, [...this.blockItems(block), { ...def.itemDefaults }]);
    }
  }

  removeItem(block: ContentBlock, index: number): void {
    this.setItems(block.id, this.blockItems(block).filter((_, i) => i !== index));
  }

  moveItem(block: ContentBlock, index: number, offset: number): void {
    const items = this.blockItems(block);
    const target = index + offset;
    if (target < 0 || target >= items.length) {
      return;
    }
    [items[index], items[target]] = [items[target], items[index]];
    this.setItems(block.id, items);
  }

  updateItemField(block: ContentBlock, index: number, field: string, event: Event): void {
    const target = event.target;
    if (
      !(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement)
    ) {
      return;
    }
    this.setItemField(block, index, field, target.value);
  }

  async uploadItemImage(block: ContentBlock, index: number, field: string, event: Event): Promise<void> {
    const url = await this.uploadFromInput(event);
    if (url) {
      this.setItemField(block, index, field, url);
    }
  }

  private setItemField(block: ContentBlock, index: number, field: string, value: string): void {
    const items = this.blockItems(block).map((item, i) => (i === index ? { ...item, [field]: value } : item));
    this.setItems(block.id, items);
  }

  private setItems(blockId: string, items: BlockItem[]): void {
    this.updateSelectedPage({
      blocks: this.selectedPage()?.blocks.map((block) =>
        block.id === blockId ? { ...block, data: { ...block.data, items: JSON.stringify(items) } } : block,
      ),
    });
  }

  updateBlockField(blockId: string, field: string, event: Event): void {
    const target = event.target;
    if (
      !(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement)
    ) {
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

  readonly expandedBlocks = signal<ReadonlySet<string>>(new Set());
  readonly draggedBlockId = signal<string | null>(null);
  readonly dragOverBlockId = signal<string | null>(null);

  toggleBlock(blockId: string): void {
    this.expandedBlocks.update((set) => {
      const next = new Set(set);
      if (!next.delete(blockId)) {
        next.add(blockId);
      }
      return next;
    });
  }

  onBlockDragStart(event: DragEvent, blockId: string): void {
    this.draggedBlockId.set(blockId);
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', blockId);
    }
  }

  onBlockDragOver(event: DragEvent, blockId: string): void {
    if (!this.draggedBlockId()) {
      return;
    }
    event.preventDefault();
    this.dragOverBlockId.set(blockId);
  }

  onBlockDrop(event: DragEvent, targetId: string): void {
    event.preventDefault();
    const sourceId = this.draggedBlockId();
    const blocks = this.selectedPage()?.blocks;
    this.onBlockDragEnd();
    if (!blocks || !sourceId || sourceId === targetId) {
      return;
    }
    const from = blocks.findIndex((block) => block.id === sourceId);
    const to = blocks.findIndex((block) => block.id === targetId);
    if (from < 0 || to < 0) {
      return;
    }
    const reordered = [...blocks];
    const [moved] = reordered.splice(from, 1);
    reordered.splice(to, 0, moved);
    this.updateSelectedPage({ blocks: reordered });
    void this.savePage();
  }

  onBlockDragEnd(): void {
    this.draggedBlockId.set(null);
    this.dragOverBlockId.set(null);
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
      const pages = (await firstValueFrom(this.http.get<Page[]>('/api/pages'))).map((page) => ({
        ...page,
        blocks: page.blocks
          .map((block, index) => ({ block, index }))
          .sort((a, b) => (a.block.order ?? a.index) - (b.block.order ?? b.index))
          .map(({ block }) => this.upgradeBlock(block)),
      }));
      this.pages.set(pages);
      this.selectedPageId.set(pages[0]?.id ?? null);
    } catch (error) {
      this.pageError.set(this.errorMessage(error));
    } finally {
      this.loadingPages.set(false);
    }
  }

  async uploadBrandingImage(field: 'logoUrl' | 'faviconUrl' | 'ogImageUrl', event: Event): Promise<void> {
    const url = await this.uploadFromInput(event);
    const draft = this.draft();
    if (url && draft) {
      draft.branding[field] = url;
    }
  }

  async uploadBlockImage(blockId: string, field: string, event: Event): Promise<void> {
    const url = await this.uploadFromInput(event);
    if (url) {
      this.updateSelectedPage({
        blocks: this.selectedPage()?.blocks.map((block) =>
          block.id === blockId ? { ...block, data: { ...block.data, [field]: url } } : block,
        ),
      });
    }
  }

  private async uploadFromInput(event: Event): Promise<string | null> {
    const input = event.target;
    if (!(input instanceof HTMLInputElement) || !input.files?.length) {
      return null;
    }
    const file = input.files[0];
    input.value = '';
    this.pageError.set('');
    this.settingsError.set('');
    try {
      return await this.siteSettings.uploadImage(file);
    } catch (error) {
      const message = this.errorMessage(error);
      this.pageError.set(message);
      this.settingsError.set(message);
      return null;
    }
  }

  private async loadSettings(): Promise<void> {
    try {
      const settings = await this.siteSettings.load();
      this.draft.set(settings);
      this.loadFont(settings.theme.headingFont);
      this.loadFont(settings.theme.bodyFont);
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

  async publishSite(): Promise<void> {
    const draft = this.draft();
    if (!draft || this.savingSettings() || this.publishingSite()) {
      return;
    }

    await this.saveSettings();
    if (this.settingsError()) {
      return;
    }
    await this.runPublicationAction(true);
  }

  async unpublishSite(): Promise<void> {
    if (!this.draft() || this.savingSettings() || this.publishingSite()) {
      return;
    }
    await this.runPublicationAction(false);
  }

  private async runPublicationAction(shouldPublish: boolean): Promise<void> {
    this.settingsError.set('');
    this.settingsNotice.set('');
    this.publishingSite.set(true);
    try {
      const result = shouldPublish
        ? await this.siteSettings.publish()
        : await this.siteSettings.unpublish();
      this.draft.update((current) => current ? { ...current, published: shouldPublish } : current);
      this.settingsNotice.set(
        shouldPublish
          ? `Publishing started. Your site will update when the build finishes (${result.buildId}).`
          : `Unpublishing started. The site is being removed (${result.buildId}).`,
      );
    } catch (error) {
      this.settingsError.set(this.errorMessage(error));
    } finally {
      this.publishingSite.set(false);
    }
  }

  readonly socialPlatforms = SOCIAL_PLATFORMS;

  addSocialLink(): void {
    this.draft()?.footer.social.push({ platform: 'facebook', url: 'https://' });
  }

  removeSocialLink(index: number): void {
    this.draft()?.footer.social.splice(index, 1);
  }

  moveSocialLink(index: number, offset: number): void {
    const links = this.draft()?.footer.social;
    const target = index + offset;
    if (!links || target < 0 || target >= links.length) {
      return;
    }
    [links[index], links[target]] = [links[target], links[index]];
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

  /** Loads a Google font so the editor preview can show it. */
  loadFont(name: string): void {
    if (!this.isBrowser || name === 'system') {
      return;
    }
    const id = 'gf-' + name.replace(/\s+/g, '-');
    if (document.getElementById(id)) {
      return;
    }
    const link = document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(name).replace(/%20/g, '+')}:wght@400;500;600;700;800;900&display=swap`;
    document.head.appendChild(link);
  }

  previewVars(theme: Theme, palette: Palette): Record<string, string> {
    const stack = (name: string) => (name === 'system' ? 'system-ui, sans-serif' : `'${name}', sans-serif`);
    return {
      '--p-heading-font': stack(theme.headingFont),
      '--p-body-font': stack(theme.bodyFont),
      '--p-size': `${theme.baseSize}px`,
      '--p-weight': `${theme.headingWeight}`,
      '--p-primary': palette.primary,
      '--p-secondary': palette.secondary,
      '--p-background': palette.background,
      '--p-surface': palette.surface,
      '--p-text': palette.text,
      '--p-radius': `${theme.cornerRadius}px`,
      '--p-padding': `${theme.padding}px`,
    };
  }

  /** Converts the old single question/answer FAQ block into the multi-item format. */
  private upgradeBlock(block: ContentBlock): ContentBlock {
    if (block.type !== 'faq' || block.data['items'] !== undefined) {
      return block;
    }
    const { question, answer, ...rest } = block.data;
    const items = question || answer ? [{ question: question ?? '', answer: answer ?? '' }] : [];
    return { ...block, data: { ...rest, title: rest['title'] ?? 'Frequently asked questions', items: JSON.stringify(items) } };
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
