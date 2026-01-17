import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app/app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // CORS configuration
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:4200';
  app.enableCors({
    origin: [
      frontendUrl,
      'http://localhost:4200',
      'http://localhost:4201',
    ],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: true,
  });

  const globalPrefix = 'api';
  app.setGlobalPrefix(globalPrefix);

  // Use port 3001 to avoid conflict with CRA app on 3000
  const port = process.env.PORT || 3001;
  await app.listen(port);

  Logger.log(
    `🚀 SimiTrack API is running on: http://localhost:${port}/${globalPrefix}`
  );
}

bootstrap();
