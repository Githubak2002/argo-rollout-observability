# Deploy Online Boutique to AKS with Azure CLI

Create an Azure Kubernetes Service (AKS) cluster for the Online Boutique proof of concept, deploy the application, and stop the cluster between sessions to save on compute costs.

## Prerequisites

- A Bash or Zsh shell with Azure CLI and `kubectl` installed.
- An Azure subscription with permission to create a resource group and AKS cluster and retrieve cluster credentials.
- A local copy of this repository. Run the commands from the repository root.

## 1. Select an Azure subscription

Sign in, list the subscriptions you can access, and replace the placeholder with your subscription name or ID.

```bash
az login
az account list --output table
az account set --subscription "<subscription-name-or-id>"
az account show --query '{name:name, id:id}' --output table
```

## 2. Set the cluster configuration and check quota

Choose a resource group name, cluster name, region, and VM size for your subscription. Use the same values throughout the guide.

```bash
export RG_NAME="jarvis-poc-rg"
export CLUSTER_NAME="jarvis-poc-aks"
export LOCATION="centralindia"
export VM_SIZE="Standard_D2s_v3"
```

Check that the example VM size is available to your subscription in the chosen region. In the usage table, check both **Total Regional vCPUs** and the quota for the selected VM family. The example uses four vCPUs per node, so the pool needs eight available vCPUs to start and twelve to scale to three nodes.

```bash
az vm list-skus --location "$LOCATION" --resource-type virtualMachines \
  --size "$VM_SIZE" --output table
az vm list-usage --location "$LOCATION" --output table
```

If you change the VM size, choose one that meets AKS system node pool requirements. Microsoft specifies at least four vCPUs and 4 GB of memory per node and excludes B-series VMs. [AKS system node pool requirements](https://learn.microsoft.com/en-us/azure/aks/use-system-pools) · [Azure VM quota guidance](https://learn.microsoft.com/azure/virtual-machines/quotas)

## 3. Create the resource group and AKS cluster

This example uses the AKS Free tier, Azure CNI Overlay networking, and a system node pool that starts with two nodes and can scale to three. It also enables the OIDC issuer and Workload Identity. Azure can still charge for resources such as worker VMs, disks, and networking. [AKS pricing](https://azure.microsoft.com/en-us/pricing/details/kubernetes-service/)

```bash
az group create \
  --name "$RG_NAME" \
  --location "$LOCATION" \
  --tags purpose=POC

az aks create \
  --resource-group "$RG_NAME" \
  --name "$CLUSTER_NAME" \
  --location "$LOCATION" \
  --tier free \
  --node-vm-size "$VM_SIZE" \
  --node-count 1 \
  --enable-cluster-autoscaler \
  --min-count 1 \
  --max-count 3 \
  --vm-set-type VirtualMachineScaleSets \
  --load-balancer-sku standard \
  --network-plugin azure \
  --network-plugin-mode overlay \
  --node-osdisk-type Managed \
  --enable-oidc-issuer \
  --enable-workload-identity \
  --no-ssh-key \
  --tags purpose=POC
```

## 4. Connect to the cluster

Download credentials to your local kubeconfig and verify that the nodes report `Ready`.

```bash
az aks get-credentials \
  --resource-group "$RG_NAME" \
  --name "$CLUSTER_NAME" \
  --context "$CLUSTER_NAME"

kubectl --context "$CLUSTER_NAME" get nodes -o wide
```

## 5. Deploy and verify Online Boutique

```bash
kubectl --context "$CLUSTER_NAME" apply -f release/ak-k8s-manifests.yaml
kubectl --context "$CLUSTER_NAME" get deployments,pods
kubectl --context "$CLUSTER_NAME" get service frontend-external
```

Wait for the Deployments to report ready replicas and for `frontend-external` to receive an external address. The load balancer may take a few minutes to provision. Open `http://<external-ip>/` to verify that the storefront loads. [Deployment manifest](../release/ak-k8s-manifests.yaml)

## 6. Stop and restart the cluster

Stop the proof-of-concept cluster between sessions to pause compute charges. Retained resources such as managed disks can still incur charges. [AKS stop and start guidance](https://learn.microsoft.com/en-us/azure/aks/start-stop-cluster?tabs=azure-cli)

```bash
az aks stop --resource-group "$RG_NAME" --name "$CLUSTER_NAME"
```

When you return, select the same subscription and set the variables again if you opened a new shell. Start the cluster and check its nodes.

```bash
az aks start --resource-group "$RG_NAME" --name "$CLUSTER_NAME"
kubectl --context "$CLUSTER_NAME" get nodes -o wide
```
