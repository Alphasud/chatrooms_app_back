import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
@Schema()
export class User extends Document {
  @Prop({ required: true })
  clientId: string;
  @Prop({ required: true })
  username: string;
  @Prop({ required: true, default: 'lobby' })
  chatroomId: string;
  @Prop({ required: true, default: Date.now })
  lastActiveAt: Date;
  @Prop({ required: false })
  colorScheme?: string[];
  @Prop({ required: false })
  bubbleColor?: string;
  @Prop({ required: false })
  avatar?: string;
}

export const UserSchema = SchemaFactory.createForClass(User);
