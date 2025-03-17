import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ChatService } from './chat/chat.service';
import { ChatGateway } from './chat/chat.gateway';
import { Chatroom, ChatroomSchema } from './schemas/chatroom.schema';
import { User, UserSchema } from './schemas/user.schema';
import { Message, MessageSchema } from './schemas/message.schema';
import { UserService } from './user/user.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Chatroom.name, schema: ChatroomSchema },
      { name: User.name, schema: UserSchema },
      { name: Message.name, schema: MessageSchema },
    ]),
  ],
  providers: [ChatService, ChatGateway, UserService],
  exports: [ChatService, UserService],
})
export class ChatModule {}
