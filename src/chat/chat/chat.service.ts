import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Message } from '../schemas/message.schema';

@Injectable()
export class ChatService {
  constructor(
    @InjectModel(Message.name) private messageModel: Model<Message>,
  ) {}

  async saveMessage(username: string, message: string): Promise<Message> {
    const newMessage = new this.messageModel({ username, message }) as Message;
    return newMessage.save();
  }

  async getMessages(): Promise<Message[]> {
    return this.messageModel.find().sort({ createdAt: 1 }).exec();
  }
}
