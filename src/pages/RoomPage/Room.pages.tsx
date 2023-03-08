import * as React from "react";
import { SHA256 } from "crypto-js";
import { v4 as uuid, v4 } from "uuid";
import { useNavigate, useParams } from "react-router-dom";
import { useContext, useEffect, useRef, useState } from "react";

import db from "@utils/db";
import "./Room.styles.scss";
import { formatBytes } from "@utils/Files";
import { SocketContext } from "@utils/Socket";
import { ReactComponent as ExitSVG } from "@assets/exit.svg";
import { ReactComponent as SendSVG } from "@assets/send.svg";
import { ReactComponent as SentSVG } from "@assets/sent.svg";
import { TransferData, UploadedFile } from "src/react-app-env";
import { ReactComponent as BrowseSVG } from "@assets/browse.svg";
import { ReactComponent as DownloadSVG } from "@assets/download.svg";
import { CHUNK_SIZE, UploadStatus, FileTransmitType } from "@utils/constants";

function RoomPage() {
  const navigate = useNavigate();
  const { roomName, userName } = useParams();
  const socket = useContext(SocketContext);
  const [sendProgress, setSendProgress] = useState(0);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [history, setHistory] = useState<(UploadedFile | string)[]>([]);

  const fileRef = useRef<HTMLInputElement | null>(null);
  const btnRef = useRef<HTMLButtonElement | null>(null);

  async function setupSocketListeners() {
    socket.off("disconnect").on("disconnect", () => {
      socket.removeAllListeners();
      socket.removeAllListeners("disconnect");
    });

    socket.off("file_part_recv").on("file_part_recv", async (data) => {
      console.log("file_part_recv_data", data);
      data
      await db.files.add({ data: data["chunk"], counter: data["counter"] });
    });

    socket.off("notification").on("notification", async (payload) => {
      if (payload["type"] === "log")
        setHistory((prevNotifications) => [
          ...prevNotifications,
          payload["notification"],
        ]);
      else if (payload["type"] === "new_file_received") {
        const data = payload["data"];
        console.log(data, "new_file_received_data");
        if (data.sender === userName) return;

        const file: UploadedFile = {
          id: data.fileid,
          name: data.name,
          size: data.size,
          status: UploadStatus.UPLOADED,
          sender: data.sender,
          type:
            data.sender === userName
              ? FileTransmitType.SENT
              : FileTransmitType.RECEIVED,
        };

        const fileparts = [];
        const chunkCount =
          file.size % CHUNK_SIZE === 0
            ? file.size / CHUNK_SIZE
            : Math.floor(file.size / CHUNK_SIZE) + 1;

        for (let i = 0; i < chunkCount; i++) {
          const filepart = await db.files.where("counter").equals(i).first();
          fileparts.push(filepart["data"]);
        }

        const receivedFile = new File(fileparts, file.name);
        const downloadUrl = URL.createObjectURL(receivedFile);

        console.log(downloadUrl, "downloadUrl");

        setHistory((prev) => {
          const idx = prev.findIndex(
            (f) => typeof f !== "string" && f.id === data.fileid
          );

          const oldFile = prev[idx] as UploadedFile;
          if (!oldFile) return prev;

          prev.splice(idx, 1);

          const newFiles = prev;

          oldFile.url = downloadUrl;
          oldFile.status = UploadStatus.UPLOADED;
          newFiles.push(oldFile);

          return newFiles;
        });

        await db.files.clear();
      } else if (payload["type"] === "new_file") {
        await db.files.clear();
        const data = payload["data"];
        if (data.sender === userName) return;

        const file: UploadedFile = {
          id: data.fileid,
          name: data.name,
          size: data.size,
          status: UploadStatus.PENDING,
          sender: data.sender,
          type:
            data.sender === userName
              ? FileTransmitType.SENT
              : FileTransmitType.RECEIVED,
        };

        setHistory((prevNotifications) => [...prevNotifications, file]);
      } else if (payload["type"] === "percentage_update") {
        const data = payload["data"];

        console.log(`${data.percentage} ${Date.now()}`);

        setSendProgress(data.percentage);

        if (data.percentage === 100) {
          setHistory((prev) => {
            const idx = prev.findIndex(
              (f) => typeof f !== "string" && f.id === data.fileid
            );

            const oldFile = prev[idx] as UploadedFile;
            if (!oldFile) return prev;

            prev.splice(idx, 1);
            oldFile.status = UploadStatus.UPLOADED;
            prev.push(oldFile);

            return prev;
          });

          setSendProgress(0);
        }
      }
    });
  }

  useEffect(() => {
    if (socket === null) {
      navigate("/");
      return;
    }

    socket.emit("join_room", {
      room: roomName,
      name: userName,
    });

    setupSocketListeners();

    return () => {
      socket.emit("leave_room", {
        room: roomName,
        name: userName,
      });
    };
  }, []);

  function handleFileChange(e: any) {
    const files: File[] = Array.from(e.target.files);
    if (files.length > 0) setSelectedFiles(files);
  }

  async function uploadChunk(
    transferid: string,
    file: File,
    i: number,
    chunkCount: number
  ): Promise<{ message?: string; error?: string }> {
    const BEGINNING_OF_CHUNK = CHUNK_SIZE * i;
    const ENDING_OF_CHUNK = BEGINNING_OF_CHUNK + CHUNK_SIZE;

    const chunk = file.slice(BEGINNING_OF_CHUNK, ENDING_OF_CHUNK);
    const chunktext = await chunk.text();
    const checksum = SHA256(chunktext).toString();
    const progressPercentage = Math.round((i / chunkCount) * 100);

    return new Promise((resolve, reject) => {
      socket.emit("file_part", {
        transferid,
        chunk,
        checksum,
        counter: i,
        percentage: progressPercentage,
      });

      socket
        .off("ack_file_part")
        .on("ack_file_part", async ({ id, counter, chunkReceived }) => {
          console.log(chunkReceived);

          if (!chunkReceived) {
            console.log("Chunk failed at " + counter);
            reject({ error: "Failed!" });
          } else resolve({ message: "Success!" });
        });
    });
  }

  function handleFile(file: File, fileid: string) {
    const transferid = v4();
    const chunkCount =
      file.size % CHUNK_SIZE === 0
        ? file.size / CHUNK_SIZE
        : Math.floor(file.size / CHUNK_SIZE) + 1;

    return new Promise((resolve, reject) => {
      if (socket) {
        const data: TransferData = {
          fileid,
          transferid,
          sender: userName!,
          name: file.name,
          size: file.size,
          type: file.type,
          room: roomName!,
        };

        socket.emit("file_create", data);

        socket
          .off("ack_file_create")
          .on("ack_file_create", async (transferid) => {
            console.log("ack_file_create");

            let i = 0;

            while (i < chunkCount) {
              const { message, error } = await uploadChunk(
                transferid,
                file,
                i,
                chunkCount
              );

              if (error) continue;
              else {
                console.log(message, "message");
                i++;
              }
            }

            socket!.emit("file_complete", data);
            resolve("File Sent!");
          });

        // Receiving End
        socket.off("error").on("error", (err) => {
          console.error(err);
          reject(err);
        });
      }
    });
  }

  async function handleSendFile() {
    if (selectedFiles.length === 0) return;

    for (let i = 0; i < selectedFiles.length; i++) {
      const fileid = uuid();

      const newFile: UploadedFile = {
        id: fileid,
        sender: userName!,
        type: FileTransmitType.SENT,
        name: selectedFiles[i].name,
        size: selectedFiles[i].size,
        status: UploadStatus.UPLOADING,
      };

      setHistory((prev) => [...prev, newFile]);
      await handleFile(selectedFiles[i], fileid);
    }
  }

  function download(file: UploadedFile) {
    const link = document.createElement("a");

    link.href = file.url;
    console.log(file.url);
    link.setAttribute("download", file.name);

    document.body.appendChild(link);

    link.click();
    link.parentNode.removeChild(link);
  }

  return (
    <main id="room-page">
      <div id="room-page-header">
        <h2>Room {roomName}</h2>

        <button className="btn" onClick={() => navigate("/")}>
          <ExitSVG />
        </button>
      </div>

      <div id="room-page-content">
        {history.length !== 0 ? (
          history.map((his, idx) => {
            console.log(his);

            return typeof his === "string" ? (
              <h4 key={idx} className="notification">
                {his}
              </h4>
            ) : his.type === FileTransmitType.SENT ? (
              <div key={idx} className="file right">
                <h4>{his.sender}</h4>

                <div className="file-container">
                  <div
                    className={`fm_file ${"ft_" + his.name.split(".").pop()}`}
                  ></div>

                  <div className="file-content">
                    <h5>
                      {his.name.split(".")[0].substring(0, 7)}....
                      {his.name.split(".")[1]}
                    </h5>
                    <p>{formatBytes(his.size)}</p>
                  </div>

                  {his.status === UploadStatus.UPLOADED ? (
                    <SentSVG />
                  ) : (
                    <h5>{sendProgress}%</h5>
                  )}
                </div>
              </div>
            ) : (
              <div key={idx} className="file left">
                <h4>{his.sender}</h4>

                <div className="file-container">
                  <div
                    className={`fm_file ${"ft_" + his.name.split(".").pop()}`}
                  ></div>

                  <div className="file-content">
                    <h5>
                      {his.name.split(".")[0].substring(0, 7)}....
                      {his.name.split(".")[1]}
                    </h5>
                    <p>{formatBytes(his.size)}</p>
                  </div>

                  {his.status === UploadStatus.UPLOADED ? (
                    <DownloadSVG
                      style={{ cursor: "pointer" }}
                      onClick={() => download(his)}
                    />
                  ) : (
                    <h5>{sendProgress}%</h5>
                  )}
                </div>
              </div>
            );
          })
        ) : (
          <div className="center">
            <h5>No Files Yet!</h5>
          </div>
        )}
      </div>

      <div id="room-page-upload-section">
        {selectedFiles.length > 0 ? (
          <div className="selected-files">
            {selectedFiles.map((selectedFile, idx) => (
              <h3 key={idx}>
                {selectedFile.name.length <= 10
                  ? selectedFile.name
                  : selectedFile.name.split(".")[0].substring(0, 10) +
                    "..." +
                    selectedFile.name.split(".")[1]}{" "}
                <span>{formatBytes(selectedFile.size)}</span>
              </h3>
            ))}
          </div>
        ) : (
          <h3>Select Files to send</h3>
        )}

        <input
          onChange={handleFileChange}
          ref={fileRef}
          multiple
          type="file"
          name="File"
        />

        <div id="room-page-upload-section-buttons">
          <button className="btn" onClick={() => fileRef.current!.click()}>
            <BrowseSVG />
          </button>

          <button className="btn" onClick={handleSendFile} ref={btnRef}>
            <SendSVG />
          </button>
        </div>
      </div>
    </main>
  );
}

export default RoomPage;
