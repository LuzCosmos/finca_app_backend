import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ValidationPipe, Logger, LogLevel } from '@nestjs/common';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';

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
    .setVersion('0.1.0')
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
  const corsOrigins = configService.get<string>('CORS_ORIGINS')?.split(',').map(origin => origin.trim()) || [
    'http://localhost',
    'http://127.0.0.1'
  ];
  const corsAllowedLocal = configService.get<string>('CORS_ALLOWED_LOCAL')?.trim();

  app.enableCors({
    origin: (origin, callback) => {
      const allowed = !origin || corsOrigins.includes(origin) || (corsAllowedLocal && origin.startsWith(corsAllowedLocal));
      if (allowed) {
        callback(null, true);
      } else {
        callback(new Error(`Origin not allowed by CORS: ${origin}`));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Origin', 'X-Requested-With'],
  });

  const port = configService.get<number>('APP_PORT') ?? 3000;
  //await app.listen(port);
  await app.listen(port, '0.0.0.0');
  Logger.log(
    `API escuchando en http://0.0.0.0:${port} (env=${configService.get('ENVIRONMENT')})`,
    'Bootstrap',
  );
}
bootstrap();
