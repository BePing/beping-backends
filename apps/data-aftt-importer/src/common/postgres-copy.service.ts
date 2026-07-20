import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client } from 'pg';
import { from as copyFrom } from 'pg-copy-streams';
import { pipeline } from 'stream/promises';
import { Readable } from 'stream';

@Injectable()
export class PostgresCopyService implements OnModuleDestroy {
  constructor(private readonly configService: ConfigService) {}

  async onModuleDestroy(): Promise<void> {
    // Connections are short-lived and closed after each COPY session.
  }

  async withClient<T>(callback: (client: Client) => Promise<T>): Promise<T> {
    const client = new Client({
      connectionString: this.configService.get<string>('DATABASE_URL'),
    });

    await client.connect();

    try {
      const statementTimeoutMs = this.readPositiveInteger(
        'IMPORT_STATEMENT_TIMEOUT_MS',
        300_000,
      );
      const lockTimeoutMs = this.readPositiveInteger(
        'IMPORT_LOCK_TIMEOUT_MS',
        2_000,
      );
      await client.query(
        `SELECT
          set_config('application_name', 'beping-importer', false),
          set_config('statement_timeout', $1, false),
          set_config('lock_timeout', $2, false)`,
        [`${statementTimeoutMs}ms`, `${lockTimeoutMs}ms`],
      );

      return await callback(client);
    } finally {
      await client.end();
    }
  }

  private readPositiveInteger(name: string, fallback: number): number {
    const parsed = Number.parseInt(
      this.configService.get<string>(name) || '',
      10,
    );
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  }

  async copyRows(
    client: Client,
    sql: string,
    rows: Iterable<string> | AsyncIterable<string>,
  ): Promise<void> {
    const writable = client.query(copyFrom(sql));

    await pipeline(Readable.from(this.normalizeRows(rows)), writable);
  }

  buildCsvRow(
    values: Array<string | number | boolean | null | undefined>,
  ): string {
    return `${values.map((value) => this.escapeCsvValue(value)).join(',')}\n`;
  }

  private async *normalizeRows(
    rows: Iterable<string> | AsyncIterable<string>,
  ): AsyncGenerator<string> {
    for await (const row of rows) {
      if (row.endsWith('\n')) {
        yield row;
        continue;
      }

      yield `${row}\n`;
    }
  }

  private escapeCsvValue(
    value: string | number | boolean | null | undefined,
  ): string {
    if (value === null || value === undefined) {
      return '\\N';
    }

    const normalized = String(value).replace(/"/g, '""');
    return `"${normalized}"`;
  }
}
