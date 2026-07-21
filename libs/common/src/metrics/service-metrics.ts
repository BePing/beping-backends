import type { INestApplication } from '@nestjs/common';
import { Logger } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import {
  collectDefaultMetrics,
  Counter,
  Histogram,
  Registry,
} from 'prom-client';

const DEFAULT_METRICS_HOST = '0.0.0.0';
const DEFAULT_METRICS_PORT = 9464;

export interface MetricsServerAddress {
  host: string;
  port: number;
}

export class ServiceMetrics {
  readonly registry = new Registry();

  private readonly logger = new Logger(ServiceMetrics.name);
  private readonly requests: Counter<'method' | 'route' | 'status_code'>;
  private readonly requestDuration: Histogram<
    'method' | 'route' | 'status_code'
  >;
  private server?: Server;

  constructor(readonly serviceName: string) {
    this.registry.setDefaultLabels({ service: serviceName });
    collectDefaultMetrics({
      prefix: 'beping_',
      register: this.registry,
    });

    this.requests = new Counter({
      name: 'beping_http_requests_total',
      help: 'Total number of completed HTTP requests.',
      labelNames: ['method', 'route', 'status_code'],
      registers: [this.registry],
    });
    this.requestDuration = new Histogram({
      name: 'beping_http_request_duration_seconds',
      help: 'HTTP request duration in seconds.',
      labelNames: ['method', 'route', 'status_code'],
      buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
      registers: [this.registry],
    });
  }

  instrumentHttp(app: Pick<INestApplication, 'use'>): void {
    app.use((request: Request, response: Response, next: NextFunction) => {
      const stopTimer = this.requestDuration.startTimer();

      response.once('finish', () => {
        const labels = {
          method: request.method,
          route: this.getRouteLabel(request),
          status_code: String(response.statusCode),
        };

        this.requests.inc(labels);
        stopTimer(labels);
      });

      next();
    });
  }

  async listen(
    port = this.getConfiguredPort(),
    host = process.env.METRICS_HOST ?? DEFAULT_METRICS_HOST,
  ): Promise<MetricsServerAddress> {
    if (this.server) {
      throw new Error('Metrics server is already listening.');
    }

    const server = createServer(async (request, response) => {
      if (request.method === 'GET' && request.url === '/-/healthy') {
        response.writeHead(200, {
          'content-type': 'text/plain; charset=utf-8',
        });
        response.end('OK\n');
        return;
      }

      if (request.method !== 'GET' || request.url !== '/metrics') {
        response.writeHead(404, {
          'content-type': 'text/plain; charset=utf-8',
        });
        response.end('Not found\n');
        return;
      }

      try {
        response.writeHead(200, { 'content-type': this.registry.contentType });
        response.end(await this.registry.metrics());
      } catch (error) {
        this.logger.error('Unable to render Prometheus metrics.', error);
        response.writeHead(500, {
          'content-type': 'text/plain; charset=utf-8',
        });
        response.end('Metrics unavailable\n');
      }
    });

    this.server = server;

    try {
      await new Promise<void>((resolve, reject) => {
        server.once('error', reject);
        server.listen(port, host, () => {
          server.off('error', reject);
          resolve();
        });
      });
    } catch (error) {
      this.server = undefined;
      throw error;
    }

    const address = server.address() as AddressInfo;
    this.logger.log(
      `Prometheus metrics for ${this.serviceName} listening on ${host}:${address.port}`,
    );
    return { host, port: address.port };
  }

  async close(): Promise<void> {
    const server = this.server;
    if (!server) return;

    this.server = undefined;
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }

  private getConfiguredPort(): number {
    const port = Number(process.env.METRICS_PORT ?? DEFAULT_METRICS_PORT);
    if (!Number.isInteger(port) || port < 1 || port > 65_535) {
      throw new Error('METRICS_PORT must be an integer between 1 and 65535.');
    }
    return port;
  }

  private getRouteLabel(request: Request): string {
    const route = request.route as { path?: unknown } | undefined;
    if (typeof route?.path !== 'string') return 'unmatched';

    return `${request.baseUrl ?? ''}${route.path}` || '/';
  }
}
