import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ChatModule } from './chat/chat.module';
import { MulterModule } from '@nestjs/platform-express';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { UserController } from './chat/user/user.controller';

@Module({
  imports: [
    MongooseModule.forRoot('mongodb://localhost:27017/chat-app'),
    ChatModule,
    MulterModule.register({
      dest: './uploads',
    }),
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'uploads'),
      serveRoot: '/uploads',
    }),
  ],
  controllers: [UserController],
  providers: [],
})
export class AppModule {}
