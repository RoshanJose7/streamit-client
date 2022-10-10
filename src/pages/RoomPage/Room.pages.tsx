import axios from "axios";
import download from "downloadjs";
import SHA256 from "crypto-js/sha256";
import { v4 as uuid, v4 } from "uuid";
import { useNavigate, useParams } from "react-router-dom";
import { useContext, useEffect, useRef, useState } from "react";

import "./Room.styles.scss";
import { formatBytes } from "../../utils/Files";
import { SocketContext } from "../../utils/Socket";
import { ReactComponent as ExitSVG } from "../../assets/exit.svg";
import { ReactComponent as SendSVG } from "../../assets/send.svg";
import { ReactComponent as SentSVG } from "../../assets/sent.svg";
import { ReactComponent as BrowseSVG } from "../../assets/browse.svg";
import { FileTransmitType, HOST, UploadStatus } from "../../utils/constants";
import { ReactComponent as DownloadSVG } from "../../assets/download.svg";

function RoomPage() {
  const { roomName, userName } = useParams();
  const socket = useContext(SocketContext);
  const navigate = useNavigate();

  const [sendProgress, setSendProgress] = useState(0);
  const [history, setHistory] = useState<(UploadedFile | string)[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

  const fileRef = useRef<HTMLInputElement | null>(null);
  const btnRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (socket === null) {
      navigate("/");
      return;
    }

    socket.emit("join_room", {
      room: roomName,
      name: userName,
    });

    socket.off("disconnect").on("disconnect", () => {
      socket.removeAllListeners();
      socket.removeAllListeners("disconnect");
    });

    socket.off("notification").on("notification", (payload) => {
      if (payload["type"] === "log")
        setHistory((prevNotifications) => [
          ...prevNotifications,
          payload["notification"],
        ]);
      else if (payload["type"] === "new_file") {
        const data = payload["data"];
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

        console.log(file, "receivedfile");

        setHistory((prevNotifications) => [...prevNotifications, file]);
      } else if (payload["type"] === "percentage_update") {
        const data = payload["data"];
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

  async function handleFile(file: File, fileid: string) {
    if (!file) return;

    const transferid = v4();
    const CHUNK_SIZE = 1e6;
    const chunkCount =
      file.size % CHUNK_SIZE === 0
        ? file.size / CHUNK_SIZE
        : Math.floor(file.size / CHUNK_SIZE) + 1;

    const data: TransferData = {
      fileid,
      transferid,
      sender: userName!,
      name: file.name,
      size: file.size,
      type: file.type,
      room: roomName!,
    };

    setSendProgress(0);
    setSelectedFiles([]);

    const createfileresponse = await axios.post(`${HOST}/files/create`, data, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json",
      },
    });

    let i = 0;
    while (i < chunkCount) {
      const BEGINNING_OF_CHUNK = CHUNK_SIZE * i;
      const ENDING_OF_CHUNK = BEGINNING_OF_CHUNK + CHUNK_SIZE;

      const chunk = file.slice(BEGINNING_OF_CHUNK, ENDING_OF_CHUNK);
      const chunktext = await chunk.text();
      const checksum = SHA256(chunktext).toString();
      const percentage = Math.round((i / chunkCount) * 100);

      const data = new FormData();
      data.append("chunk", chunk);
      data.append("checksum", checksum);
      data.append("counter", i.toString());
      data.append("transferid", transferid);
      data.append("percentage", percentage.toString());

      await axios.post(`${HOST}/files/part`, data, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Content-Type": "multipart/form-data",
        },
      });

      i++;
    }

    const filesendcompleteresponse = await axios.post(
      `${HOST}/files/complete`,
      {
        transferid,
      },
      {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Content-Type": "application/json",
        },
      }
    );

    socket!.emit("notification", {
      type: "new_file",
      payload: {
        fileid: fileid,
        room: roomName,
        sender: socket!.id,
      },
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
          history.map((his, idx) =>
            typeof his === "string" ? (
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

                  <button
                    onClick={() => {
                      download(`${HOST}/files/${roomName}/${his.id}`, his.name);
                    }}
                  >
                    <DownloadSVG />
                  </button>
                </div>
              </div>
            )
          )
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
