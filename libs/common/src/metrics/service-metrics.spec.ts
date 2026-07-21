import type { INestApplication } from '@nestjs/common';
import { EventEmitter } from 'node:events';
import { get } from 'node:http';
import type { NextFunction, Request, Response } from 'express';
import { ServiceMetrics } from './service-metrics';

interface HttpResult {
  body: string;
  contentType?: string;
  statusCode?: number;
}

function request(port: number, path: string): Promise<HttpResult> {
  return new Promise((resolve, reject) => {
    get({ host: '127.0.0.1', port, path }, (response) => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => (body += chunk));
      response.on('end', () =>
        resolve({
          body,
          contentType: response.headers['content-type'],
          statusCode: response.statusCode,
        }),
      );
    }).on('error', reject);
  });
}

describe(ServiceMetrics.name, () => {
  it('collects default process metrics with a stable service label', async () => {
    const metrics = new ServiceMetrics('test-service');

    const output = await metrics.registry.metrics();

    expect(output).toContain('beping_process_cpu_user_seconds_total');
    expect(output).toContain('service="test-service"');
  });

  it('records low-cardinality HTTP request metrics', async () => {
    let middleware:
      | ((request: Request, response: Response, next: NextFunction) => void)
      | undefined;
    const app = {
      use: jest.fn((handler) => {
        middleware = handler;
      }),
    } as unknown as Pick<INestApplication, 'use'>;
    const metrics = new ServiceMetrics('test-api');
    const response = Object.assign(new EventEmitter(), { statusCode: 201 });
    const next = jest.fn();

    metrics.instrumentHttp(app);
    middleware?.(
      {
        baseUrl: '/v1',
        method: 'POST',
        route: { path: '/members/:id' },
      } as Request,
      response as Response,
      next,
    );
    response.emit('finish');

    const output = await metrics.registry.metrics();
    expect(next).toHaveBeenCalledTimes(1);
    expect(output).toMatch(
      /beping_http_requests_total\{[^}]*method="POST"[^}]*route="\/v1\/members\/:id"[^}]*status_code="201"[^}]*\} 1/,
    );
  });

  it('uses an unmatched route instead of the raw URL', async () => {
    let middleware:
      | ((request: Request, response: Response, next: NextFunction) => void)
      | undefined;
    const app = {
      use: (handler: typeof middleware) => {
        middleware = handler;
      },
    } as unknown as Pick<INestApplication, 'use'>;
    const metrics = new ServiceMetrics('test-api');
    const response = Object.assign(new EventEmitter(), { statusCode: 404 });

    metrics.instrumentHttp(app);
    middleware?.(
      { method: 'GET', originalUrl: '/unknown/123' } as Request,
      response as Response,
      jest.fn(),
    );
    response.emit('finish');

    expect(await metrics.registry.metrics()).toContain('route="unmatched"');
  });

  it('serves health and Prometheus endpoints on the internal listener', async () => {
    const metrics = new ServiceMetrics('test-service');
    const address = await metrics.listen(0, '127.0.0.1');

    try {
      const health = await request(address.port, '/-/healthy');
      const exposition = await request(address.port, '/metrics');
      const missing = await request(address.port, '/missing');

      expect(health).toMatchObject({ body: 'OK\n', statusCode: 200 });
      expect(exposition.statusCode).toBe(200);
      expect(exposition.contentType).toContain('text/plain');
      expect(exposition.body).toContain('service="test-service"');
      expect(missing).toMatchObject({ body: 'Not found\n', statusCode: 404 });
      await expect(metrics.listen(0, '127.0.0.1')).rejects.toThrow(
        'already listening',
      );
    } finally {
      await metrics.close();
    }

    await expect(metrics.close()).resolves.toBeUndefined();
  });

  it('rejects an invalid configured metrics port', async () => {
    const previousPort = process.env.METRICS_PORT;
    process.env.METRICS_PORT = 'invalid';
    const metrics = new ServiceMetrics('test-service');

    try {
      await expect(metrics.listen()).rejects.toThrow('METRICS_PORT');
    } finally {
      if (previousPort === undefined) delete process.env.METRICS_PORT;
      else process.env.METRICS_PORT = previousPort;
    }
  });
});
