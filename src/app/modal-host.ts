import { NgTemplateOutlet } from '@angular/common';
import { Component, inject } from '@angular/core';
import { ModalService } from './modal.service';

@Component({
  selector: 'app-modal-host',
  imports: [NgTemplateOutlet],
  template: `
    @if (modal.template(); as template) {
      <div class="modal-backdrop" (click)="modal.close()" (keydown.escape)="modal.close()">
        <div
          class="modal"
          role="dialog"
          aria-modal="true"
          [attr.aria-label]="modal.config().title"
          tabindex="-1"
          (click)="$event.stopPropagation()"
        >
          <header class="modal-header">
            <div>
              @if (modal.config().kicker) {
                <div class="section-kicker">{{ modal.config().kicker }}</div>
              }
              <h2>{{ modal.config().title }}</h2>
            </div>
            <button class="icon-button" type="button" aria-label="Close" (click)="modal.close()">×</button>
          </header>
          <ng-container [ngTemplateOutlet]="template" />
        </div>
      </div>
    }
  `,
})
export class ModalHost {
  protected readonly modal = inject(ModalService);
}
