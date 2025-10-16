use anyhow::Result;
use kube::Client;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tokio::process::Command;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MetricsSource {
    pub name: String,
    pub available: bool,
    pub endpoint: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MetricsCapabilities {
    pub metrics_server: bool,
    pub prometheus: bool,
    pub sources: Vec<MetricsSource>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NodeMetrics {
    pub name: String,
    pub cpu_usage: String,        // e.g., "250m" or "2"
    pub cpu_usage_cores: f64,     // Converted to cores
    pub memory_usage: String,      // e.g., "1024Mi" or "2Gi"
    pub memory_usage_bytes: u64,  // Converted to bytes
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PodMetrics {
    pub name: String,
    pub namespace: String,
    pub cpu_usage: String,
    pub cpu_usage_cores: f64,
    pub memory_usage: String,
    pub memory_usage_bytes: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClusterMetricsData {
    pub total_cpu_capacity: f64,
    pub total_cpu_allocatable: f64,
    pub total_cpu_usage: f64,
    pub cpu_usage_percent: f64,
    pub total_memory_capacity: u64,
    pub total_memory_allocatable: u64,
    pub total_memory_usage: u64,
    pub memory_usage_percent: f64,
    pub node_metrics: Vec<NodeMetrics>,
    pub top_pods_by_cpu: Vec<PodMetrics>,
    pub top_pods_by_memory: Vec<PodMetrics>,
}

/// Detect available metrics sources in the cluster
pub async fn detect_metrics_capabilities(client: Client) -> Result<MetricsCapabilities> {
    let mut capabilities = MetricsCapabilities {
        metrics_server: false,
        prometheus: false,
        sources: Vec::new(),
    };

    // Check for metrics-server (metrics.k8s.io API)
    if check_metrics_server_available().await {
        capabilities.metrics_server = true;
        capabilities.sources.push(MetricsSource {
            name: "Metrics Server".to_string(),
            available: true,
            endpoint: Some("metrics.k8s.io".to_string()),
        });
    }

    // Check for Prometheus
    if let Some(endpoint) = detect_prometheus(client.clone()).await {
        capabilities.prometheus = true;
        capabilities.sources.push(MetricsSource {
            name: "Prometheus".to_string(),
            available: true,
            endpoint: Some(endpoint),
        });
    }

    Ok(capabilities)
}

/// Check if metrics-server is available by trying to query it
async fn check_metrics_server_available() -> bool {
    let output = Command::new("kubectl")
        .args(&["top", "nodes", "--no-headers"])
        .output()
        .await;

    match output {
        Ok(result) => result.status.success(),
        Err(_) => false,
    }
}

/// Detect Prometheus service in the cluster
async fn detect_prometheus(client: Client) -> Option<String> {
    use k8s_openapi::api::core::v1::Service;
    use kube::api::{Api, ListParams};

    // Common Prometheus service patterns
    let patterns = vec![
        ("monitoring", "prometheus"),
        ("prometheus", "prometheus"),
        ("kube-prometheus", "prometheus"),
        ("default", "prometheus"),
    ];

    for (namespace, name_pattern) in patterns {
        let services: Api<Service> = Api::namespaced(client.clone(), namespace);
        if let Ok(list) = services.list(&ListParams::default()).await {
            for svc in list.items {
                if let Some(svc_name) = &svc.metadata.name {
                    if svc_name.contains(name_pattern) {
                        // Found a Prometheus service
                        let port = svc
                            .spec
                            .and_then(|spec| spec.ports)
                            .and_then(|ports| ports.first().map(|p| p.port))
                            .unwrap_or(9090);

                        return Some(format!("http://{}.{}.svc.cluster.local:{}", svc_name, namespace, port));
                    }
                }
            }
        }
    }

    None
}

/// Get node metrics using kubectl top nodes
pub async fn get_node_metrics() -> Result<Vec<NodeMetrics>> {
    let output = Command::new("kubectl")
        .args(&["top", "nodes", "--no-headers"])
        .output()
        .await?;

    if !output.status.success() {
        anyhow::bail!(
            "kubectl top nodes failed: {}",
            String::from_utf8_lossy(&output.stderr)
        );
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let mut metrics = Vec::new();

    for line in stdout.lines() {
        let parts: Vec<&str> = line.split_whitespace().collect();
        if parts.len() >= 5 {
            let name = parts[0].to_string();
            let cpu = parts[1].to_string();
            let _cpu_percent = parts[2];
            let memory = parts[3].to_string();
            let _memory_percent = parts[4];

            let cpu_cores = parse_cpu_to_cores(&cpu);
            let memory_bytes = parse_memory_to_bytes(&memory);

            metrics.push(NodeMetrics {
                name,
                cpu_usage: cpu,
                cpu_usage_cores: cpu_cores,
                memory_usage: memory,
                memory_usage_bytes: memory_bytes,
            });
        }
    }

    Ok(metrics)
}

/// Get pod metrics using kubectl top pods
pub async fn get_pod_metrics(namespace: Option<&str>) -> Result<Vec<PodMetrics>> {
    let mut args = vec!["top", "pods", "--no-headers"];

    if let Some(ns) = namespace {
        args.push("-n");
        args.push(ns);
    } else {
        args.push("--all-namespaces");
    }

    let output = Command::new("kubectl").args(&args).output().await?;

    if !output.status.success() {
        anyhow::bail!(
            "kubectl top pods failed: {}",
            String::from_utf8_lossy(&output.stderr)
        );
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let mut metrics = Vec::new();

    for line in stdout.lines() {
        let parts: Vec<&str> = line.split_whitespace().collect();

        // With --all-namespaces: NAMESPACE NAME CPU MEMORY
        // Without: NAME CPU MEMORY
        let (ns, name, cpu, memory) = if namespace.is_none() && parts.len() >= 4 {
            (parts[0], parts[1], parts[2], parts[3])
        } else if parts.len() >= 3 {
            (namespace.unwrap_or("default"), parts[0], parts[1], parts[2])
        } else {
            continue;
        };

        let cpu_cores = parse_cpu_to_cores(cpu);
        let memory_bytes = parse_memory_to_bytes(memory);

        metrics.push(PodMetrics {
            name: name.to_string(),
            namespace: ns.to_string(),
            cpu_usage: cpu.to_string(),
            cpu_usage_cores: cpu_cores,
            memory_usage: memory.to_string(),
            memory_usage_bytes: memory_bytes,
        });
    }

    Ok(metrics)
}

/// Get comprehensive cluster metrics
pub async fn get_cluster_metrics(client: Client) -> Result<ClusterMetricsData> {
    use k8s_openapi::api::core::v1::Node;
    use kube::api::{Api, ListParams};

    // Get node capacity and allocatable from Kubernetes API
    let nodes: Api<Node> = Api::all(client);
    let node_list = nodes.list(&ListParams::default()).await?;

    let mut total_cpu_capacity = 0.0;
    let mut total_cpu_allocatable = 0.0;
    let mut total_memory_capacity = 0u64;
    let mut total_memory_allocatable = 0u64;

    for node in node_list.items {
        if let Some(status) = node.status {
            if let Some(capacity) = status.capacity {
                if let Some(cpu) = capacity.get("cpu") {
                    total_cpu_capacity += parse_cpu_to_cores(&cpu.0);
                }
                if let Some(memory) = capacity.get("memory") {
                    total_memory_capacity += parse_memory_to_bytes(&memory.0);
                }
            }
            if let Some(allocatable) = status.allocatable {
                if let Some(cpu) = allocatable.get("cpu") {
                    total_cpu_allocatable += parse_cpu_to_cores(&cpu.0);
                }
                if let Some(memory) = allocatable.get("memory") {
                    total_memory_allocatable += parse_memory_to_bytes(&memory.0);
                }
            }
        }
    }

    // Get actual usage from metrics-server
    let node_metrics = get_node_metrics().await.unwrap_or_default();
    let pod_metrics = get_pod_metrics(None).await.unwrap_or_default();

    let total_cpu_usage: f64 = node_metrics.iter().map(|n| n.cpu_usage_cores).sum();
    let total_memory_usage: u64 = node_metrics.iter().map(|n| n.memory_usage_bytes).sum();

    let cpu_usage_percent = if total_cpu_allocatable > 0.0 {
        (total_cpu_usage / total_cpu_allocatable) * 100.0
    } else {
        0.0
    };

    let memory_usage_percent = if total_memory_allocatable > 0 {
        (total_memory_usage as f64 / total_memory_allocatable as f64) * 100.0
    } else {
        0.0
    };

    // Get top consumers
    let mut top_pods_by_cpu = pod_metrics.clone();
    top_pods_by_cpu.sort_by(|a, b| b.cpu_usage_cores.partial_cmp(&a.cpu_usage_cores).unwrap());
    top_pods_by_cpu.truncate(10);

    let mut top_pods_by_memory = pod_metrics;
    top_pods_by_memory.sort_by(|a, b| b.memory_usage_bytes.cmp(&a.memory_usage_bytes));
    top_pods_by_memory.truncate(10);

    Ok(ClusterMetricsData {
        total_cpu_capacity,
        total_cpu_allocatable,
        total_cpu_usage,
        cpu_usage_percent,
        total_memory_capacity,
        total_memory_allocatable,
        total_memory_usage,
        memory_usage_percent,
        node_metrics,
        top_pods_by_cpu,
        top_pods_by_memory,
    })
}

/// Parse CPU string to cores (e.g., "250m" -> 0.25, "2" -> 2.0)
fn parse_cpu_to_cores(cpu: &str) -> f64 {
    if cpu.ends_with('m') {
        cpu.trim_end_matches('m')
            .parse::<f64>()
            .unwrap_or(0.0)
            / 1000.0
    } else {
        cpu.parse::<f64>().unwrap_or(0.0)
    }
}

/// Parse memory string to bytes (e.g., "1024Mi" -> bytes, "2Gi" -> bytes)
fn parse_memory_to_bytes(memory: &str) -> u64 {
    let memory = memory.trim();

    if memory.ends_with("Ki") {
        memory
            .trim_end_matches("Ki")
            .parse::<u64>()
            .unwrap_or(0)
            * 1024
    } else if memory.ends_with("Mi") {
        memory
            .trim_end_matches("Mi")
            .parse::<u64>()
            .unwrap_or(0)
            * 1024
            * 1024
    } else if memory.ends_with("Gi") {
        memory
            .trim_end_matches("Gi")
            .parse::<u64>()
            .unwrap_or(0)
            * 1024
            * 1024
            * 1024
    } else if memory.ends_with("Ti") {
        memory
            .trim_end_matches("Ti")
            .parse::<u64>()
            .unwrap_or(0)
            * 1024
            * 1024
            * 1024
            * 1024
    } else {
        // Assume bytes
        memory.parse::<u64>().unwrap_or(0)
    }
}
