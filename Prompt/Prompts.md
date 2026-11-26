## Initial prompt
You are a Senior Cloud & DevOps Engineer assisting me on this Online Boutique Kubernetes repository (deployed on Azure AKS). We are building a phased Zero-Downtime Release and Observability project.

### Strict Scope & Guardrails (Read-Only Onboarding)
- ONLY read these files right now:
  1. release/ak-k8s-manifests.yaml
  2. load-test.js
- DO NOT read, search, or modify: src/, protos/, DockerFiles/, kind/, infra/, kubernetes-manifests/, release/kubernetes-manifests.yaml, or release/istio-manifests.yaml.
- DO NOT edit or create any files yet.
- DO NOT run any live cluster commands (kubectl, helm, az). Local read-only git checks (like git branch / git status) are fine.

### Your Task Right Now
Analyze release/ak-k8s-manifests.yaml and load-test.js and report back concisely with:
1. Current Git branch (if Git is initialized).
2. A quick table of every Deployment in release/ak-k8s-manifests.yaml showing:
   - metadata.name
   - spec.selector.matchLabels
   - current spec.replicas (or "not set")
   - current spec.strategy (or "not set")
   - whether terminationGracePeriodSeconds and lifecycle.preStop are already present
3. Confirmation of which workloads are stateless microservices vs. stateful/excluded (e.g., redis-cart, loadgenerator).
4. Which user flows load-test.js exercises.

Stop after giving this summary and wait for my Phase 2.a implementation prompt.


## Phase 1 


## Phase 2.a

You are a Senior Cloud & DevOps Engineer working in this Online Boutique Kubernetes repository. We are currently on branch phase-2a-native-zero-downtime, implementing native Kubernetes zero-downtime rolling updates (WITHOUT Argo Rollouts yet).

### Strict Scope & Guardrails
- ONLY inspect and modify: release/ak-k8s-manifests.yaml
- DO NOT read or modify: release/kubernetes-manifests.yaml, release/istio-manifests.yaml, kubernetes-manifests/, src/, protos/, DockerFiles/, kind/, infra/, or load-test.js.
- DO NOT create any Helm charts or Argo Rollout resources in this phase.
- DO NOT run any live cluster commands (kubectl apply, az aks, etc.). Local read-only YAML validation is allowed.

### Required Changes in release/ak-k8s-manifests.yaml
Update all 10 stateless microservice Deployments (skip redis-cart and loadgenerator if present):

1. Replica Count (spec.replicas):
   - Set replicas: 2 for the 4 core traffic-path services: frontend, productcatalogservice, currencyservice, and cartservice.
   - Set replicas: 1 for the remaining 6 stateless services (checkoutservice, paymentservice, shippingservice, emailservice, recommendationservice, adservice).

2. Zero-Downtime RollingUpdate Strategy (spec.strategy):
   - Add the following to all 10 stateless Deployments:

       strategy:
         type: RollingUpdate
         rollingUpdate:
           maxUnavailable: 0
           maxSurge: 1

3. Graceful Shutdown (spec.template.spec and primary container):
   - Ensure terminationGracePeriodSeconds: 30 is set under spec.template.spec (avoid duplicates if already present).
   - Ensure the primary container (containers[0]) has the preStop sleep hook (avoid duplicates if already present):

       lifecycle:
         preStop:
           sleep:
             seconds: 10

4. PodDisruptionBudgets (at the bottom of release/ak-k8s-manifests.yaml):
   - Append a PodDisruptionBudget (apiVersion: policy/v1, kind: PodDisruptionBudget) with minAvailable: 1 ONLY for the 4 services that have replicas: 2 (frontend, productcatalogservice, currencyservice, cartservice), matching each Deployment's exact spec.selector.matchLabels.
   - Do NOT add a PDB for 1-replica services (since minAvailable: 1 on 1 replica blocks node drains).

5. Preserve Everything Else:
   - Do not modify existing container images, ports, readinessProbe/livenessProbe, securityContext, resources, or environment variables.

### Output Required After Editing
- Confirm valid YAML formatting with no duplicate keys.
- Print a concise summary table of the updated Deployments (name, replicas, strategy, preStop, PDB added yes/no).
- Give me the exact kubectl apply command to deploy this to AKS.