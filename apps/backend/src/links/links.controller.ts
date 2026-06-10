import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  NotFoundException,
  UseGuards,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { CreateLinkDto } from './dto/create-link.dto';
import { LinksService } from './links.service';
import { Link } from '../../generated/prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

interface RequestWithUser extends Request {
  user: { userId: string; email: string };
}

@Controller('links')
export class LinksController {
  constructor(private readonly linksService: LinksService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  create(
    @Body() dto: CreateLinkDto,
    @Req() req: RequestWithUser,
  ): Promise<Link> {
    return this.linksService.create(dto, req.user.userId);
  }

  @Get()
  findAll(): Promise<Link[]> {
    return this.linksService.findAll();
  }

  @Get(':code')
  findByCode(@Param('code') code: string): Promise<Link | NotFoundException> { 
    return this.linksService.findByCode(code);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.linksService.remove(id);
  }
}
