export interface Appointment {
  id: string;
  tenantId: string;
  waId: string;
  customerName: string | null;
  service: string | null;
  appointmentDate: string | null;
  status: string;
  createdAt: Date;
}
