import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { WinstonModule } from 'nest-winston';
import { winstonConfig } from './winston-logger.config';
import { ValidationPipe } from '@nestjs/common';
import { ValidationExceptionFilter } from './filters/validation-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: WinstonModule.createLogger(winstonConfig),
  });
  app.setGlobalPrefix('api');

  const config = new DocumentBuilder()
    .setTitle('Trustlypay Swagger')
    .setDescription('Rest API service for trustlypay backend')
    .setVersion('0.0.1')
    // .addBearerAuth()
    .build();
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new ValidationExceptionFilter());
  const document = SwaggerModule.createDocument(app, config);

  SwaggerModule.setup('api/docs', app, document);

  await app.listen(process.env.PORT ?? 3000);
  console.log(`App running on http://localhost:3000/api`);
}
bootstrap();
