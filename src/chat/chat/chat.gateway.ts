import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { ChatService } from './chat.service';

@WebSocketGateway({ cors: { origin: '*' }, transport: ['websocket'] }) // Enable CORS for frontend access
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(private readonly chatService: ChatService) {}

  // Handle new connections
  handleConnection(client: Socket) {
    console.log(`🚀 Client connected: ${client.id}`);
    client.emit('message', 'Welcome to WebSocket!');
  }

  // Handle disconnections
  handleDisconnect(client: Socket) {
    console.log(`❌ Client disconnected: ${client.id}`);
  }

  // Handle incoming messages
  @SubscribeMessage('sendMessage')
  async handleMessage(
    @MessageBody() { username, message }: { username: string; message: string },
  ): Promise<void> {
    const savedMessage = await this.chatService.saveMessage(username, message);
    this.server.emit('receiveMessage', savedMessage); // Broadcast message to all clients
  }

  // Fetch message history on connection
  @SubscribeMessage('getMessages')
  async handleGetMessages(@ConnectedSocket() client: Socket): Promise<void> {
    const messages = await this.chatService.getMessages();
    client.emit('messageHistory', messages);
  }
}
