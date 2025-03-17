import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayDisconnect,
  OnGatewayConnection,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { ChatService } from './chat.service';
import { generateRandomColors } from 'src/utils';
import { UserService } from '../user/user.service';
import { Logger } from '@nestjs/common';

@WebSocketGateway({ cors: true })
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(ChatGateway.name);
  @WebSocketServer() server: Server;

  constructor(
    private readonly chatService: ChatService,
    private readonly userService: UserService,
  ) {}

  // Handle new connections
  async handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
    client.emit('connected', true);
    await this.userService.createUser(client.id);
  }

  @SubscribeMessage('updateUsernameInUsersList') // When a user updates their username
  async handleUpdateUsernameInUserList(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    { newUsername }: { newUsername: string },
  ) {
    if (!newUsername) {
      return { error: 'New Username is required' };
    }
    const user = await this.userService.updateUserName(client.id, newUsername);

    if (user) {
      this.server.emit(
        'usersList',
        Array.from(await this.userService.getUsersList()),
      );
    }
  }

  @SubscribeMessage('createChatroom')
  async handleCreateChatroom(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    { chatroomId, username }: { chatroomId: string; username: string },
  ) {
    if (!chatroomId || !username) {
      return { error: 'Chatroom ID and Username are required' };
    }

    try {
      // Create the chatroom (this is handled in the service method)
      const newChatroom = await this.chatService.createChatroom(
        chatroomId,
        username,
      );

      // Join the user to the chatroom's socket room
      await client.join(chatroomId);

      // Send previous messages (there are none initially, so you can send an empty array or default message)
      client.emit('previousMessages', []);

      // Create the system message for the chatroom creation
      const systemMessage = {
        username: 'System',
        text: `${username} has created the chatroom.`,
        createdAt: new Date(),
        chatroomId,
      };

      // Save the system message in the database (optional, if you want to store chatroom creation in the database)
      const savedMessage = await this.chatService.saveMessage(
        systemMessage.chatroomId,
        systemMessage.username,
        systemMessage.text,
        systemMessage.createdAt,
      );

      // Emit the system message to all users in the chatroom
      this.server.to(chatroomId).emit('receiveMessage', savedMessage);

      // Update the user's chatroom
      await this.userService.updateUserChatroomId(username, chatroomId);
      this.server.emit(
        'usersList',
        Array.from(await this.userService.getUsersList()),
      );

      return { success: true, chatroom: newChatroom };
    } catch (error) {
      return { error: (error as Error).message };
    }
  }

  @SubscribeMessage('joinChatroom')
  async handleJoinChatroom(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    { chatroomId, username }: { chatroomId: string; username: string },
  ) {
    if (!chatroomId || !username) {
      return { error: 'Chatroom ID and Username are required' };
    }

    try {
      const chatroom = await this.chatService.joinChatroom(
        chatroomId,
        username,
      );

      // Update the user's chatroom

      await this.userService.updateUserChatroomId(username, chatroomId);
      this.server.emit(
        'usersList',
        Array.from(await this.userService.getUsersList()),
      );

      // Join the user to the chatroom's socket room
      await client.join(chatroomId);

      // Send the previous messages to the joining user
      const previousMessages =
        await this.chatService.getMessagesByChatroom(chatroomId);
      client.emit('previousMessages', previousMessages); // Emit the previous messages to the client

      // Create the system message for the user joining
      const systemMessage = {
        username: 'System',
        text: `${username} has joined the chatroom.`,
        createdAt: new Date(),
        chatroomId: chatroomId,
      };

      // Save the system message in the database
      const savedMessage = await this.chatService.saveMessage(
        systemMessage.chatroomId,
        systemMessage.username,
        systemMessage.text,
        systemMessage.createdAt,
      );

      // Emit the saved system message to all users in the chatroom
      this.server.to(chatroomId).emit('receiveMessage', savedMessage);

      return { success: true, chatroom };
    } catch (error) {
      return { error: (error as Error).message };
    }
  }

  @SubscribeMessage('leaveChatroom')
  async handleLeaveChatroom(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    { chatroomId, username }: { chatroomId: string; username: string },
  ) {
    try {
      const result = await this.chatService.leaveChatroom(chatroomId, username);

      // Notify other users that someone left
      this.server
        .to(chatroomId)
        .emit('userLeft', `${username} has left the chatroom.`);

      // Create the system message for the user leaving
      const systemMessage = {
        username: 'System',
        text: `${username} has left the chatroom.`,
        createdAt: new Date(),
        chatroomId: chatroomId,
      };

      // Save the system message in the database
      const savedMessage = await this.chatService.saveMessage(
        systemMessage.chatroomId,
        systemMessage.username,
        systemMessage.text,
        systemMessage.createdAt,
      );

      // Emit the saved system message to all users in the chatroom
      this.server.to(chatroomId).emit('receiveMessage', savedMessage);

      // Update the user's chatroom
      await this.userService.updateUserChatroomId(username, '');

      this.server.emit(
        'usersList',
        Array.from(await this.userService.getUsersList()),
      );

      if (result.deleted) {
        // Notify that the chatroom was deleted
        this.server.to(chatroomId).emit('chatroomDeleted', { chatroomId });
      }

      await client.leave(chatroomId);
      this.server.emit('chatroomsList', await this.chatService.getChatrooms());
      return result;
    } catch (error) {
      return { error: (error as Error).message };
    }
  }

  @SubscribeMessage('sendMessage')
  async handleSendMessage(
    @MessageBody()
    {
      chatroomId,
      username,
      text,
      createdAt,
    }: {
      chatroomId: string;
      username: string;
      text: string;
      createdAt: Date;
    },
  ) {
    if (!chatroomId || !username || !text || !createdAt) {
      return {
        error: 'Chatroom ID, Username, Text, and CreatedAt are required',
      };
    }
    const user = await this.userService.getUserByUsername(username);
    const bubbleColor = user ? user.bubbleColor : generateRandomColors(1)[0];

    const message = await this.chatService.saveMessage(
      chatroomId,
      username,
      text,
      createdAt,
      bubbleColor,
    );
    this.server.emit(
      'chatroomsList',
      await this.chatService.updateChatroomLastActive(chatroomId),
    );
    this.server.to(chatroomId).emit('receiveMessage', message);
  }

  // When a user requests the list of users in the chatroom
  async handleGetChatroomUserList(
    @ConnectedSocket() client: Socket,
    @MessageBody() chatroomId: string,
  ) {
    const usersList = await this.userService.getUsersByChatroomId(chatroomId);
    client.emit('chatroomUsersList', usersList);
  }

  // When a user requests the list of total users on the server
  async handleGetTotalUsersList(@ConnectedSocket() client: Socket) {
    const usersList = await this.userService.getUsersList();
    client.emit('usersList', usersList);
  }

  // When a user requests the list of existing chatrooms
  @SubscribeMessage('getChatroomsList')
  async handleGetChatroomsList(@ConnectedSocket() client: Socket) {
    const chatroomList = await this.chatService.getChatrooms();
    client.emit('chatroomsList', chatroomList);
  }

  // Used when a user requests to join a new chatroom via url
  @SubscribeMessage('doesChatroomExist')
  async handleDoesChatroomExist(
    @ConnectedSocket() client: Socket,
    @MessageBody() chatroomId: string,
  ) {
    const chatroomExists = await this.chatService.doesChatroomExist(chatroomId);
    client.emit('chatroomExists', chatroomExists);
  }

  async handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);

    const user = await this.userService.getUserByClientId(client.id);

    if (user) {
      const { username, chatroomId } = user;

      if (chatroomId !== '' && chatroomId !== 'lobby') {
        const systemMessage = {
          username: 'System',
          text: `${username} has left the chatroom.`,
          createdAt: new Date(),
          chatroomId,
        };

        this.server
          .to(chatroomId)
          .emit('userLeft', `${username} has left the chatroom.`);

        // Save the system message in the database
        await this.chatService
          .saveMessage(
            systemMessage.chatroomId,
            systemMessage.username,
            systemMessage.text,
            systemMessage.createdAt,
          )
          .then((savedMessage) => {
            this.server.to(chatroomId).emit('receiveMessage', savedMessage);
          });
        await this.chatService.leaveChatroom(chatroomId, username);
      }

      await this.userService.deleteUser(client.id, username);
      this.server.emit(
        'usersList',
        Array.from(await this.userService.getUsersList()),
      );
    }
  }
  onModuleInit() {
    setInterval(
      () => {
        void (async () => {
          try {
            const updatedChatrooms =
              await this.chatService.removeInactiveChatrooms();
            if (updatedChatrooms) {
              this.server.emit('chatroomsList', updatedChatrooms);
            }
          } catch (error) {
            console.error('Error updating chatrooms:', error);
          }
        })();
      },
      5 * 60 * 1000,
    ); // Runs every 5 minutes
  }
}
