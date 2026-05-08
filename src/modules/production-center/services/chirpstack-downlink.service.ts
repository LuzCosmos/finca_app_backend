import {
  BadGatewayException,
  BadRequestException,
  HttpException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';

/**
 * Item encolado en ChirpStack para un downlink.
 * Mapea 1:1 al `QueueItem` documentado por la API REST v4 de ChirpStack
 * (`POST /api/devices/{deveui}/queue`).
 */
export interface ChirpStackQueueItem {
  /** UUID asignado por ChirpStack al enqueue. Ausente al crear. */
  id?: string;
  /** Puerto LoRaWAN (1..255). LW001-BG PRO: 10 (general) u 11 (local storage). */
  fPort: number;
  /** Payload binario codificado en base64. */
  data: string;
  /** Si true, se solicita ACK del dispositivo. Default false. */
  confirmed?: boolean;
  /** Frame counter; ChirpStack lo asigna si no se provee. */
  fCntDown?: number;
  /** Variables/tags opcionales. */
  isPending?: boolean;
}

export interface ChirpStackEnqueueResult {
  /** UUID del item en la cola; usado para cancel y para correlación. */
  queueItemId: string;
}

/**
 * Servicio dedicado a la integración con la cola de downlinks de ChirpStack v4.
 *
 * Encapsula las llamadas REST `/api/devices/{deveui}/queue` (enqueue, list, flush, cancel)
 * y aísla al resto del dominio de detalles de transporte/auth.
 *
 * Diseño:
 *  - Stateless (puede usarse desde cualquier servicio que necesite encolar).
 *  - No conoce nada del codec MOKO; recibe `data` ya codificada en base64.
 *  - Convierte errores HTTP en excepciones Nest tipadas para que los upstream puedan reaccionar.
 */
@Injectable()
export class ChirpStackDownlinkService {
  private readonly logger = new Logger(ChirpStackDownlinkService.name);
  private readonly baseUrl: string;
  private readonly token: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    const url = this.configService.get<string>('CHIRPSTACK_API_URL');
    const token = this.configService.get<string>('CHIRPSTACK_API_KEY');
    if (!url || !token) {
      throw new Error('CHIRPSTACK_API_URL and CHIRPSTACK_API_KEY must be defined');
    }
    this.baseUrl = url.replace(/\/+$/, '');
    this.token = token;
  }

  /**
   * Encola un downlink en ChirpStack para el `deveui` indicado.
   *
   * Acepta `payloadHex` o `payloadBase64`. Si llegan ambos, prevalece base64.
   * Devuelve el `queueItemId` (UUID) para correlacionar con la entidad local.
   */
  async enqueue(
    deveui: string,
    options: {
      fPort: number;
      payloadHex?: string;
      payloadBase64?: string;
      confirmed?: boolean;
    },
  ): Promise<ChirpStackEnqueueResult> {
    const { fPort, payloadHex, payloadBase64, confirmed = false } = options;
    if (!deveui || deveui.length !== 16) {
      throw new BadRequestException(`Invalid DevEUI: "${deveui}" (expected 16 hex chars)`);
    }
    if (fPort < 1 || fPort > 223) {
      throw new BadRequestException(`Invalid fPort ${fPort}, must be between 1 and 223`);
    }
    const data = payloadBase64 ?? this.toBase64(payloadHex ?? '');
    if (!data) {
      throw new BadRequestException('payloadHex or payloadBase64 is required');
    }

    const queueItem: ChirpStackQueueItem = { fPort, data, confirmed };

    try {
      const response = await this.httpService.axiosRef.post<{ id: string }>(
        `${this.baseUrl}/api/devices/${deveui}/queue`,
        { queueItem },
        { headers: this.headers('json') },
      );
      const queueItemId = response.data?.id;
      if (!queueItemId) {
        throw new BadGatewayException(
          `ChirpStack responded without queueItem id (HTTP ${response.status})`,
        );
      }
      this.logger.debug(
        `Enqueued downlink ${queueItemId} on ${deveui} (fPort=${fPort}, ${data.length}B base64, confirmed=${confirmed})`,
      );
      return { queueItemId };
    } catch (error) {
      this.handleHttpError(error, `enqueue downlink on ${deveui}`);
    }
  }

  /** Lista los items actualmente en cola para el dispositivo. */
  async list(deveui: string): Promise<ChirpStackQueueItem[]> {
    try {
      const response = await this.httpService.axiosRef.get<{
        result?: ChirpStackQueueItem[];
        totalCount?: number;
      }>(`${this.baseUrl}/api/devices/${deveui}/queue`, { headers: this.headers() });
      return response.data?.result ?? [];
    } catch (error) {
      this.handleHttpError(error, `list downlink queue on ${deveui}`);
    }
  }

  /** Vacía toda la cola de downlinks del dispositivo. */
  async flush(deveui: string): Promise<void> {
    try {
      await this.httpService.axiosRef.delete(`${this.baseUrl}/api/devices/${deveui}/queue`, {
        headers: this.headers(),
      });
      this.logger.debug(`Flushed downlink queue on ${deveui}`);
    } catch (error) {
      this.handleHttpError(error, `flush downlink queue on ${deveui}`);
    }
  }

  /** Cancela un único item en cola por `queueItemId`. */
  async cancel(deveui: string, queueItemId: string): Promise<void> {
    try {
      await this.httpService.axiosRef.delete(
        `${this.baseUrl}/api/devices/${deveui}/queue/${queueItemId}`,
        { headers: this.headers() },
      );
      this.logger.debug(`Cancelled queue item ${queueItemId} on ${deveui}`);
    } catch (error) {
      this.handleHttpError(error, `cancel queue item ${queueItemId} on ${deveui}`);
    }
  }

  /** Convierte hex (`'0a02012c'` o `'0A 02 01 2C'`) a base64. */
  toBase64(hex: string): string {
    const cleaned = hex.replace(/\s+/g, '');
    if (cleaned.length === 0) return '';
    if (cleaned.length % 2 !== 0 || /[^0-9a-fA-F]/.test(cleaned)) {
      throw new BadRequestException(`Invalid hex payload: "${hex}"`);
    }
    return Buffer.from(cleaned, 'hex').toString('base64');
  }

  private headers(contentType?: 'json'): Record<string, string> {
    const h: Record<string, string> = {
      Accept: 'application/json',
      'Grpc-Metadata-Authorization': `Bearer ${this.token}`,
    };
    if (contentType === 'json') h['Content-Type'] = 'application/json';
    return h;
  }

  private handleHttpError(error: unknown, action: string): never {
    if (error instanceof HttpException) {
      throw error;
    }
    const e = error as {
      response?: { status?: number; data?: unknown };
      message?: string;
    };
    const status = e.response?.status;
    const body = e.response?.data ? JSON.stringify(e.response.data) : (e.message ?? 'Unknown');
    if (status === 404) {
      throw new NotFoundException(`Device not found in ChirpStack while ${action}: ${body}`);
    }
    if (status === 401 || status === 403) {
      throw new BadGatewayException(`ChirpStack auth error while ${action}: ${body}`);
    }
    if (status && status >= 500) {
      throw new BadGatewayException(`ChirpStack 5xx while ${action} (HTTP ${status}): ${body}`);
    }
    throw new BadRequestException(`ChirpStack error while ${action} (HTTP ${status ?? 'n/a'}): ${body}`);
  }
}
