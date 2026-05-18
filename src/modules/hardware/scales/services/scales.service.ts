import { Injectable, NotFoundException } from '@nestjs/common';
import { PostScaleReadingDto } from '../dto/post-scale-reading.dto';
import { ScaleReadingResponseDto } from '../dto/scale-reading-response.dto';
import {
  ScaleConnectionStatus,
  ScaleStatusResponseDto,
} from '../dto/scale-status-response.dto';

interface ScaleTenantState {
  scaleId: string;
  tenantId: string;
  status: ScaleConnectionStatus;
  statusUpdatedAt: Date;
  latestReading: ScaleReadingResponseDto | null;
  latestStableReading: ScaleReadingResponseDto | null;
}

interface ScaleActiveSession {
  tenantId: string;
  expiresAt: number;
}

/** Duración de la sesión activa (usuario con frontend abierto en la báscula). */
const ACTIVE_SESSION_TTL_MS = 8 * 60 * 60 * 1000;

@Injectable()
export class ScalesService {
  private readonly stateByKey = new Map<string, ScaleTenantState>();
  /** scaleId → tenant del usuario que abrió el panel de pesa en Flutter */
  private readonly activeSessionByScale = new Map<string, ScaleActiveSession>();

  private key(tenantId: string, scaleId: string): string {
    return `${tenantId}:${scaleId}`;
  }

  private getOrCreate(tenantId: string, scaleId: string): ScaleTenantState {
    const k = this.key(tenantId, scaleId);
    let state = this.stateByKey.get(k);
    if (!state) {
      state = {
        scaleId,
        tenantId,
        status: 'disconnected',
        statusUpdatedAt: new Date(),
        latestReading: null,
        latestStableReading: null,
      };
      this.stateByKey.set(k, state);
    }
    return state;
  }

  /**
   * Asocia la pesa al tenant del usuario autenticado en frontend (JWT).
   * El bridge publica lecturas sin tenant; se enrutan aquí mientras la sesión esté activa.
   */
  bindActiveSession(scaleId: string, tenantId: string): void {
    this.activeSessionByScale.set(scaleId, {
      tenantId,
      expiresAt: Date.now() + ACTIVE_SESSION_TTL_MS,
    });
  }

  private resolveActiveTenantId(scaleId: string): string | null {
    const session = this.activeSessionByScale.get(scaleId);
    if (!session) return null;
    if (Date.now() > session.expiresAt) {
      this.activeSessionByScale.delete(scaleId);
      return null;
    }
    return session.tenantId;
  }

  /**
   * @returns null si no hay sesión activa de frontend (lectura ignorada sin error).
   */
  ingestReading(
    scaleId: string,
    dto: PostScaleReadingDto,
  ): ScaleReadingResponseDto | null {
    const tenantId =
      dto.tenantId?.trim() || this.resolveActiveTenantId(scaleId);
    if (!tenantId) {
      return null;
    }
    const state = this.getOrCreate(tenantId, scaleId);
    state.status = 'connected';
    state.statusUpdatedAt = new Date();

    const reading: ScaleReadingResponseDto = {
      deviceId: dto.deviceId ?? scaleId,
      tenantId,
      rawFrame: dto.rawFrame ?? null,
      weight: dto.weight ?? null,
      unit: dto.unit ?? null,
      isStable: dto.isStable,
      stabilityReason: dto.stabilityReason ?? null,
      observedAt: dto.observedAt,
      sequence: dto.sequence,
    };

    state.latestReading = reading;
    if (dto.isStable && dto.weight != null && dto.weight > 0) {
      state.latestStableReading = reading;
    }

    return reading;
  }

  updateBridgeStatus(
    scaleId: string,
    tenantId: string,
    status: ScaleConnectionStatus,
  ): ScaleStatusResponseDto {
    const state = this.getOrCreate(tenantId, scaleId);
    state.status = status;
    state.statusUpdatedAt = new Date();
    return this.toStatusDto(state);
  }

  getStatus(tenantId: string, scaleId: string): ScaleStatusResponseDto {
    const state = this.stateByKey.get(this.key(tenantId, scaleId));
    if (!state) {
      return {
        scaleId,
        tenantId,
        status: 'disconnected',
        updatedAt: new Date().toISOString(),
      };
    }
    return this.toStatusDto(state);
  }

  getLatestReading(
    tenantId: string,
    scaleId: string,
  ): ScaleReadingResponseDto {
    const state = this.stateByKey.get(this.key(tenantId, scaleId));
    if (!state?.latestReading) {
      throw new NotFoundException('No scale reading available');
    }
    return state.latestReading;
  }

  getLatestStableReading(
    tenantId: string,
    scaleId: string,
  ): ScaleReadingResponseDto {
    const state = this.stateByKey.get(this.key(tenantId, scaleId));
    if (!state?.latestStableReading) {
      throw new NotFoundException('No stable scale reading available');
    }
    return state.latestStableReading;
  }

  private toStatusDto(state: ScaleTenantState): ScaleStatusResponseDto {
    return {
      scaleId: state.scaleId,
      tenantId: state.tenantId,
      status: state.status,
      updatedAt: state.statusUpdatedAt.toISOString(),
    };
  }
}
