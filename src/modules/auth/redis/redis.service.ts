import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import Redis from 'ioredis';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private client: Redis;
  private readonly logger = new Logger(RedisService.name);

  constructor(private configService: ConfigService) {}

  onModuleInit(): void {
    const host = this.configService.get<string>('FA_REDIS_HOST', 'localhost');
    const port = this.configService.get<number>('FA_REDIS_PORT', 6379);
    const password = this.configService.get<string>('FA_REDIS_PASSWORD');

    this.logger.log(`Initializing Redis connection to ${host}:${port}`);
    
    this.client = new Redis({
      host,
      port,
      password,
      retryStrategy: (times: number) => {
        const delay = Math.min(times * 50, 2000);
        this.logger.log(`Retrying Redis connection in ${delay}ms (attempt ${times})`);
        return delay;
      },
    });

    this.client.on('connect', () => {
      this.logger.log('Successfully connected to Redis');
    });

    this.client.on('error', (err) => {
      this.logger.error('Redis connection error:', err);
    });
  }

  onModuleDestroy(): void {
    this.logger.log('Disconnecting from Redis');
    this.client.disconnect();
  }

  /**
   * Stores a key-value pair in Redis with an optional expiration time.
   *
   * @param key - The key under which the value will be stored in Redis.
   * @param value - The value to be stored.
   * @param ttl - (Optional) Time-to-live in seconds. If provided, the key will expire after this duration.
   * 
   * @remarks
   * - If `ttl` is defined (e.g., `3600` seconds for 1 hour), the Redis `SET` command is used with the `'EX'` option to set an expiration time.
   * - `'EX'` means "set expiration time in seconds."
   * - Redis will automatically delete the key after the specified time.
   *
   * @example
   * ```typescript
   * await redisService.set('user:123', JSON.stringify({ name: 'Alice' }), 3600);
   * ```
   */
  async set(key: string, value: string, ttl?: number): Promise<void> {
    try {
      this.logger.debug(`Setting key: ${key} with TTL: ${ttl || 'none'}`);
      if (ttl) {
        await this.client.set(key, value, 'EX', ttl);
      } else {
        await this.client.set(key, value);
      }
      this.logger.debug(`Successfully set key: ${key}`);
    } catch (error) {
      this.logger.error(`Error setting key ${key}:`, error);
      throw error;
    }
  }

  /**
   * Retrieves a value from Redis based on a given key.
   *
   * @param key - The key under which the value is stored in Redis.
   * @returns The value associated with the key, or null if the key does not exist.
   */
  async get(key: string): Promise<string | null> {
    try {
      this.logger.debug(`Getting key: ${key}`);
      const value = await this.client.get(key);
      this.logger.debug(`Value for key ${key}: ${value ? 'found' : 'not found'}`);
      return value;
    } catch (error) {
      this.logger.error(`Error getting key ${key}:`, error);
      throw error;
    }
  }

  /**
   * Deletes a key from Redis.
   *
   * @param key - The key to be deleted from Redis.
   * @returns The number of keys deleted, which will be 1 if the key was found and deleted.
   */
  async del(key: string): Promise<number> {
    try {
      this.logger.debug(`Deleting key: ${key}`);
      const result = await this.client.del(key);
      this.logger.debug(`Delete result for key ${key}: ${result}`);
      return result;
    } catch (error) {
      this.logger.error(`Error deleting key ${key}:`, error);
      throw error;
    }
  }
}