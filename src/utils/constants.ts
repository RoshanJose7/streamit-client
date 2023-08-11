export const CHUNK_SIZE = 1000000;
export const HOST = "http://localhost:8080/";

export enum UploadStatus {
  PENDING = 1,
  UPLOADING = 2,
  UPLOADED = 3,
}

export enum FileTransmitType {
  SENT = 1,
  RECEIVED = 2,
}
