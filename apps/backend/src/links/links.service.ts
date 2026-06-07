import { CreateLinkDto } from './dto/create-link.dto';
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Link } from '../../generated/prisma/client';

@Injectable()
export class LinksService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateLinkDto) {
    return this.prisma.link.create({
      data: {
        ...dto,
        shortCode: Math.random().toString(36).slice(2, 8),
        userId: 'anonymous',
      },
    });
  }

  async findAll() {
    return this.prisma.link.findMany();
  }

  async findByCode(code: string): Promise<Link | NotFoundException> {
    const link = await this.prisma.link.findUnique({
      where: { shortCode: code },
    });

    if (!link) {
      throw new NotFoundException(`Link with code "${code}" not found`);
    }

    return link;
  }
  async remove(id: string) {
    await this.prisma.link.delete({
      where: {
        id: id,
      },
    });
  }
}
