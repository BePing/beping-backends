import { createHash } from 'node:crypto';
import { Readable } from 'node:stream';
import {
  computeLinesHash,
  inspectResultLines,
  LinesHashAccumulator,
  readNonEmptyLines,
} from './result-lines.utils';

describe('result line utilities', () => {
  describe('readNonEmptyLines', () => {
    it('preserves CRLF contents and ignores blank lines', async () => {
      const chunks = Readable.from([
        Buffer.from('header\r\n\nfir'),
        Buffer.from('st\n  \nsecond\r\n'),
      ]);

      const lines: string[] = [];
      for await (const line of readNonEmptyLines(chunks)) {
        lines.push(line);
      }

      expect(lines).toEqual(['header\r', 'first', 'second\r']);
    });

    it('decodes Unicode characters split across byte chunks', async () => {
      const input = Buffer.from('header\nrésultat\n');
      const accentIndex = input.indexOf(Buffer.from('é'));
      const chunks = Readable.from([
        input.subarray(0, accentIndex + 1),
        input.subarray(accentIndex + 1),
      ]);

      const lines: string[] = [];
      for await (const line of readNonEmptyLines(chunks)) {
        lines.push(line);
      }

      expect(lines).toEqual(['header', 'résultat']);
    });
  });

  describe('inspectResultLines', () => {
    it('streams metadata while excluding the header and blank lines', async () => {
      const source = Readable.from([
        Buffer.from('2026-08-16\nresult-1'),
        Buffer.from('\n\nresult-2\nresult-3'),
      ]);

      await expect(inspectResultLines(source)).resolves.toEqual({
        header: '2026-08-16',
        dataLineCount: 3,
        contentHash: createHash('sha256')
          .update('result-1result-2result-3')
          .digest('hex'),
      });
    });
  });

  describe('computeLinesHash', () => {
    it('keeps the historical concatenated-line hash format', () => {
      const lines = Array.from(
        { length: 20_000 },
        (_, index) => `résultat-${index};${index % 17}`,
      );
      const historicalHash = createHash('sha256')
        .update(lines.join(''))
        .digest('hex');

      expect(computeLinesHash(lines)).toBe(historicalHash);
    });

    it('supports streaming updates without changing the digest', () => {
      const accumulator = new LinesHashAccumulator();
      accumulator.update('one');
      accumulator.update('two');
      const expectedHash = createHash('sha256').update('onetwo').digest('hex');

      expect(accumulator.digest()).toBe(expectedHash);
    });
  });
});
