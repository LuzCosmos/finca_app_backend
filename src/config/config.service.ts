import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as ini from 'ini';
import * as path from 'path';

@Injectable()
export class ConfigService {
  private readonly config: any;
  private readonly logger = new Logger(ConfigService.name);

  constructor() {
    const configPath = path.resolve(process.cwd(), '.conf');
    this.logger.debug(`Loading config from: ${configPath}`);
    this.config = ini.parse(fs.readFileSync(configPath, 'utf-8'));
    this.logger.debug('Loaded config:', this.config);
  }

  get(key: string): any {
    const value = this.getNestedValue(this.config, key);
    this.logger.debug(`Getting config key: ${key} = ${value}`);
    return value;
  }

  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((prev, curr) => {
      return prev ? prev[curr] : undefined;
    }, obj);
  }
} 