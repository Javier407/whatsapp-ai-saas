import type { PrismaClient } from '@prisma/client';
import type { IAppointmentRepo, ListAppointmentsFilter } from '../../domain/ports/IAppointmentRepo.js';
import type { Appointment } from '../../domain/models/Appointment.js';

function mapRow(row: {
  id: string;
  tenantId: string;
  waId: string;
  customerName: string | null;
  service: string | null;
  appointmentDate: string | null;
  status: string;
  createdAt: Date;
}): Appointment {
  return {
    id: row.id,
    tenantId: row.tenantId,
    waId: row.waId,
    customerName: row.customerName,
    service: row.service,
    appointmentDate: row.appointmentDate,
    status: row.status,
    createdAt: row.createdAt,
  };
}

export class PrismaAppointmentRepo implements IAppointmentRepo {
  constructor(private readonly prisma: PrismaClient) {}

  async list(filter: ListAppointmentsFilter): Promise<{ data: Appointment[]; total: number }> {
    const where = {
      tenantId: filter.tenantId,
      ...(filter.status && { status: filter.status }),
    };

    const [rows, total] = await Promise.all([
      this.prisma.appointment.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: filter.offset,
        take: filter.limit,
      }),
      this.prisma.appointment.count({ where }),
    ]);

    return { data: rows.map(mapRow), total };
  }

  async updateStatus(tenantId: string, id: string, status: string): Promise<Appointment | null> {
    // updateMany so the tenantId filter applies (defense in depth on top of RLS)
    const result = await this.prisma.appointment.updateMany({
      where: { id, tenantId },
      data: { status },
    });
    if (result.count === 0) return null;
    const row = await this.prisma.appointment.findFirst({ where: { id, tenantId } });
    return row ? mapRow(row) : null;
  }
}
