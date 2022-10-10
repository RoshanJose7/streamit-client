import * as React from "react";
import * as ReactDOM from "react-dom";

import "./global.css";
import Router from "./Routers";

ReactDOM.render(
  <React.StrictMode>
    <Router />
  </React.StrictMode>,
  document.getElementById("root")
);
