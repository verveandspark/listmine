import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContextProvider";
import { ListProvider } from "./contexts/ListContext";
import App from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter basename="/">
      <AuthProvider>
        <ListProvider>
          <App />
        </ListProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
