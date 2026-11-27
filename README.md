

- readme file related to what we created for phase 1

- other things we observed - 
- we set up replicas to 2 for few services - this way k8s was totally using 3 nodes even with less CPU and memory utilization - reasone the CPU and memory utilization request was set more then needed 
- how to resolve this issue
- NOTE: we do not remove entire cpu and memory req and limit from the ymals
- first check the pod to pod actual cup and memory utilization while k6 is simulating some traffic - kubectl top pods --sort-by=cpu