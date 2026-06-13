import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { LinksController } from './links.controller';
import { LinksService } from './links.service';
import { RedisModule } from '../redis/redis.module';

@Module({
  imports: [PrismaModule, RedisModule],
  controllers: [LinksController],
  providers: [LinksService],
})
export class LinksModule {}
