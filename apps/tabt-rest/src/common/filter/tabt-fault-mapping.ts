import { HttpStatus } from '@nestjs/common';

/**
 * Maps a TabT SOAP fault code to the corresponding HTTP status code.
 * Used by TabtException, which the SOAP client throws for TabT faults.
 */
export function mapTabtFaultCodeToHttpStatus(faultCode: number): number {
  switch (faultCode) {
    case 5:
    case 8:
      return HttpStatus.INTERNAL_SERVER_ERROR; // 500
    case 27:
    case 47:
    case 53:
    case 54:
    case 55:
      return HttpStatus.FORBIDDEN; // 403
    case 34:
      return HttpStatus.TOO_MANY_REQUESTS; // 429
    case 52:
    default:
      return HttpStatus.BAD_REQUEST; // 400
  }
}
