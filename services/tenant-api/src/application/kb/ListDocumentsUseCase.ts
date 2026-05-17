import type { IKbDocumentRepo } from '../../domain/ports/IKbDocumentRepo.js';
import type { KbDocument } from '../../domain/models/KbDocument.js';

export class ListDocumentsUseCase {
  constructor(private readonly kbRepo: IKbDocumentRepo) {}

  async execute(tenantId: string): Promise<KbDocument[]> {
    return this.kbRepo.listByTenant(tenantId);
  }
}
