# Zero-Downtime Releases & End-to-End Observability on AKS

A hands-on production engineering project demonstrating how to evolve a Kubernetes microservices application (**Google Online Boutique** on **Azure AKS**) from default deployments to **true zero-downtime releases**, **Canary progressive delivery**, and **end-to-end distributed request tracing**—continuously validated under simulated user traffic with **Grafana k6**.

---

## Project Roadmap (Branch-by-Branch)

Each phase solves a real production gap exposed in the previous phase:

| Phase / Branch | What Is Implemented | Problem Uncovered (Why Move to Next Phase) |
| :--- | :--- | :--- |
| **Phase 1** (`phase-1-default-rolling-update`) | Default Kubernetes `RollingUpdate` tested under continuous k6 user load. | **Drops in-flight user requests** (`connection refused` / `no route to host`) during pod termination, even though Kubernetes reports a successful rollout. |
| **Phase 2.a** (`phase-2a-native-zero-downtime`) | `replicas: 2`, `maxUnavailable: 0`, `maxSurge: 1`, `preStop` hook, `terminationGracePeriodSeconds`, and `PodDisruptionBudget` (PDB). | Achieves zero dropped requests for healthy releases, **but** still rolls buggy code (that passes basic `/healthz` probes) out to 100% of users with no automatic rollback. |
| **Phase 2.b** (`phase-2b-argo-rollouts-canary`) | Standalone **Argo Rollouts** + reusable **Helm chart** (`platform-rollouts`) for multi-service Canary deployments. | Limits blast radius by shifting traffic gradually (`25% -> 50% -> 100%`), **but** still relies on manual monitoring to detect latency spikes or hidden microservice errors. |
| **Phase 3** (`phase-3-e2e-observability`) | **OpenTelemetry + Prometheus + Grafana Tempo** + automated metric-driven rollbacks. | Full visibility into where every single HTTP request spends time across layers, plus automatic rollbacks when error rates or P95 latency breach thresholds. |

---

## Phase 1: Baseline & Default Kubernetes Rolling Update

### Objective
Deploy Online Boutique (`release/ak-k8s-manifests.yaml`) on Azure AKS with its default Kubernetes deployment configuration, simulate continuous real-user traffic from outside the cluster using **Grafana k6** (`load-test.js`), and measure whether a standard rolling update causes real user failures.

### Test Setup
* **Cluster:** Azure Kubernetes Service (`ak-prod-aks`)
* **Application:** Online Boutique microservices (`frontend` running with default `replicas: 1`, no `preStop` hook, no explicit `PodDisruptionBudget`)
* **Load Simulator:** Containerized `grafana/k6` running externally against the `frontend-external` LoadBalancer IP (`10` Virtual Users continuously hitting `/`, `/product/OLJCESPC7Z`, and `POST /cart` at ~28–30 req/s)
* **Pass Criteria:** `http_req_failed == 0.00%` and `p(95) < 500ms`

---

### Commands Executed

**Terminal 1 — Continuous User Traffic (k6):**

Get the AKS load balancer IP from the `EXTERNAL-IP` column for the
`frontend-external` service. Replace `<public_ip_aks_lb>` with that IP
before running the Docker command in the same terminal.

```bash
kubectl get svc frontend-external
export TARGET_URL="http://<public_ip_aks_lb>"

docker run --rm -it -e TARGET_URL="$TARGET_URL" -v "$(pwd)/load-test.js:/load-test.js" grafana/k6 run /load-test.js
```

**Terminal 2 — Trigger Default Rolling Update:**
```bash
kubectl rollout restart deployment/frontend && kubectl rollout status deployment/frontend
```

---

### Observed Results

| Metric | Steady-State Baseline (No Rollout) | During Default `RollingUpdate` |
| :--- | :--- | :--- |
| **Kubernetes Rollout Status** | N/A | `successfully rolled out` |
| **Total HTTP Requests** | `1,503` (~30.5 req/s) | `1,297` (~28.9 req/s) |
| **Failed Requests (`http_req_failed`)** | **`0.00%`** (`0 / 1,503`) | **`0.61%`** (`8 / 1,297`) ❌ |
| **Failed User Checks** | `0.00%` (`0 / 1,127`) | `0.82%` (`8 / 974`) ❌ |
| **P95 Latency (`http_req_duration`)** | `174.44ms` | `111.25ms` |

**Exact Errors Captured by k6 (2-Second Failure Window):**
```text
WARN[0035] Request Failed  error="Get \"http://<EXTERNAL_IP>/\": dial tcp <EXTERNAL_IP>:80: connect: connection refused"
WARN[0035] Request Failed  error="Post \"http://<EXTERNAL_IP>/cart\": dial tcp <EXTERNAL_IP>:80: connect: connection refused"
WARN[0035] Request Failed  error="Get \"http://<EXTERNAL_IP>/product/OLJCESPC7Z\": dial tcp <EXTERNAL_IP>:80: connect: connection refused"
WARN[0036] Request Failed  error="Get \"http://<EXTERNAL_IP>/\": dial tcp <EXTERNAL_IP>:80: connect: no route to host"
```

---

### Root Cause Analysis: Why Did Requests Fail?

Although `kubectl rollout status` reported `deployment "frontend" successfully rolled out`, **8 live user requests failed** inside a 2-second window (`00:35`–`00:36`).

This happens because pod termination and network updates in Kubernetes are **asynchronous** (a classic race condition):

1. **Network update (slow — takes 1–3 seconds):** When Kubernetes marks the old `frontend` pod as `Terminating`, it removes the pod's IP from the Service `Endpoints` and propagates updated routing rules to `kube-proxy` across AKS nodes.
2. **Container shutdown (instant — takes milliseconds):** At the exact same moment, Kubernetes sends `SIGTERM` to the container, which immediately stops listening on its port.

Because the app shut down faster than `kube-proxy` updated its rules, live traffic continued hitting the dying pod IP:
* **`connection refused` (`WARN[0035]`):** Traffic reached the pod IP, but the app process had already stopped listening.
* **`no route to host` (`WARN[0036]`):** Traffic reached the node right after the pod's network interface was torn down.

---

### Moving to Phase 2.a: Native Zero-Downtime Controls

To eliminate dropped in-flight requests and protect against cluster maintenance disruptions, **Phase 2.a (`phase-2a-native-zero-downtime`)** introduces:

* **`lifecycle.preStop` (`sleep: 10s`):** Delays `SIGTERM` by 10 seconds after the pod enters `Terminating`. The old pod stays alive to finish in-flight requests while `kube-proxy` finishes removing its IP from Service routing.
* **`terminationGracePeriodSeconds: 30`:** Gives the pod up to 30 seconds total (`preStop` + graceful app exit) before Kubernetes forcefully terminates it (`SIGKILL`).
* **`maxUnavailable: 0` & `maxSurge: 1`:** Guarantees Kubernetes spins up a new pod and verifies its `readinessProbe` *before* terminating any old pod.
* **`replicas: 2` (on core traffic-path services):** Ensures continuous availability even if a single pod crashes or restarts.
* **`PodDisruptionBudget` (`minAvailable: 1`):** Prevents voluntary cluster events (AKS node upgrades, OS patching, or node scale-downs) from evicting all replicas of a service simultaneously.