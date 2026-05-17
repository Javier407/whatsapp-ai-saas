import type { IFlowEngineClient, DryRunResult } from '../../domain/ports/IFlowEngineClient.js';
import { ExternalServiceError } from '../../domain/errors.js';

export class FlowEngineHttpClient implements IFlowEngineClient {
  constructor(
    private readonly baseUrl: string,
    private readonly internalToken: string,
    private readonly dryRunTimeoutMs: number = 10000,
  ) {}

  async reloadTenantFlows(tenantId: string): Promise<void> {
    const url = `${this.baseUrl}/admin/reload-tenant/${tenantId}`;
    let res: Response;

    try {
      res = await fetch(url, {
        method: 'POST',
        headers: {
          'X-Internal-Token': this.internalToken,
          'Content-Type': 'application/json',
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new ExternalServiceError('flow-engine', `reload failed: ${message}`);
    }

    if (!res.ok) {
      throw new ExternalServiceError('flow-engine', `reload returned ${res.status}`);
    }
  }

  async dryRun(tenantId: string, message: string, simulatedWaId: string): Promise<DryRunResult> {
    const url = `${this.baseUrl}/admin/dry-run`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.dryRunTimeoutMs);

    let res: Response;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: {
          'X-Internal-Token': this.internalToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ tenant_id: tenantId, message, simulated_wa_id: simulatedWaId }),
        signal: controller.signal,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new ExternalServiceError('flow-engine', `dry-run failed: ${message}`);
    } finally {
      clearTimeout(timeout);
    }

    if (!res.ok) {
      throw new ExternalServiceError('flow-engine', `dry-run returned ${res.status}`);
    }

    return res.json() as Promise<DryRunResult>;
  }
}
