import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = __ENV.TARGET_URL;

export const options = {
  // 10 virtual users continuously hitting the app for 30 minutes
  // Press Ctrl+C anytime to stop and print the full failure summary
  vus: 10,
  duration: '30m',

  // Strict zero-downtime pass/fail rules
  thresholds: {
    http_req_failed: ['rate==0'],      // Must be 0% failed requests
    http_req_duration: ['p(95)<500'],  // 95% of requests under 500ms
  },
};

export default function () {
  // 1. Visit Homepage
  const homeRes = http.get(`${BASE_URL}/`);
  check(homeRes, { 'homepage 200': (r) => r.status === 200 });

  // 2. View a Product (Sunglasses)
  const productRes = http.get(`${BASE_URL}/product/OLJCESPC7Z`);
  check(productRes, { 'product page 200': (r) => r.status === 200 });

  // 3. Add Item to Cart (hits Cart Service + Redis)
  const addCartRes = http.post(`${BASE_URL}/cart`, {
    product_id: 'OLJCESPC7Z',
    quantity: '1',
  });
  check(addCartRes, { 'add to cart 200': (r) => r.status === 200 });

  // Small pause between user actions (~15-20 requests/sec total across 10 VUs)
  sleep(1);
}