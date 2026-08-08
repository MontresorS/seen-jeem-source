import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import "./moving-letters.css";
import "./points-visibility.css";
import "./sound-mode";

createRoot(document.getElementById("root")!).render(<App />);
