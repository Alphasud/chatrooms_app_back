import { Schema, model, Document } from 'mongoose';

export interface User extends Document {
  username: string;
  chatroomId: string;
  lastActiveAt: Date;
}

export const UserSchema = new Schema<User>({
  username: { type: String, required: true },
  chatroomId: { type: String, required: true },
  lastActiveAt: { type: Date, default: Date.now },
});

export const User = model<User>('User', UserSchema);
