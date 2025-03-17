import {
  Injectable,
  Logger,
  NotFoundException,
  OnApplicationShutdown,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User } from '../schemas/user.schema';
import { generateRandomColors } from 'src/utils';

@Injectable()
export class UserService implements OnApplicationShutdown {
  private readonly logger = new Logger(UserService.name);

  constructor(@InjectModel(User.name) private userModel: Model<User>) {}

  async onApplicationShutdown() {
    await this.purgeUsers();
  }

  async purgeUsers() {
    try {
      await this.userModel.deleteMany({});
      this.logger.log('All users have been purged from the database.');
    } catch (error) {
      this.logger.error('Error purging users:', error);
    }
  }

  async createUser(username: string): Promise<User> {
    this.logger.log(`Creating user ${username}`);
    const newUser = new this.userModel({
      clientId: username,
      username,
      chatroomId: 'lobby',
      lastActiveAt: new Date(),
      colorScheme: generateRandomColors(10),
      bubbleColor: generateRandomColors(1)[0],
    });

    return newUser.save();
  }

  async deleteUser(clientId: string, username: string): Promise<void> {
    const user = await this.userModel.findOneAndDelete({ clientId });
    if (!user) {
      this.logger.log(`Client ID ${clientId} not found in the users list`);
    }
    this.logger.log(
      `Client Id ${clientId}, knwown as ${username} deleted from the users list`,
    );
  }

  async getUsersList(): Promise<User[]> {
    return this.userModel.find();
  }

  async updateUserName(clientId: string, newUsername: string): Promise<string> {
    const user = await this.userModel.findOneAndUpdate(
      { clientId },
      { username: newUsername },
      { new: true },
    );
    if (!user) {
      throw new NotFoundException(`User ${clientId} not found`);
    }
    this.logger.log(`User ${clientId} set his username to ${newUsername}`);
    return user.username;
  }

  async updateAvatar(clientId: string, avatarUrl: string): Promise<User> {
    const user = await this.userModel.findOneAndUpdate(
      { clientId },
      { avatar: avatarUrl },
      { new: true },
    );
    if (!user) {
      throw new Error('User not found');
    }
    return user;
  }

  async deleteAvatar(clientId: string): Promise<User> {
    const user = await this.userModel.findOne({ clientId });
    if (!user) {
      throw new Error('User not found');
    }
    user.avatar = undefined;
    return user.save();
  }

  async findUserByClientId(clientId: string): Promise<User> {
    const user = await this.userModel.findOne({ clientId });
    if (!user) {
      throw new NotFoundException(`User with clientId ${clientId} not found`);
    }
    return user;
  }

  async updateUsername(clientId: string, newUsername: string): Promise<string> {
    const user = await this.userModel.findOneAndUpdate(
      { clientId },
      { username: newUsername },
      { new: true },
    );
    if (!user) {
      throw new NotFoundException(`User with clientId ${clientId} not found`);
    }
    return user.username;
  }

  async updateUserChatroomId(
    username: string,
    newChatroomId: string,
  ): Promise<void> {
    const user = await this.userModel.findOneAndUpdate(
      { username },
      { chatroomId: newChatroomId },
      { new: true },
    );
    if (!user) {
      throw new NotFoundException(`User ${username} not found`);
    }
  }

  async getUserByUsername(username: string): Promise<User> {
    const user = await this.userModel.findOne({ username });
    if (!user) {
      throw new NotFoundException(`User ${username} not found`);
    }
    return user;
  }

  async getUserByClientId(clientId: string): Promise<User> {
    const user = await this.userModel.findOne({ clientId });
    if (!user) {
      throw new NotFoundException(`User ${clientId} not found`);
    }
    return user;
  }

  async getUsersByChatroomId(chatroomId: string): Promise<User[]> {
    return this.userModel.find({ chatroomId });
  }
}
