export const CHUNK_SIZE = 1e5;
export const HOST =
  process.env.NODE_ENV !== "development"
    ? "https://sendr-api.azurewebsites.net/"
    : "http://localhost:8080";

export enum UploadStatus {
  PENDING = 1,
  UPLOADING = 2,
  UPLOADED = 3,
}

export enum FileTransmitType {
  SENT = 1,
  RECEIVED = 2,
}
