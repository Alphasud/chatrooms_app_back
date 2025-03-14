import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema()
export class Message extends Document {
  @Prop({ required: true })
  username: string;
  @Prop({ required: true })
  text: string;
  @Prop({ required: true })
  createdAt: Date;
  @Prop({ required: true })
  chatroomId: string;
  @Prop({ required: false })
  bubbleColor: string;
}

export const MessageSchema = SchemaFactory.createForClass(Message);
