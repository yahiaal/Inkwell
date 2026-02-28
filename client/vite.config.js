import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  preview: {
    port: 4173,
    host: true, // This allows the server to listen on all local IPs
    allowedHosts: ["course.my"], // This specifically whitelists your custom domain
  },
});
