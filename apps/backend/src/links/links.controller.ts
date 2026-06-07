import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  NotFoundException,
} from '@nestjs/common';
import { CreateLinkDto } from './dto/create-link.dto';
import { LinksService } from './links.service';
import { Link } from '../../generated/prisma/client';

@Controller('links')
export class LinksController {
  constructor(private readonly linksService: LinksService) {}

  @Post()
  create(@Body() dto: CreateLinkDto): Promise<Link> {
    return this.linksService.create(dto);
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
