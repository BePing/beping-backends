import { HttpException } from '@nestjs/common';
import { mapTabtFaultCodeToHttpStatus } from './tabt-fault-mapping';

export class TabtException extends HttpException {
  constructor(faultCodeString: string, faultString: string) {
    super(faultString, mapTabtFaultCodeToHttpStatus(Number(faultCodeString)));
  }
}
