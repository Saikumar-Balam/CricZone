
import http from "k6/http";
import { check, sleep } from "k6";

const baseUrl = __ENV.BASE_URL;

if (!baseUrl) {
  throw new Error("BASE_URL environment variable is required");
}

export const options = {
  scenarios: {
    smoke: {
      executor: "constant-vus",
      vus: 1,
      duration: "30s",
    },
  },

  thresholds: {
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<500"],
    checks: ["rate>0.99"],
  },
};

export default function () {
  const response = http.get(`${baseUrl}/health`, {
    timeout: "10s",
    tags: { endpoint: "health" },
  });

  check(response, {
    "health returns HTTP 200": (res) => res.status === 200,
  });

  sleep(1);
}
