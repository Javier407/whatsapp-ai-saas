import type { IAppointmentRepo } from '../../domain/ports/IAppointmentRepo.js';
import type { Appointment } from '../../domain/models/Appointment.js';
import { NotFoundError, ValidationError } from '../../domain/errors.js';

const ALLOWED_STATUSES = new Set(['pendiente', 'confirmada', 'completada', 'cancelada']);

export class UpdateAppointmentStatusUseCase {
  constructor(private readonly repo: IAppointmentRepo) {}

  async execute(tenantId: string, id: string, status: string): Promise<Appointment> {
    if (!ALLOWED_STATUSES.has(status)) {
      throw new ValidationError(
        `Invalid status; allowed: ${[...ALLOWED_STATUSES].join(', ')}`,
      );
    }
    const updated = await this.repo.updateStatus(tenantId, id, status);
    if (!updated) throw new NotFoundError('Appointment', id);
    return updated;
  }
}
