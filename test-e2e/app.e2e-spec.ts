import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../apps/tabt-rest/src/app.module';

// This suite hits the live TABT SOAP API, so it is skipped by default to keep
// the unit/CI runs hermetic and fast. Set E2E_LIVE=true to run it against the
// real backend (e.g. `E2E_LIVE=true pnpm test:e2e`).
const describeLive = process.env.E2E_LIVE === 'true' ? describe : describe.skip;

describeLive('AppController (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app?.close();
  });

  it('/clubs (GET)', () => {
    return request(app.getHttpServer())
      .get('/clubs?season=17')
      .expect(200)
      .expect(function (res) {
        const data = res.body;

        expect(Array.isArray(data)).toBe(true);
        expect(data.length).not.toBeLessThan(10);
      });
  });
});
