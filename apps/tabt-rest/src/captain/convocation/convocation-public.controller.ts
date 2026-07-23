import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { ApiExcludeEndpoint, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CaptainConvocationService } from './captain-convocation.service';
import {
  ConvocationResponseDto,
  PublicConvocationDto,
  PublicRespondConvocationDto,
} from '../dto/convocation.dto';

@ApiTags('Captain')
@Controller({ path: 'captain/public/convocation', version: '1' })
export class ConvocationPublicController {
  constructor(private readonly service: CaptainConvocationService) {}

  @Get(':token')
  @ApiOperation({ operationId: 'getPublicConvocation' })
  async getPublic(
    @Param('token') token: string,
    @Query('format') format: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    const { dto } = await this.service.getPublicByToken(token);
    if (format === 'json') {
      res.status(HttpStatus.OK).json(dto);
      return;
    }
    res.status(HttpStatus.OK).type('html').send(renderConvocationPage(dto));
  }

  @Post(':token/respond')
  @HttpCode(HttpStatus.OK)
  @ApiExcludeEndpoint()
  @ApiOperation({ operationId: 'respondPublicConvocation' })
  respond(
    @Param('token') token: string,
    @Body() dto: PublicRespondConvocationDto,
  ): Promise<ConvocationResponseDto> {
    return this.service.respondPublic(
      token,
      dto.uniqueIndex,
      dto.status,
      dto.responseToken,
    );
  }
}

function escapeHtml(value: unknown): string {
  const str = value instanceof Date ? value.toISOString() : String(value ?? '');
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Human-readable French date, e.g. "samedi 25 avril 2026". */
function formatFrDate(value: unknown): string {
  if (!value) {
    return '';
  }
  const date = value instanceof Date ? value : new Date(String(value));
  if (isNaN(date.getTime())) {
    return String(value);
  }
  return new Intl.DateTimeFormat('fr-BE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

/** Human-readable French time, e.g. "19h15", from an ISO datetime or "HH:mm[:ss]". */
function formatFrTime(value: unknown): string {
  if (!value) {
    return '';
  }
  const str = value instanceof Date ? value.toISOString() : String(value);
  const match = str.match(/T(\d{2}):(\d{2})/) ?? str.match(/^(\d{2}):(\d{2})/);
  return match ? `${match[1]}h${match[2]}` : str;
}

/** Readable French date + time for the meeting point, tolerant of any input. */
function formatFrDateTime(value: unknown): string {
  if (!value) {
    return '';
  }
  const date = value instanceof Date ? value : new Date(String(value));
  if (isNaN(date.getTime())) {
    return String(value);
  }
  return `${formatFrDate(date)} à ${formatFrTime(value)}`;
}

/**
 * Minimal self-contained read-only page. Responses require the per-player
 * signed capability delivered through the app notification.
 */
function renderConvocationPage(dto: PublicConvocationDto): string {
  const meeting = dto.meetingTime
    ? `<p><strong>Rendez-vous :</strong> ${escapeHtml(formatFrDateTime(dto.meetingTime))}</p>`
    : '';
  const venue = dto.venue
    ? `<p><strong>Lieu :</strong> ${escapeHtml(dto.venue)}</p>`
    : '';

  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Convocation BePing</title>
<style>
  body { font-family: -apple-system, system-ui, sans-serif; margin: 0; padding: 24px; background: #f5f5f7; color: #1c1c1e; }
  .card { max-width: 480px; margin: 0 auto; background: #fff; border-radius: 16px; padding: 24px; box-shadow: 0 2px 12px rgba(0,0,0,.06); }
  h1 { font-size: 20px; margin: 0 0 8px; }
  .opponent { color: #6b6b70; margin-bottom: 16px; }
  .message { white-space: pre-wrap; background: #f0f0f3; border-radius: 12px; padding: 12px; margin: 16px 0; }
</style>
</head>
<body>
  <div class="card">
    <h1>Convocation</h1>
    <p class="opponent">Contre ${escapeHtml(dto.opponent)} — ${escapeHtml(formatFrDate(dto.date))} à ${escapeHtml(formatFrTime(dto.time))}</p>
    <div class="message">${escapeHtml(dto.message)}</div>
    ${meeting}
    ${venue}
    <p>Réponds depuis la notification BePing reçue sur ton appareil.</p>
  </div>
</body>
</html>`;
}
