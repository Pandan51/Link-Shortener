import { Injectable, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class RedisService extends Redis implements OnModuleDestroy {
  constructor(configService: ConfigService) {
    super(configService.get<string>('REDIS_URL') as string);
  }
  async onModuleDestroy() {
    await this.quit();
  }
}
