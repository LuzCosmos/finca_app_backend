import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  DeviceDiagnosticState,
  DeviceRemoteConfiguration,
} from '../entities/device-remote-configuration.entity';

@Injectable()
export class DeviceRemoteConfigurationRepository {
  constructor(
    @InjectRepository(DeviceRemoteConfiguration)
    private readonly repository: Repository<DeviceRemoteConfiguration>,
  ) {}

  async findByDevice(idDevice: string): Promise<DeviceRemoteConfiguration | null> {
    return this.repository.findOne({ where: { idDevice } });
  }

  async upsertDesired(input: {
    idTenant: string;
    idDevice: string;
    desired: Record<string, unknown>;
    idProfile?: string | null;
    profileSnapshot?: Record<string, unknown> | null;
  }): Promise<DeviceRemoteConfiguration> {
    const existing = await this.findByDevice(input.idDevice);
    const desired = { ...(existing?.desired ?? {}), ...input.desired };
    const desiredVersion = (existing?.desiredVersion ?? 0) + 1;
    const divergent = this.computeDivergent(desired, existing?.confirmed ?? {});
    const partial: Partial<DeviceRemoteConfiguration> = {
      idTenant: input.idTenant,
      idDevice: input.idDevice,
      idProfile: input.idProfile ?? existing?.idProfile ?? null,
      profileSnapshot: input.profileSnapshot ?? existing?.profileSnapshot ?? null,
      desired,
      desiredVersion,
      divergent,
      lastPushedAt: new Date(),
    };
    if (existing) {
      Object.assign(existing, partial);
      return this.repository.save(existing);
    }
    const created = this.repository.create({
      ...partial,
      confirmed: {},
      confirmedVersion: 0,
    });
    return this.repository.save(created);
  }

  async applyConfirmedParameters(
    idDevice: string,
    confirmedDelta: Record<string, unknown>,
    confirmedVersion: number,
  ): Promise<DeviceRemoteConfiguration | null> {
    const existing = await this.findByDevice(idDevice);
    if (!existing) return null;
    const confirmed = { ...existing.confirmed, ...confirmedDelta };
    const divergent = this.computeDivergent(existing.desired, confirmed);
    existing.confirmed = confirmed;
    existing.confirmedVersion = Math.max(existing.confirmedVersion, confirmedVersion);
    existing.divergent = divergent;
    existing.lastConfirmedAt = new Date();
    return this.repository.save(existing);
  }

  private computeDivergent(
    desired: Record<string, unknown>,
    confirmed: Record<string, unknown>,
  ): string[] {
    const out: string[] = [];
    for (const k of Object.keys(desired)) {
      if (!Object.prototype.hasOwnProperty.call(confirmed, k)) {
        out.push(k);
        continue;
      }
      if (JSON.stringify(desired[k]) !== JSON.stringify(confirmed[k])) {
        out.push(k);
      }
    }
    return out;
  }

  // ============================================================
  // Diagnostic mode (modo diagnóstico temporal)
  // ============================================================

  /**
   * Persiste (o limpia) `diagnostic_state` para un device.
   * Pasar `null` desactiva el modo diagnóstico.
   */
  async setDiagnosticState(
    idDevice: string,
    state: DeviceDiagnosticState | null,
  ): Promise<DeviceRemoteConfiguration | null> {
    const existing = await this.findByDevice(idDevice);
    if (!existing) return null;
    existing.diagnosticState = state;
    return this.repository.save(existing);
  }

  /**
   * Devuelve los devices cuyo `diagnostic_state.expiresAt` ya pasó.
   * Lo usa el cron interno para auto-restaurar.
   *
   * El índice parcial `idx_device_remote_cfg_diagnostic_active` evita un seq scan.
   */
  async findExpiredDiagnosticModes(now: Date): Promise<DeviceRemoteConfiguration[]> {
    return this.repository
      .createQueryBuilder('cfg')
      .where('cfg.diagnostic_state IS NOT NULL')
      .andWhere(
        `("cfg"."diagnostic_state"->>'expiresAt')::timestamptz <= :now`,
        { now: now.toISOString() },
      )
      .getMany();
  }
}
