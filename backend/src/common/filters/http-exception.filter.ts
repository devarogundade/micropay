import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import { fail } from '../dto/api-response.dto';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'internal_error';
    let message = 'Internal server error';
    let details: unknown;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === 'string') {
        message = body;
      } else if (body && typeof body === 'object') {
        const obj = body as Record<string, unknown>;
        message = String(obj.message ?? exception.message);
        code = String(obj.error ?? obj.code ?? code);
        details = obj.details ?? obj.message;
        if (Array.isArray(obj.message)) {
          message = 'Validation failed';
          details = obj.message;
          code = 'validation_error';
        }
      }
      if (status === HttpStatus.NOT_FOUND) code = 'not_found';
      if (status === HttpStatus.UNAUTHORIZED) code = 'unauthorized';
      if (status === HttpStatus.FORBIDDEN) code = 'forbidden';
      if (status === HttpStatus.BAD_REQUEST && code === 'internal_error') {
        code = 'bad_request';
      }
      if (status === HttpStatus.PAYMENT_REQUIRED) code = 'payment_required';
      if (status === 402) code = 'payment_required';
    } else if (exception instanceof Error) {
      message = exception.message;
      this.logger.error(exception.message, exception.stack);
    } else {
      this.logger.error('Unknown exception', String(exception));
    }

    response.status(status).json(fail(code, message, details));
  }
}
