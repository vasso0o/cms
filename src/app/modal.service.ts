import { Injectable, signal, TemplateRef } from '@angular/core';

export interface ModalConfig {
  title: string;
  kicker?: string;
}

@Injectable({ providedIn: 'root' })
export class ModalService {
  readonly template = signal<TemplateRef<unknown> | null>(null);
  readonly config = signal<ModalConfig>({ title: '' });

  open(template: TemplateRef<unknown>, config: ModalConfig): void {
    this.config.set(config);
    this.template.set(template);
  }

  close(): void {
    this.template.set(null);
  }
}
