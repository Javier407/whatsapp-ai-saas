import type { FastifyPluginAsync } from 'fastify';
import type { ListAppointmentsUseCase } from '../../../application/appointments/ListAppointmentsUseCase.js';
import type { UpdateAppointmentStatusUseCase } from '../../../application/appointments/UpdateAppointmentStatusUseCase.js';
import { ok, sendDomainError } from '../reply.js';

interface AppointmentRoutesDeps {
  listAppointmentsUseCase: ListAppointmentsUseCase;
  updateAppointmentStatusUseCase: UpdateAppointmentStatusUseCase;
}

export const appointmentsRoutes: FastifyPluginAsync<AppointmentRoutesDeps> = async (
  fastify,
  opts,
) => {
  fastify.addHook('preHandler', fastify.authenticate);

  /** GET /api/v1/appointments */
  fastify.get<{
    Querystring: { status?: string; limit?: string; offset?: string };
  }>('/', async (request, reply) => {
    try {
      const result = await opts.listAppointmentsUseCase.execute({
        tenantId: request.tenantId,
        status: request.query.status,
        limit: request.query.limit ? parseInt(request.query.limit, 10) : undefined,
        offset: request.query.offset ? parseInt(request.query.offset, 10) : undefined,
      });

      ok(
        reply,
        result.data.map((a) => ({
          id: a.id,
          wa_id: a.waId,
          customer_name: a.customerName,
          service: a.service,
          appointment_date: a.appointmentDate,
          status: a.status,
          created_at: a.createdAt,
        })),
      );
    } catch (err) {
      sendDomainError(reply, err);
    }
  });

  /** PATCH /api/v1/appointments/:id — update status */
  fastify.patch<{
    Params: { id: string };
    Body: { status: string };
  }>('/:id', async (request, reply) => {
    try {
      const updated = await opts.updateAppointmentStatusUseCase.execute(
        request.tenantId,
        request.params.id,
        request.body?.status ?? '',
      );
      ok(reply, {
        id: updated.id,
        wa_id: updated.waId,
        customer_name: updated.customerName,
        service: updated.service,
        appointment_date: updated.appointmentDate,
        status: updated.status,
        created_at: updated.createdAt,
      });
    } catch (err) {
      sendDomainError(reply, err);
    }
  });
};
