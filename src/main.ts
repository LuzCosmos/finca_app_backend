import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ValidationPipe, Logger, LogLevel } from '@nestjs/common';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { ENV } from './config/env';

async function bootstrap() {
  // Configurar niveles de log según el entorno
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const configService = app.get(ConfigService);
  const logLevels: LogLevel[] = configService.get<string>('ENVIRONMENT') === 'production'
    ? ['error', 'warn', 'log']
    : ['error', 'warn', 'log', 'debug', 'verbose'];

  Logger.overrideLogger(logLevels);

  // Configurar el logger global con timestamp
  app.useLogger(new Logger('FincaApp'));

  // Configuración de validación global
  app.useGlobalPipes(new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
  }));

  // Configuración de prefijo global
  app.setGlobalPrefix('api/v1');

  // Configuración de Swagger
  const swaggerCfg = new DocumentBuilder()
    .setTitle('API Finca')
    .setDescription('API para la aplicación de gestión de finca')
    .setVersion('0.0.1')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: 'Ingresa tu token JWT',
        in: 'header',
      },
      'access-token',
    )
    .build();

  const document = SwaggerModule.createDocument(app, swaggerCfg);
  SwaggerModule.setup('api', app, document);

  // Configuración de CORS
  app.enableCors();
  /*app.enableCors({
    origin: [
      'http://localhost:3000',
      'http://localhost:8080',
      'http://localhost:4200',
      'http://localhost:5000',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:8080',
      'http://127.0.0.1:4200',
      'http://127.0.0.1:5000',
      'https://localhost:3000',
      'https://localhost:8080',
      'https://localhost:4200',
      'https://localhost:5000',
      'https://127.0.0.1:3000',
      'https://127.0.0.1:8080',
      'https://127.0.0.1:4200',
      'https://127.0.0.1:5000',
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Origin', 'X-Requested-With'],
  });*/

  const port = configService.get<number>('APP_PORT') ?? 3000;
  await app.listen(port);
  console.log(`🚀 API escuchando en http://localhost:${port} (env=${configService.get('ENVIRONMENT')})`);
}
bootstrap();
