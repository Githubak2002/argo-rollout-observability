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
- start with confirming if we can just remove the recommendationservice from the file release/ak-k8s... - if it will not inpact the app
- Confirm valid YAML formatting with no duplicate keys.
- Print a concise summary table of the updated Deployments (name, replicas, strategy, preStop, PDB added yes/no).
- Give me the exact kubectl apply command to deploy this to AKS.


## CPU memory - request limit

can you see the issue - CPU and memory Request and limit set in yaml file

Actual usage - 

➜  argo-rollouts-and-observability git:(phase-2a-native-zero-downtime) ✗ k top nodes                                      
NAME                                CPU(cores)   CPU(%)   MEMORY(bytes)   MEMORY(%)   
aks-nodepool1-13736567-vmss000002   234m         12%      1460Mi          25%         
aks-nodepool1-13736567-vmss000003   172m         9%       1279Mi          22%         
aks-nodepool1-13736567-vmss000004   140m         7%       768Mi           13%      

aks-nodepool1-13736567-vmss000002 - cpu and memory req and limit

ProviderID:                   azure:///subscriptions/052c9332-2138-411f-adef-e7445d02ecc6/resourceGroups/mc_jarvis-poc-rg_ak-poc-aks_centralindia/providers/Microsoft.Compute/virtualMachineScaleSets/aks-nodepool1-13736567-vmss/virtualMachines/2
Non-terminated Pods:          (19 in total)
  Namespace                   Name                                      CPU Requests  CPU Limits  Memory Requests  Memory Limits  Age
  ---------                   ----                                      ------------  ----------  ---------------  -------------  ---
  default                     adservice-744cdb8f86-txngs                200m (10%)    300m (15%)  180Mi (3%)       300Mi (5%)     6m39s
  default                     cartservice-d9c9d676f-w9t68               200m (10%)    300m (15%)  64Mi (1%)        128Mi (2%)     6m41s
  default                     checkoutservice-7b84844d76-bdg7k          100m (5%)     200m (10%)  64Mi (1%)        128Mi (2%)     6m42s
  default                     currencyservice-9f76f5d44-7wd9x           100m (5%)     200m (10%)  64Mi (1%)        128Mi (2%)     6m42s
  default                     currencyservice-9f76f5d44-t24bj           100m (5%)     200m (10%)  64Mi (1%)        128Mi (2%)     6m27s
  default                     emailservice-5988cbb494-7wj9l             100m (5%)     200m (10%)  64Mi (1%)        128Mi (2%)     6m41s
  default                     paymentservice-76fff56cd-4c6f9            100m (5%)     200m (10%)  64Mi (1%)        128Mi (2%)     6m40s
  default                     productcatalogservice-69dd9d9dc4-gzc2r    100m (5%)     200m (10%)  64Mi (1%)        128Mi (2%)     6m42s
  default                     productcatalogservice-69dd9d9dc4-hch8j    100m (5%)     200m (10%)  64Mi (1%)        128Mi (2%)     6m27s
  default                     shippingservice-7d4bd76d8-7rt6g           100m (5%)     200m (10%)  64Mi (1%)        128Mi (2%)     6m41s
  kube-system                 azure-cns-hmmjb                           65m (3%)      90m (4%)    300Mi (5%)       350Mi (6%)     36m
  kube-system                 azure-ip-masq-agent-5lf9b                 50m (2%)      500m (26%)  36Mi (0%)        250Mi (4%)     36m
  kube-system                 cloud-node-manager-2jzr8                  50m (2%)      0 (0%)      50Mi (0%)        512Mi (8%)     36m
  kube-system                 csi-azuredisk-node-dw979                  30m (1%)      0 (0%)      60Mi (1%)        5800Mi (100%)  36m
  kube-system                 csi-azurefile-node-wdt2q                  40m (2%)      0 (0%)      80Mi (1%)        700Mi (12%)    36m
  kube-system                 konnectivity-agent-7bd76467d-gzmc2        20m (1%)      1 (52%)     20Mi (0%)        1Gi (17%)      35m
  kube-system                 kube-proxy-mqcj6                          100m (5%)     0 (0%)      0 (0%)           0 (0%)         36m
  kube-system                 metrics-server-866c8cb87d-qp67p           157m (8%)     252m (13%)  142Mi (2%)       412Mi (7%)     4m52s
  kube-system                 metrics-server-866c8cb87d-zwkw9           157m (8%)     252m (13%)  142Mi (2%)       412Mi (7%)     4m52s
Allocated resources:
  (Total limits may be over 100 percent, i.e., overcommitted.)
  Resource           Requests      Limits
  --------           --------      ------
  cpu                1869m (98%)   4294m (225%)
  memory             1586Mi (27%)  10912Mi (188%)
  ephemeral-storage  0 (0%)        0 (0%)
  hugepages-1Gi      0 (0%)        0 (0%)
  hugepages-2Mi      0 (0%)        0 (0%)
Events:
  Type     Reason              Age   From                                                          Message
  ----     ------              ----  ----                                                          -------
  Normal   CreatedNNC          36m   dnc-rc/node-reconciler                                        Created NodeNetworkConfig aks-nodepool1-13736567-vmss000002
  Normal   RegisteredNode      36m   node-controller                                               Node aks-nodepool1-13736567-vmss000002 event: Registered Node aks-nodepool1-13736567-vmss000002 in Controller
  Warning  CoreDNSUnreachable  35m   dns-problem-monitor                                           dns test to coredns:10.0.0.10 over udp failed after 2 attempts
  Normal   NoVMEventScheduled  35m   custom-scheduledevents-consolidated-condition-plugin-monitor  Node condition VMEventScheduled is now: Unknown, reason: NoVMEventScheduled, message: "Unable to verify scheduled events (IMDS unavailable)"
  Normal   NoVMEventScheduled  34m   custom-scheduledevents-consolidated-condition-plugin-monitor  Node condition VMEventScheduled is now: False, reason: NoVMEventScheduled, message: "VM has no scheduled event"
➜  argo-rollouts-and-observability git:(phase-2a-native-zero-downtime) ✗ 