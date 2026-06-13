import { CreateLinkDto } from './dto/create-link.dto';
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Link } from '../../generated/prisma/client';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class LinksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
  ) {}

  async create(dto: CreateLinkDto, userId: string) {
    return this.prisma.link.create({
      data: {
        ...dto,
        shortCode: Math.random().toString(36).slice(2, 8),
        userId,
      },
    });
  }

  async findAll() {
    return this.prisma.link.findMany();
  }

  async findByCode(code: string): Promise<Link | NotFoundException> {
    const cached: string | null = await this.redisService.get(`link/${code}`);

    if (cached) {
      return JSON.parse(cached) as Link;
    }
    const link: Link | null = await this.prisma.link.findUnique({
      where: { shortCode: code },
    });

    if (!link) {
      throw new NotFoundException(`Link with code "${code}" not found`);
    }
    await this.redisService.set(`link/${code}`, JSON.stringify(link));
    await this.redisService.expire(`link/${code}`, 3600);

    return link;
  }
  async remove(id: string) {
    const result: Link = await this.prisma.link.delete({
      where: {
        id: id,
      },
    });
    await this.redisService.del(`link/${result.shortCode}`);
  }
}
