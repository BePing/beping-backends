import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Swagger DTO describing the error payload returned when a TabT SOAP fault
 * is surfaced to the client. Only used for API documentation.
 */
export class TabtExceptionResponse {
  @ApiPropertyOptional()
  errorCode: number;
  @ApiProperty()
  message: string;
  @ApiProperty()
  statusCode: number;
}
