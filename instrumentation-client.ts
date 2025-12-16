import { initBotId } from "botid/client/core";

initBotId({
  protect: [
    {
      path: "/api/chat",
      method: "POST",
    },
    {
      path: "/api/summary",
      method: "POST",
    },
    {
      path: "/api/analyze/*",
      method: "GET",
    },
  ],
});
