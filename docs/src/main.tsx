import { MDXProvider } from "@mdx-js/react";
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { mdxComponents } from "./mdx-components";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <MDXProvider components={mdxComponents}>
      <App />
    </MDXProvider>
  </React.StrictMode>
);
