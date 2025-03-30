import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class ConfigService {
  private readonly logger = new Logger(ConfigService.name);

  constructor() {
    this.logger.debug('Inicializando ConfigService con variables de entorno');
  }

  get(key: string): any {
    const envKey = this.convertKeyToEnvFormat(key);
    const value = process.env[envKey];
    this.logger.debug(`Getting config key: ${key} (${envKey}) = ${value}`);
    return value;
  }

  private convertKeyToEnvFormat(key: string): string {
    // Convierte formato "database.host" a "DB_HOST"
    // o "chirpstack.api_url" a "CHIRPSTACK_API_URL"
    return key
      .split('.')
      .map(part => {
        if (part === 'database') return 'DB';
        return part.toUpperCase();
      })
      .join('_')
      .replace(/[^A-Z0-9_]/g, '_');
  }
} 