/* eslint-disable @typescript-eslint/no-unused-vars */
import { Test, TestingModule } from '@nestjs/testing';
import { ChatService } from './chat.service';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Chatroom } from '../schemas/chatroom.schema';
import { User } from '../schemas/user.schema';
import { Message } from '../schemas/message.schema';
import { NotFoundException } from '@nestjs/common';

describe('ChatService', () => {
  let service: ChatService;
  let chatroomModel: Model<Chatroom>;
  let userModel: Model<User>;
  let messageModel: Model<Message>;

  const mockChatroomModel = {
    save: jest.fn().mockResolvedValue({
      chatroomId: 'testRoom',
      users: ['testUser'],
      lastActiveAt: expect.any(Date) as Date,
    } as Chatroom),
    findOne: jest.fn().mockResolvedValue(null),
    find: jest.fn(),
    exists: jest.fn(),
    findByIdAndUpdate: jest.fn(),
    findByIdAndDelete: jest.fn(),
    create: jest.fn(),
  };

  const mockUserModel = {
    findOneAndUpdate: jest.fn(),
    find: jest.fn(),
  };

  const mockMessageModel = {
    create: jest.fn(),
    find: jest.fn().mockReturnThis(),
    sort: jest.fn().mockReturnThis(),
    exec: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatService,
        {
          provide: getModelToken(Chatroom.name),
          useValue: mockChatroomModel,
        },
        {
          provide: getModelToken(User.name),
          useValue: mockUserModel,
        },
        {
          provide: getModelToken(Message.name),
          useValue: mockMessageModel,
        },
      ],
    }).compile();

    service = module.get<ChatService>(ChatService);
    chatroomModel = module.get<Model<Chatroom>>(getModelToken(Chatroom.name));
    userModel = module.get<Model<User>>(getModelToken(User.name));
    messageModel = module.get<Model<Message>>(getModelToken(Message.name));

    // Mock Date.now
    Date.now = jest.fn(() => new Date().getTime());
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('updateLastActive', () => {
    it('should update user last active time', async () => {
      const username = 'testUser';
      const mockDate = new Date();
      jest.spyOn(global, 'Date').mockImplementation(() => mockDate);

      await service.updateLastActive(username);

      expect(mockUserModel.findOneAndUpdate).toHaveBeenCalledWith(
        { username },
        { lastActiveAt: mockDate },
        { new: true },
      );
    });
  });

  describe('doesChatroomExist', () => {
    it('should return true if chatroom exists', async () => {
      const chatroomId = 'testRoom';
      mockChatroomModel.exists.mockResolvedValue({ _id: 'someId' });

      const result = await service.doesChatroomExist(chatroomId);

      expect(result).toBe(true);
      expect(mockChatroomModel.exists).toHaveBeenCalledWith({
        name: chatroomId,
      });
    });

    it('should return false if chatroom does not exist', async () => {
      const chatroomId = 'testRoom';
      mockChatroomModel.exists.mockResolvedValue(null);

      const result = await service.doesChatroomExist(chatroomId);

      expect(result).toBe(false);
    });
  });

  describe('createChatroom', () => {
    it('should create a new chatroom if it does not exist', async () => {
      const chatroomId = 'testRoom';
      const username = 'testUser';

      // Mock the initial findOne to return null (chatroom doesn't exist)
      mockChatroomModel.findOne.mockResolvedValue(null);

      // Mock the create method instead of save
      mockChatroomModel.create = jest.fn().mockResolvedValue({
        chatroomId,
        users: [username],
        lastActiveAt: new Date(),
      });

      const result = await service.createChatroom(chatroomId, username);

      expect(result).toEqual({
        chatroomId,
        users: [username],
        lastActiveAt: new Date(),
      } as Chatroom);

      // Ensure that create was called with correct arguments
      expect(mockChatroomModel.create).toHaveBeenCalledWith({
        chatroomId,
        users: [username],
        lastActiveAt: new Date(),
      });
    });

    it('should throw error if chatroom already exists', async () => {
      const chatroomId = 'testRoom';
      const username = 'testUser';
      mockChatroomModel.findOne.mockResolvedValue({ chatroomId });

      await expect(
        service.createChatroom(chatroomId, username),
      ).rejects.toThrow('Chatroom already exists');
    });
  });

  describe('joinChatroom', () => {
    it('should add user to chatroom if not already present', async () => {
      const chatroomId = 'testRoom';
      const username = 'testUser';
      const mockChatroom = {
        users: [],
        save: jest.fn(),
      };
      mockChatroomModel.findOne.mockResolvedValue(mockChatroom);

      await service.joinChatroom(chatroomId, username);

      expect(mockChatroom.users).toContain(username);
      expect(mockChatroom.save).toHaveBeenCalled();
    });

    it('should not add user if already in chatroom', async () => {
      const chatroomId = 'testRoom';
      const username = 'testUser';
      const mockChatroom = {
        users: [username],
        save: jest.fn(),
      };
      mockChatroomModel.findOne.mockResolvedValue(mockChatroom);

      await service.joinChatroom(chatroomId, username);

      expect(mockChatroom.users).toEqual([username]); // Ensures no duplicates
      expect(mockChatroom.save).not.toHaveBeenCalled();
    });

    it('should throw error if chatroom does not exist', async () => {
      const chatroomId = 'testRoom';
      const username = 'testUser';
      mockChatroomModel.findOne.mockResolvedValue(null);

      await expect(service.joinChatroom(chatroomId, username)).rejects.toThrow(
        'Chatroom does not exist',
      );
    });
  });

  describe('saveMessage', () => {
    it('should save a new message and update chatroom lastActiveAt', async () => {
      const chatroomId = 'testRoom';
      const username = 'testUser';
      const text = 'Hello!';
      const createdAt = new Date();

      // ✅ Mock chatroomModel.findOne to return a query-like object with .lean()
      mockChatroomModel.findOne.mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          _id: 'chatroomId',
          chatroomId,
        }),
      });

      const mockSave = jest.fn().mockResolvedValue({
        chatroomId,
        username,
        text,
        createdAt,
      } as Message);
      mockMessageModel.create = mockSave; // Use create instead of find

      const result = await service.saveMessage(
        chatroomId,
        username,
        text,
        createdAt,
      );

      expect(result).toEqual({
        chatroomId,
        username,
        text,
        createdAt,
      } as Message);

      expect(mockChatroomModel.findByIdAndUpdate).toHaveBeenCalledWith(
        'chatroomId',
        { lastActiveAt: new Date() },
      );
    });

    it('should throw NotFoundException if chatroom does not exist', async () => {
      const chatroomId = 'testRoom';

      mockChatroomModel.findOne.mockReturnValue({
        lean: jest.fn().mockResolvedValue(null),
      });

      await expect(
        service.saveMessage(chatroomId, 'user', 'text', new Date()),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getMessagesByChatroom', () => {
    it('should return sorted messages for a chatroom', async () => {
      const chatroomId = 'testRoom';
      const mockMessages = [
        { text: 'Hello', createdAt: new Date() },
        { text: 'World', createdAt: new Date() },
      ];

      mockMessageModel.exec.mockResolvedValue(mockMessages);

      const result = await service.getMessagesByChatroom(chatroomId);

      expect(result).toEqual(mockMessages);
      expect(mockMessageModel.find).toHaveBeenCalledWith({ chatroomId });
      expect(mockMessageModel.sort).toHaveBeenCalledWith({ createdAt: 1 });
    });
  });

  describe('removeInactiveChatrooms', () => {
    it('should remove inactive chatrooms with no users', async () => {
      const mockInactiveChatrooms = [
        { _id: '1', chatroomId: 'room1' },
        { _id: '2', chatroomId: 'room2' },
      ];

      mockChatroomModel.find.mockResolvedValue(mockInactiveChatrooms);
      mockUserModel.find.mockResolvedValue([]);

      await service.removeInactiveChatrooms();

      expect(mockChatroomModel.findByIdAndDelete).toHaveBeenCalledTimes(2);
    });

    it('should not remove chatrooms with active users', async () => {
      const mockInactiveChatrooms = [{ _id: '1', chatroomId: 'room1' }];

      mockChatroomModel.find.mockResolvedValue(mockInactiveChatrooms);
      mockUserModel.find.mockResolvedValue([{ username: 'activeUser' }]);

      await service.removeInactiveChatrooms();

      expect(mockChatroomModel.findByIdAndDelete).not.toHaveBeenCalled();
    });
  });
});
