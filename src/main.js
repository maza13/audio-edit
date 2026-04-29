import { createApp } from "./app/App.js?v=20260429-cycle1";

const root = document.querySelector("#app");

if (!root) {
  throw new Error("No se encontró el nodo #app.");
}

createApp(root);

