import {
  ArgumentsHost,
  BadRequestException,
  Catch,
  ExceptionFilter,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch(BadRequestException)
export class ValidationExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ValidationExceptionFilter.name);

  catch(exception: BadRequestException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status = exception.getStatus();
    const exceptionResponse = exception.getResponse();
    const errorMessage =
      typeof exceptionResponse === 'string'
        ? exceptionResponse
        : (exceptionResponse as any).message;
    this.logger.error(
      'exception error  ' +
        JSON.stringify({
          statusCode: status,
          timestamp: new Date().toISOString(),
          message: errorMessage,
          path: request.url,
          ...request.body,
        }),
    );

    // console.error('validation error:', {
    //   // exceptionResponse,
    //   statusCode: status,
    //   timestamp: new Date().toISOString(),
    //   message: errorMessage,
    //   path: request.url,
    //   ...request.body,
    // });

    response.status(status).json({
      statusCode: status,
      message: errorMessage,
      timestamp: new Date().toISOString(),
    });
  }
}
