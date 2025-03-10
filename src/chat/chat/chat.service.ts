import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Chatroom } from '../schemas/chatroom.schema';
import { Message } from '../schemas/message.schema';
import { User } from '../schemas/user.schema';

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    @InjectModel(Chatroom.name) private chatroomModel: Model<Chatroom>,
    @InjectModel(User.name) private userModel: Model<User>,
    @InjectModel(Message.name) private messageModel: Model<Message>,
  ) {}

  async updateLastActive(username: string) {
    await this.userModel.findOneAndUpdate(
      { username },
      { lastActiveAt: new Date() },
      { new: true },
    );
  }

  /** Check if a chatroom exists */
  async doesChatroomExist(chatroomId: string): Promise<boolean> {
    return (await this.chatroomModel.exists({ name: chatroomId })) !== null;
  }

  /** CREATE A NEW CHATROOM */
  async createChatroom(
    chatroomId: string,
    username: string,
  ): Promise<Chatroom> {
    // Check if the chatroom exists
    const existingChatroom = await this.chatroomModel.findOne({ chatroomId });
    if (existingChatroom) {
      throw new Error('Chatroom already exists');
    }

    // Create a new chatroom with the first user
    const chatroom = new this.chatroomModel({
      chatroomId,
      users: [username], // Add user directly in creation
      lastActiveAt: new Date(),
    });

    await chatroom.save();
    return chatroom;
  }

  /** JOIN A CHATROOM */
  async joinChatroom(chatroomId: string, username: string): Promise<Chatroom> {
    // Find the chatroom (this already serves as an existence check)
    const chatroom = await this.chatroomModel.findOne({ chatroomId });

    if (!chatroom) {
      throw new Error('Chatroom does not exist');
    }

    // Add user only if they are not already in the chatroom
    if (!chatroom.users.includes(username)) {
      chatroom.users.push(username);
      await chatroom.save();
    }

    return chatroom;
  }

  /** LEAVE A CHATROOM */
  async leaveChatroom(
    chatroomId: string,
    username: string,
  ): Promise<{ success: boolean; deleted?: boolean; chatroom?: Chatroom }> {
    const chatroom = await this.chatroomModel.findOne({ chatroomId });

    if (!chatroom) {
      throw new Error('Chatroom does not exist');
    }

    // Remove user only if they are in the chatroom
    chatroom.users = chatroom.users.filter((user) => user !== username);

    await chatroom.save();
    return { success: true, chatroom };
  }

  /** SAVE A MESSAGE */
  async saveMessage(
    chatroomId: string,
    username: string,
    text: string,
    createdAt: Date,
  ): Promise<Message> {
    // Ensure the chatroom exists
    const chatroom = await this.chatroomModel.findOne({ chatroomId }).lean();
    if (!chatroom) {
      throw new NotFoundException('Chatroom not found');
    }

    const newMessage = new this.messageModel({
      username,
      text,
      createdAt,
      chatroomId,
    } as Message);

    // Save the message to the Message collection
    await newMessage.save();

    // Optionally, you can also update the lastActiveAt field on the chatroom
    chatroom.lastActiveAt = new Date();
    await this.chatroomModel.findByIdAndUpdate(chatroom._id, chatroom);

    return newMessage;
  }

  // Method to get all messages for a chatroom
  async getMessagesByChatroom(chatroomId: string): Promise<Message[]> {
    return this.messageModel
      .find({ chatroomId })
      .sort({ createdAt: 1 }) // Ensure messages are sorted by date
      .exec();
  }

  /** GET CHATROOMS LIST */
  async getChatrooms(): Promise<Chatroom[]> {
    return this.chatroomModel.find().exec();
  }

  /** REMOVE AN INACTIVE CHATROOM */
  async removeInactiveChatrooms() {
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);

    const inactiveChatrooms = await this.chatroomModel.find({
      lastActiveAt: { $lt: tenMinutesAgo },
    });

    for (const chatroom of inactiveChatrooms) {
      const users = await this.userModel.find({
        chatroomId: chatroom.chatroomId,
      });

      if (users.length === 0) {
        await this.chatroomModel.findByIdAndDelete(chatroom._id);
        this.logger.log(`Deleted inactive chatroom: ${chatroom.chatroomId}`);
      }
    }
  }

  onModuleInit() {
    setInterval(
      () => {
        this.removeInactiveChatrooms().catch((error) =>
          this.logger.error(error),
        );
      },
      5 * 60 * 1000,
    ); // Runs every 5 minutes
  }
}
