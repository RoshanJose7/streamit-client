/// <reference types="react-scripts" />

interface UploadedFile {
  id: string;
  name: string;
  size: number;
  sender: string;
  status: UploadStatus;
  type: FileTransmitType;
}

interface TransferData {
  name: string;
  size: number;
  type: string;
  room: string;
  fileid: string;
  sender: string;
  transferid: string;
}
