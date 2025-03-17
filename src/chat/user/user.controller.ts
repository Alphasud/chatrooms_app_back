import {
  Controller,
  UseInterceptors,
  UploadedFile,
  Body,
  HttpStatus,
  Query,
  Delete,
  Logger,
  Get,
  Patch,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UserService } from './user.service';
import { ParseFilePipeBuilder } from '@nestjs/common';
import { diskStorage } from 'multer';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import path from 'path';
import * as fs from 'fs';
import { InternalServerErrorException } from '@nestjs/common';

// Set the maximum file size (e.g., 5MB)
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB in bytes

@Controller('user')
export class UserController {
  private readonly logger = new Logger(UserService.name);
  constructor(private readonly userService: UserService) {}

  @Get()
  async getUserInfo(@Query('clientId') clientId: string) {
    return await this.userService.findUserByClientId(clientId);
  }

  @Patch('upload-avatar')
  @UseInterceptors(
    FileInterceptor('avatar', {
      storage: diskStorage({
        destination: './uploads', // Directory to store the files
        filename: (req, file, cb) => {
          const filename = `${Date.now()}-${file.originalname}`;
          cb(null, filename);
        },
      }),
    }),
  )
  async uploadAvatar(
    @UploadedFile(
      new ParseFilePipeBuilder()
        .addFileTypeValidator({
          fileType: /^image\/(jpeg|png|jpg)$/,
        })
        .addMaxSizeValidator({
          maxSize: MAX_FILE_SIZE, // Enforce file size limit
        })
        .build({
          errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY, // Custom error code
        }),
    )
    file: Express.Multer.File,
    @Query('clientId') clientId: string,
  ) {
    // Check if no file is uploaded
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    // Store avatar URL (adjust based on where you store the file)
    const avatarUrl = `/uploads/${file.filename}`;

    // Save the avatar URL to the user's document in the DB
    await this.userService.updateAvatar(clientId, avatarUrl);

    return avatarUrl;
  }

  @Delete('delete-avatar')
  async deleteAvatar(@Query('clientId') clientId: string) {
    const user = await this.userService.findUserByClientId(clientId);
    if (!user || !user.avatar) {
      throw new NotFoundException('User or avatar not found');
    }

    // Construct the full file path
    const filePath = path.join(
      __dirname,
      '..',
      'uploads',
      path.basename(user.avatar),
    );

    // Delete the file from the filesystem
    try {
      if (fs && fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (error) {
      this.logger.error('Error deleting avatar:', error);
      throw new InternalServerErrorException('Could not delete avatar');
    }

    // Remove avatar reference from DB
    await this.userService.updateAvatar(clientId, '');

    return { message: 'Avatar deleted successfully' };
  }

  @Patch('update-username')
  async updateUsername(
    @Query('clientId') clientId: string,
    @Body() body: { newUsername: string },
  ) {
    return await this.userService.updateUsername(clientId, body.newUsername);
  }
}
