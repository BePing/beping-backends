import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';
import { OperationalError } from 'bluebird';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SentryExceptionCaptured } from '@sentry/nestjs';

export class TabtException {
  @ApiPropertyOptional()
  errorCode: number;
  @ApiProperty()
  message: string;
  @ApiProperty()
  statusCode: number;
}

@Catch(OperationalError)
export class TabtExceptionsFilter implements ExceptionFilter {
  @SentryExceptionCaptured()
  catch(exception: OperationalError, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const [errorCode, errorMessage] = exception.message.split(': ');
    response
      .status(400)
      .json({
        statusCode: 400,
        errorCode: parseInt(errorCode),
        message: errorMessage,
      })
      .end();
  }
}
