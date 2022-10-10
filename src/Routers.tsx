import * as React from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";

import RoomPage from "@pages/RoomPage/Room.pages";
import RoomRouter from "@pages/HomePage/Home.pages";
import { SocketContext, socket } from "@utils/Socket";
import NavbarComponent from "@components/Navbar/Navbar.components";
import FooterComponent from "@components/Footer/Footer.components";

function Routers() {
  return (
    <BrowserRouter>
      <NavbarComponent />

      <SocketContext.Provider value={socket}>
        <Routes>
          <Route path="/" element={<RoomRouter />} />
          <Route path="room/:roomName/:userName" element={<RoomPage />} />
        </Routes>
      </SocketContext.Provider>

      <FooterComponent />
    </BrowserRouter>
  );
}

export default Routers;
