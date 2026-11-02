import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Board } from "@/components/board/board";
import { BoardThemeProvider } from "@/components/board/theme";
import { ServiceWorker } from "@/components/service-worker";
import { Toaster } from "@/components/ui/sonner";
import { UpdateNotice } from "@/components/update-notice";
import "./globals.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BoardThemeProvider>
      <Board />
      <ServiceWorker />
      <UpdateNotice />
      <Toaster
        position="bottom-center"
        toastOptions={{
          classNames: {
            toast: "cn-toast text-base!",
            // Undo and Refresh are tapped on phones: keep them at least 44px tall
            actionButton: "h-11! px-4! text-base!",
            cancelButton: "h-11! px-4! text-base!",
          },
        }}
      />
    </BoardThemeProvider>
  </StrictMode>,
);
