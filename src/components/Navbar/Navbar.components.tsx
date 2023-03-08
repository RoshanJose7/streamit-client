import * as React from "react";
import { Link } from "react-router-dom";

import "./Navbar.styles.scss";

function NavbarComponent() {
  return (
    <nav>
      <Link to="/">
        <h1>StreamIt</h1>
      </Link>
    </nav>
  );
}

export default NavbarComponent;
