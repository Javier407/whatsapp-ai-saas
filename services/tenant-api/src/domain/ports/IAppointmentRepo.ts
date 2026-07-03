import type { Appointment } from '../models/Appointment.js';

export interface ListAppointmentsFilter {
  tenantId: string;
  status?: string;
  limit: number;
  offset: number;
}

export interface IAppointmentRepo {
  list(filter: ListAppointmentsFilter): Promise<{ data: Appointment[]; total: number }>;
  updateStatus(tenantId: string, id: string, status: string): Promise<Appointment | null>;
}
