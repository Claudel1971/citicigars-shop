declare namespace Express {
  namespace Multer {
    interface File {
      fieldname: string;
      originalname: string;
      encoding: string;
      mimetype: string;
      size: number;
      destination: string;
      filename: string;
      path: string;
      buffer: Buffer;
    }
  }

  interface Request {
    file?: Multer.File;
    files?: Multer.File[] | Record<string, Multer.File[]>;
  }
}

declare module "multer" {
  import type { Request, RequestHandler } from "express";

  type StorageCallback = (error: Error | null, value: string) => void;
  type FileFilterCallback = (error: Error | null, acceptFile?: boolean) => void;

  interface StorageEngine {}

  interface DiskStorageOptions {
    destination?: string | ((req: Request, file: Express.Multer.File, cb: StorageCallback) => void);
    filename?: (req: Request, file: Express.Multer.File, cb: StorageCallback) => void;
  }

  interface Options {
    storage?: StorageEngine;
    limits?: { fileSize?: number };
    fileFilter?: (req: Request, file: Express.Multer.File, cb: FileFilterCallback) => void;
  }

  interface Multer {
    single(fieldName: string): RequestHandler;
  }

  interface MulterStatic {
    (options?: Options): Multer;
    diskStorage(options: DiskStorageOptions): StorageEngine;
  }

  const multer: MulterStatic;
  export default multer;
}
