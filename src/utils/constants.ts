export const CHUNK_SIZE = 1e6;
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

// export const DBConfig: IndexedDBProps = {
//   name: "MyDB",
//   version: 1,
//   objectStoresMeta: [
//     {
//       store: "files",
//       storeConfig: { keyPath: "id", autoIncrement: true },
//       storeSchema: [
//         { name: "counter", keypath: "counter", options: { unique: false } },
//         { name: "data", keypath: "data", options: { unique: false } },
//       ],
//     },
//   ],
// };
