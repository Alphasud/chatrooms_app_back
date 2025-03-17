import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableShutdownHooks();
  app.enableCors({
    origin: 'http://192.168.1.237:3002',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: false,
  });
  const port = process.env.PORT ?? 3001;
  await app.listen(port, '0.0.0.0', () => {
    Logger.log(`Server is running on http://0.0.0.0:${port}`);
  });
}
bootstrap().catch((err) => console.error(err));
