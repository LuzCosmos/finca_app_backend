import { 
    ArgumentsHost,
    Catch,
    ExceptionFilter,
    HttpException,
    HttpStatus,
    BadRequestException,
    NotFoundException,
    UnauthorizedException,
    ForbiddenException,
    InternalServerErrorException,
    Logger,
    ConflictException
  } from '@nestjs/common';
import { TypeORMError } from 'typeorm';
import { QueryFailedError } from 'typeorm/error/QueryFailedError';
import { ValidationError } from 'class-validator';

@Catch(HttpException,
    TypeORMError,
    BadRequestException,
    NotFoundException,
    UnauthorizedException,
    ForbiddenException,
    InternalServerErrorException,
    QueryFailedError,
    ValidationError,
    ConflictException)
export class AllExceptionFilter implements ExceptionFilter {

    private readonly logger = new Logger(AllExceptionFilter.name);
    
    catch(exception: HttpException | TypeORMError, host: ArgumentsHost) {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse();
        const request = ctx.getRequest();
        let statusCode: number;
        let message: string;
        if (exception instanceof HttpException) {
            this.logger.debug("LOG 1");
            statusCode = exception.getStatus();
            message = exception.message;
        } else if (exception instanceof Error && 
                   exception.message.includes('no result was found')) {
            this.logger.debug("LOG 2");
            statusCode = HttpStatus.BAD_REQUEST;
            message = 'Credenciales inválidas';
        } else if (exception instanceof QueryFailedError) {
            this.logger.debug("LOG 3");
            statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
            message = 'Error en la consulta de base de datos';
          } else if (exception instanceof ValidationError) {
            this.logger.debug("LOG 4");
            statusCode = HttpStatus.BAD_REQUEST;
            message = 'Validación fallida';
          } else if (exception instanceof ConflictException) {
            this.logger.debug("LOG 5");
            statusCode = HttpStatus.CONFLICT;
            message = 'Conflicto';
          } else if (exception instanceof Error) {
            this.logger.debug("LOG 6");
            statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
            message = 'Error interno del servidor';
          } else {
            this.logger.debug("LOG 7"); 
            statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
            message = 'Error desconocido';
          }
          if(!(exception instanceof UnauthorizedException) && !(exception instanceof ForbiddenException)) {
            this.logger.error({type:this.getErrorType(exception),error:exception});
          }
        return response.status(statusCode).json({
            success: false,
            message,
            error: this.getErrorType(exception),
            path: request.url,
            timestamp: new Date().toISOString(),
            //...(process.env.NODE_ENV !== 'production' ? { stack: exception.stack } : {})
        });
    }


    private getErrorType(exception: unknown): string {
        if (exception instanceof HttpException) {
          return `HTTP_${exception.constructor.name}`;
        }
        if (exception instanceof TypeORMError) {
          return 'TYPEORM_ERROR';
        }
        if (exception instanceof QueryFailedError) {
          return 'DATABASE_QUERY_ERROR';
        }
        if (exception instanceof ValidationError) {
          return 'VALIDATION_ERROR';
        }
        return 'UNKNOWN_ERROR';
      }
}