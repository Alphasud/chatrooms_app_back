import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const adress = '0.0.0.0';
  const port = process.env.PORT ?? 3000;
  await app.listen(port, adress, () => {
    console.log(`🚀 Server running at http://${adress}:${port}`);
  });
}
bootstrap().catch((err) => console.error(err));
