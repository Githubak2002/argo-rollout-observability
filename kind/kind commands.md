## command to get list of clusters
kind get clusters

## Load a local image into a Kind cluster
kind load docker-image <image-name>:<tag> --name <cluster-name>

kind load docker-image akdevanurag/k8s_demo:frontend
kind load docker-image akdevanurag/k8s_demo:checkoutservice
kind load docker-image akdevanurag/k8s_demo:cartservice

## Verify the image exists on the Kind node
kind get nodes
docker exec k8s-control-plane crictl images