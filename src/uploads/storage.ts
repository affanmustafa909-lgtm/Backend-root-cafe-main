import { randomUUID } from 'node:crypto';
import { extname, resolve } from 'node:path';
import { diskStorage } from 'multer';

export const uploadDirectory = () =>
  resolve(process.cwd(), process.env.UPLOAD_DIR ?? 'uploads');

export const imageStorage = diskStorage({
  destination: uploadDirectory(),
  filename: (_request, file, callback) =>
    callback(null, `${randomUUID()}${extname(file.originalname).toLowerCase()}`),
});

export const imageFileFilter = (
  _request: unknown,
  file: Express.Multer.File,
  callback: (error: Error | null, accept: boolean) => void,
) => {
  callback(
    file.mimetype.startsWith('image/') ? null : new Error('Images only'),
    file.mimetype.startsWith('image/'),
  );
};
