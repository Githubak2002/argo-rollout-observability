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

  // 2. Switch currency before viewing the product
  const currencyRes = http.post(`${BASE_URL}/setCurrency`, {
    currency_code: 'EUR',
  }, { redirects: 0 });
  check(currencyRes, { 'set currency 302': (r) => r.status === 302 });

  // 3. View a Product (Sunglasses)
  const productRes = http.get(`${BASE_URL}/product/OLJCESPC7Z`);
  check(productRes, { 'product page 200': (r) => r.status === 200 });

  // 4. Add Item to Cart (hits Cart Service + Redis)
  const addCartRes = http.post(`${BASE_URL}/cart`, {
    product_id: 'OLJCESPC7Z',
    quantity: '1',
  });
  check(addCartRes, { 'add to cart 200': (r) => r.status === 200 });

  // 5. Empty the cart at the end of the shopping flow
  const emptyCartRes = http.post(`${BASE_URL}/cart/empty`, null, { redirects: 0 });
  check(emptyCartRes, { 'empty cart 302': (r) => r.status === 302 });

  // Pause before starting the next shopping flow
  sleep(1);
}



// run as docker container:
// export TARGET_URL=http://4.247.243.173
// docker run --rm -it -e TARGET_URL="$TARGET_URL" -v "$(pwd)/load-test.js:/load-test.js" grafana/k6 run /load-test.js

// rollout and observe k6 load test results
// kubectl rollout restart deployment/frontend && kubectl rollout status deployment/frontend