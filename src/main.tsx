import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import AppErrorBoundary from "./components/AppErrorBoundary";
import "./index.css";

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 60 * 1000,
        retry: 1,
        refetchOnWindowFocus: false,
      },
    },
  });
}

// Preserve QueryClient across Vite HMR to avoid cache loss & request storms
let queryClient: QueryClient;
if (import.meta.hot) {
  if (!import.meta.hot.data.queryClient) {
    import.meta.hot.data.queryClient = makeQueryClient();
  }
  queryClient = import.meta.hot.data.queryClient;
  import.meta.hot.dispose((data) => {
    data.queryClient = queryClient;
  });
} else {
  queryClient = makeQueryClient();
}

createRoot(document.getElementById("root")!).render(
  <AppErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </AppErrorBoundary>
);
