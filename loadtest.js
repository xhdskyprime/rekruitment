import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
  stages: [
    { duration: "30s", target: 10 },
    { duration: "30s", target: 20 },
    { duration: "30s", target: 30 },
    { duration: "30s", target: 40 },
    { duration: "30s", target: 50 },
  ],
};

export default function () {
  let res = http.get("https://rekruitment-production.up.railway.app/");

  check(res, {
    "status 200": (r) => r.status === 200,
    "response < 2000ms": (r) => r.timings.duration < 2000,
  });

  sleep(1);
}
