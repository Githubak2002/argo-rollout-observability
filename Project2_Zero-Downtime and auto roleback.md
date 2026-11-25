This project combines **Zero-Downtime Releases**, **Automatic Rollbacks**, and **End-to-End Request Tracing** into one practical setup you can build completely free on a local **Kind** (Kubernetes in Docker) cluster first, and later lift onto **Azure AKS** with Private Networking and Workload Identity.

---

### The Pre-Existing App to Use

Use **Google’s Online Boutique** (open-source microservices e-commerce demo).

* **Why it fits perfectly:** A single user click on the website travels through multiple real layers — **Ingress → Frontend → Checkout / Product Catalog → Currency Service (Node.js) → Redis**. That multi-hop path is what makes request tracing actually useful.
* **No coding from scratch:** It is already built, containerized, and supports OpenTelemetry tracing via environment variables.
* **Easy to break on purpose:** Because `currencyservice` is written in **Node.js**, you can edit 3 lines of JavaScript to create a "slow version" or "broken version" whenever you want to test tracing and automatic rollbacks.
* *Lightweight backup:* If your laptop has less than 16GB RAM, you can run just 3 services from it (or swap to **Podinfo + Redis**), and the exact same DevOps architecture still applies.

---

### The Complete Stack (In Plain English)

| Layer | Tool | What It Actually Does Here |
| --- | --- | --- |
| **Traffic Entry** | **NGINX Ingress** (or Envoy Gateway) | Receives user HTTP traffic and splits it cleanly between old (`v1`) and new (`v2`) versions (for example, 90% / 10%). |
| **Release Engine** | **Argo Rollouts** + **ArgoCD** | Replaces standard Kubernetes `Deployment` with `Rollout`. Slowly shifts traffic to the new version and **auto-rolls back** if errors or latency spike. |
| **User Simulator** | **k6** (JavaScript) | Continuously hits your APIs (20–50 requests/second) like real users and prints the exact count of failed requests (`0` is the goal). |
| **Tracing Collector** | **OpenTelemetry (OTel) Collector** | Collects trace spans from the Ingress and app services and forwards them to Grafana Tempo. |
| **Trace Viewer** | **Grafana Tempo** | Displays a timeline bar for every HTTP request so you see exact milliseconds spent at **every single layer**. |
| **Metrics & Decisions** | **Prometheus + Grafana** | Measures live error rate and response time; feeds those numbers to Argo Rollouts so it knows when to roll back automatically. |

---

### Step-by-Step Build Plan

1. **Deploy Online Boutique & Continuous User Load (k6):** Local Kind Cluster · $0.
Get the baseline app running locally and simulate constant traffic before adding any fancy tools.

* Create a local Kind cluster and deploy Online Boutique behind an NGINX Ingress controller.
* Write a 20-line **k6** script that continuously visits the homepage, views a product, and hits the cart/checkout flow at 20–30 requests per second.
* Confirm k6 shows **100% success** (`http_req_failed: 0.00%`) during normal steady state.


2. **Wire Up End-to-End Request Tracing:** Answer: Where is the request stuck?.
Turn on tracing across both the Ingress controller and the app microservices so every single HTTP request carries one shared **Trace ID**.

* Install **OpenTelemetry Collector**, **Prometheus**, **Grafana Tempo**, and **Grafana** (using Helm).
* Enable OpenTelemetry on NGINX Ingress (so the trace starts the exact millisecond the request enters the cluster) and set `ENABLE_TRACING=1` on Online Boutique services pointing to the OTel Collector.
* Open **Grafana → Explore → Tempo**, pick any request, and view the waterfall breakdown:
* **Ingress:** 3 ms
* **Frontend:** 14 ms
* **Product Catalog / Cart:** 9 ms
* **Currency Service (Node.js):** 6 ms
* **Redis:** 2 ms




3. **Prove True Zero-Downtime Deployment:** Fix the hidden 502 errors during releases.
Standard Kubernetes rolling updates often drop a few active user requests even when everything looks green. You will catch that bug live and fix it.

* Keep **k6** hitting the APIs continuously and push a harmless v2 update to `currencyservice`.
* Check k6 output: you will likely see 5 to 20 dropped requests (`502` or connection reset) because Kubernetes killed old pods while Ingress was still sending traffic to them.
* Fix it properly by adding:
* **Readiness Probes** (don't send traffic until the new pod is truly ready).
* **`preStop: sleep 5` lifecycle hook** + graceful shutdown in Node.js (wait for NGINX to stop routing to the old pod before closing active HTTP connections).
* **PodDisruptionBudget (PDB)** (ensure minimum healthy pods always stay up).


* Re-run the release under k6 load and verify **0 failed requests**.


4. **Add Canary Releases & Automatic Rollbacks:** GitOps + Progressive Delivery.
Upgrade `currencyservice` from a normal Kubernetes `Deployment` to an **Argo Rollout** synced via ArgoCD.

* Configure Canary steps: **10% traffic (2 min) → 30% (2 min) → 60% (2 min) → 100%**.
* Create an **AnalysisTemplate** that queries Prometheus every 30 seconds with two strict rules:
* HTTP 5xx error rate must stay **less than 1%**.
* P95 response time must stay **less than 500 ms**.


* If either rule fails during the 10% canary window, Argo Rollouts automatically aborts the release and shifts 100% of traffic back to the stable version.


5. **Lift to Azure AKS with Auto-Scaling & Private Access:** Optional Cloud & FinOps Upgrade.
Once everything works cleanly on your laptop, deploy the same Helm/GitOps setup to a short-lived **Azure AKS** cluster using Terraform:

* Add a **Horizontal Pod Autoscaler (HPA)** and crank k6 up to 150 concurrent users to watch pods scale up automatically and scale back down when traffic stops.
* Put the container registry (ACR) and Key Vault behind **Private Endpoints**, connect pods using **Workload Identity** (zero passwords), and add a scheduled cluster stop/start rule to demonstrate real cost optimization.


---

### The 3 Live Tests That Prove You Mastered It

Once built, run **k6** continuously in one terminal and trigger these three releases via Git:

1. **Clean Release Test (`v1 → v2`):** Change a harmless response header or minor UI text. Traffic shifts 10% → 30% → 60% → 100%. **Expected result:** `0` failed requests in k6.
2. **Broken Code Rollback Test (`v2 → v3-buggy`):** Edit `currencyservice` in Node.js so 20% of requests return an HTTP `500` error. Push to Git. **Expected result:** At 10% canary traffic, Prometheus flags the error spike, Argo Rollouts automatically aborts and restores `v2` within a minute, and 90% of simulated users never experience downtime.
3. **Slow Layer Diagnosis Test (`v2 → v4-slow`):** Add a `setTimeout` of `1500ms` inside `currencyservice`. **Expected result:** Two wins at once — **Grafana Tempo** immediately highlights the red 1,500ms bar inside `currencyservice` (proving the exact stuck layer), and **Argo Rollouts** automatically rolls back because P95 latency breached your 500ms threshold.

---

Would you like to start **Step 1** right now — setting up the local Kind cluster, NGINX Ingress, Online Boutique manifests, and the continuous k6 user-simulation script?