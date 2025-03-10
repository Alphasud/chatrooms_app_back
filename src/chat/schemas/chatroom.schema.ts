import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema()
export class Chatroom extends Document {
  @Prop({ required: true, unique: true })
  chatroomId: string;

  @Prop({ type: [String], default: [] })
  users: string[];

  @Prop({ type: Date, default: Date.now })
  lastActiveAt: Date;
}

export const ChatroomSchema = SchemaFactory.createForClass(Chatroom);
