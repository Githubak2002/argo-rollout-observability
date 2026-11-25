#### Azure student sub cost on 23 Nov 2026 - 2753 Rs

#### Check for total regional vCPU Standard DSv3
➜  microservice_demo_k8s git:(main) ✗ az account set --subscription d5fdfa5d-cca0-4d0e-abbc-65070df73073                                    
➜  microservice_demo_k8s git:(main) ✗ export RG_NAME="rg-ak-prod-poc"
export CLUSTER_NAME="ak-poc-aks"
export LOCATION="centralindia" 
➜  microservice_demo_k8s git:(main) ✗ az vm list-usage --location "$LOCATION" --output table | grep -E "Total Regional vCPUs|Standard DSv3|Standard B"


#### create a RG
az group create \
  --name "$RG_NAME" \
  --location "$LOCATION" \
  --tags purpose=POC

#### AKS
az aks create \
  --resource-group "$RG_NAME" \
  --name "ak-poc-aks" \
  --location "$LOCATION" \
  --tier free \
  --node-vm-size Standard_B2s_v2 \
  --node-count 1 \
  --enable-cluster-autoscaler \
  --min-count 1 \
  --max-count 3 \
  --vm-set-type VirtualMachineScaleSets \
  --load-balancer-sku standard \
  --network-plugin azure \
  --network-plugin-mode overlay \
  --node-osdisk-type Managed \
  --node-osdisk-size 50 \
  --enable-oidc-issuer \
  --enable-workload-identity \
  --no-ssh-key \
  --tags purpose=POC

#### get AKS creds
az aks get-credentials \
  --resource-group "$RG_NAME" \
  --name "$CLUSTER_NAME" \
  --overwrite-existing

kubectl get nodes -o wide

#### Pause compute billing when done for the day
az aks stop --resource-group "$RG_NAME" --name "$CLUSTER_NAME"

#### Resume next time you work on the project
az aks start --resource-group "$RG_NAME" --name "$CLUSTER_NAME"