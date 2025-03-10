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

@WebSocketGateway({ cors: true })
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;

  constructor(private readonly chatService: ChatService) {}

  private activeUsersOnServer = new Map<
    string,
    { username: string; chatroomId: string }
  >();

  // Handle new connections
  handleConnection(client: Socket) {
    console.log(`🚀 Client connected: ${client.id}`);
    client.emit('welcome', 'Welcome to Chat App!');
    this.activeUsersOnServer.set(client.id, {
      username: client.id,
      chatroomId: '',
    });
  }

  @SubscribeMessage('updateUsernameInUsersList') // When a user updates their username
  handleUpdateUsernameInUserList(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    { newUsername }: { newUsername: string },
  ) {
    const user = this.activeUsersOnServer.get(client.id);
    console.log('Active users:', this.activeUsersOnServer);
    if (user) {
      console.log('Updating username:', user.username, 'to', newUsername);
      user.username = newUsername;
      this.server.emit(
        'usersList',
        Array.from(this.activeUsersOnServer.values()),
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

      // Store the user in the active users map
      this.activeUsersOnServer.set(client.id, { username, chatroomId });

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

      // Store the user in the active users map
      this.activeUsersOnServer.set(client.id, { username, chatroomId });

      // Update the user list for all users
      this.server.emit(
        'usersList',
        Array.from(this.activeUsersOnServer.values()),
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

      // update the user from the active users map
      this.activeUsersOnServer.set(client.id, { username, chatroomId: '' });

      // Update the user list for all users
      this.server.emit(
        'usersList',
        Array.from(this.activeUsersOnServer.values()),
      );

      if (result.deleted) {
        // Notify that the chatroom was deleted
        this.server.to(chatroomId).emit('chatroomDeleted', { chatroomId });
      }

      await client.leave(chatroomId);
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
    const message = await this.chatService.saveMessage(
      chatroomId,
      username,
      text,
      createdAt,
    );
    this.server.to(chatroomId).emit('receiveMessage', message);
  }

  // When a user requests the list of users in the chatroom
  handleGetChatroomUserList(
    @ConnectedSocket() client: Socket,
    @MessageBody() chatroomId: string,
  ) {
    const userList = Array.from(this.activeUsersOnServer.values()).filter(
      (user) => user.chatroomId === chatroomId,
    );
    client.emit('chatroomUsersList', userList);
  }

  // When a user requests the list of total users on the server
  handleGetTotalUsersList(@ConnectedSocket() client: Socket) {
    const usersList = Array.from(this.activeUsersOnServer.values());
    client.emit('usersList', usersList);
  }

  // When a user requests the list of existing chatrooms
  handleGetChatroomList(@ConnectedSocket() client: Socket) {
    const chatroomList = this.chatService.getChatrooms();
    client.emit('chatroomList', chatroomList);
  }

  async handleDisconnect(client: Socket) {
    console.log(`Client disconnected: ${client.id}`);

    const user = this.activeUsersOnServer.get(client.id);

    if (user) {
      const { username, chatroomId } = user;

      // check if user is in a chatroom
      if (chatroomId) {
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

      this.activeUsersOnServer.delete(client.id);

      this.server.emit(
        'usersList',
        Array.from(this.activeUsersOnServer.values()),
      );
    }
  }
}
