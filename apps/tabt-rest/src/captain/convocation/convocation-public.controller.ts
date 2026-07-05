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
import { ConvocationStatus } from '@app/common';
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
    res
      .status(HttpStatus.OK)
      .type('html')
      .send(renderConvocationPage(token, dto));
  }

  @Post(':token/respond')
  @HttpCode(HttpStatus.OK)
  @ApiExcludeEndpoint()
  @ApiOperation({ operationId: 'respondPublicConvocation' })
  respond(
    @Param('token') token: string,
    @Body() dto: PublicRespondConvocationDto,
  ): Promise<ConvocationResponseDto> {
    return this.service.respondPublic(token, dto.uniqueIndex, dto.status);
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
 * Minimal self-contained French page for players without the app. Uses inline
 * styles and a tiny fetch script (posting to the tokenised respond endpoint).
 */
function renderConvocationPage(
  token: string,
  dto: PublicConvocationDto,
): string {
  const rows = dto.responses
    .map(
      (r) =>
        `<li>${escapeHtml(r.name || String(r.uniqueIndex))} — <strong>${statusLabel(
          r.status,
        )}</strong></li>`,
    )
    .join('');
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
  ul { list-style: none; padding: 0; }
  li { padding: 6px 0; border-bottom: 1px solid #eee; }
  .actions { display: flex; gap: 12px; margin-top: 20px; }
  button { flex: 1; padding: 14px; font-size: 16px; border: 0; border-radius: 12px; cursor: pointer; }
  .yes { background: #34c759; color: #fff; }
  .no { background: #ff3b30; color: #fff; }
  .field { width: 100%; padding: 12px; font-size: 16px; border: 1px solid #d0d0d5; border-radius: 12px; box-sizing: border-box; margin-top: 8px; }
  .ok { color: #34c759; margin-top: 12px; }
</style>
</head>
<body>
  <div class="card">
    <h1>Convocation</h1>
    <p class="opponent">Contre ${escapeHtml(dto.opponent)} — ${escapeHtml(formatFrDate(dto.date))} à ${escapeHtml(formatFrTime(dto.time))}</p>
    <div class="message">${escapeHtml(dto.message)}</div>
    ${meeting}
    ${venue}
    <h2 style="font-size:16px;">Réponses</h2>
    <ul>${rows}</ul>
    <label for="idx">Ton numéro d'affilié :</label>
    <input class="field" id="idx" inputmode="numeric" placeholder="Ex. 512345" />
    <div class="actions">
      <button class="yes" onclick="respond('CONFIRMED')">Je serai présent</button>
      <button class="no" onclick="respond('DECLINED')">Absent</button>
    </div>
    <p class="ok" id="ok" hidden>Réponse enregistrée, merci !</p>
  </div>
<script>
  async function respond(status) {
    var idx = parseInt(document.getElementById('idx').value, 10);
    if (!idx) { alert('Indique ton numéro d\\'affilié'); return; }
    await fetch(${JSON.stringify(`/v1/captain/public/convocation/${token}/respond`)}, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uniqueIndex: idx, status: status })
    });
    document.getElementById('ok').hidden = false;
  }
</script>
</body>
</html>`;
}

function statusLabel(status: ConvocationStatus): string {
  switch (status) {
    case ConvocationStatus.CONFIRMED:
      return 'Présent';
    case ConvocationStatus.DECLINED:
      return 'Absent';
    default:
      return 'En attente';
  }
}
