import type { IAppointmentRepo } from '../../domain/ports/IAppointmentRepo.js';
import type { Appointment } from '../../domain/models/Appointment.js';

export interface ListAppointmentsInput {
  tenantId: string;
  status?: string;
  limit?: number;
  offset?: number;
}

const MAX_LIMIT = 200;

export class ListAppointmentsUseCase {
  constructor(private readonly repo: IAppointmentRepo) {}

  async execute(
    input: ListAppointmentsInput,
  ): Promise<{ data: Appointment[]; meta: { total: number; limit: number; offset: number } }> {
    const limit = Math.min(input.limit ?? 50, MAX_LIMIT);
    const offset = input.offset ?? 0;

    const { data, total } = await this.repo.list({
      tenantId: input.tenantId,
      status: input.status,
      limit,
      offset,
    });

    return { data, meta: { total, limit, offset } };
  }
}
