import { html } from "lit";
import type { RouteConfig } from "@lit-labs/router";
import { navigate } from "../utils/navigate";

import "../pages/page-login";
import "../pages/page-register";
import "../pages/page-dashboard";
import "../pages/page-chat";
import "../pages/page-landing";

export const routes: RouteConfig[] = [
  {
    path: "/",
    render: () => html`<page-landing></page-landing>`,
  },
  {
    path: "/login",
    render: () => html`<page-login></page-login>`,
  },
  {
    path: "/register",
    render: () => html`<page-register></page-register>`,
  },
  {
    path: "/chat",
    render: () => html`<page-dashboard></page-dashboard>`,
  },
  {
    path: "/chat/*",
    render: () => html`<page-chat></page-chat>`,
  },
  // Catch-all: redirect unknown paths to /chat
  {
    path: "/*",
    render: () => {
      requestAnimationFrame(() => navigate("/chat"));
      return html``;
    },
  },
];
