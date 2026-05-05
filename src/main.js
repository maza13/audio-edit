import { createApp } from "./app/App.js?v=20260504-cycle2";

const root = document.querySelector("#app");

if (!root) {
  throw new Error("No se encontró el nodo #app.");
}

createApp(root);

