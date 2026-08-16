import { createHash } from 'node:crypto';
import { StringDecoder } from 'node:string_decoder';

const HASH_BATCH_LINE_COUNT = 8192;

export class LinesHashAccumulator {
  private readonly hash = createHash('sha256');
  private readonly pendingLines: string[] = [];
  private finished = false;

  update(line: string): void {
    if (this.finished) {
      throw new Error('Cannot update a finalized lines hash');
    }

    this.pendingLines.push(line);
    if (this.pendingLines.length >= HASH_BATCH_LINE_COUNT) {
      this.flush();
    }
  }

  digest(): string {
    if (this.finished) {
      throw new Error('Cannot finalize a lines hash twice');
    }

    this.flush();
    this.finished = true;
    return this.hash.digest('hex');
  }

  private flush(): void {
    if (this.pendingLines.length === 0) {
      return;
    }

    this.hash.update(this.pendingLines.join(''));
    this.pendingLines.length = 0;
  }
}

/**
 * Yield lines without retaining the complete export. Newlines are removed,
 * while a preceding carriage return is preserved to match `split('\n')` and
 * therefore keep historical hashes stable for CRLF files.
 */
export async function* readNonEmptyLines(
  source: AsyncIterable<Buffer | string>,
): AsyncGenerator<string> {
  const decoder = new StringDecoder('utf8');
  let buffered = '';

  for await (const chunk of source) {
    buffered += decoder.write(
      typeof chunk === 'string' ? Buffer.from(chunk) : chunk,
    );

    let newlineIndex = buffered.indexOf('\n');
    while (newlineIndex !== -1) {
      const line = buffered.slice(0, newlineIndex);
      buffered = buffered.slice(newlineIndex + 1);

      if (line.trim().length > 0) {
        yield line;
      }

      newlineIndex = buffered.indexOf('\n');
    }
  }

  buffered += decoder.end();
  if (buffered.trim().length > 0) {
    yield buffered;
  }
}

export interface ResultLinesMetadata {
  header: string | undefined;
  dataLineCount: number;
  contentHash: string;
}

export async function inspectResultLines(
  source: AsyncIterable<Buffer | string>,
): Promise<ResultLinesMetadata> {
  const hash = new LinesHashAccumulator();
  let header: string | undefined;
  let dataLineCount = 0;

  for await (const line of readNonEmptyLines(source)) {
    if (header === undefined) {
      header = line;
      continue;
    }

    hash.update(line);
    dataLineCount++;
  }

  return {
    header,
    dataLineCount,
    contentHash: hash.digest(),
  };
}

/** Preserve the historical concatenated-line hash format for array callers. */
export function computeLinesHash(lines: readonly string[]): string {
  const accumulator = new LinesHashAccumulator();
  for (const line of lines) {
    accumulator.update(line);
  }

  return accumulator.digest();
}
