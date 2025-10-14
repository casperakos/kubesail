use anyhow::Result;
use chrono::{DateTime, Utc};
use k8s_openapi::api::apps::v1::Deployment;
use k8s_openapi::api::core::v1::{Namespace, Pod, Service};
use k8s_openapi::api::networking::v1::Ingress;
use kube::api::{Api, ListParams, LogParams};
use kube::{Client, ResourceExt};
use std::time::SystemTime;

use crate::types::{DeploymentInfo, IngressInfo, IstioVirtualServiceInfo, IstioGatewayInfo, GatewayServer, LogEntry, NamespaceInfo, PodInfo, ServiceInfo};

pub async fn list_namespaces(client: Client) -> Result<Vec<NamespaceInfo>> {
    let namespaces: Api<Namespace> = Api::all(client);
    let lp = ListParams::default();
    let namespace_list = namespaces.list(&lp).await?;

    let mut result = Vec::new();

    for ns in namespace_list {
        let name = ns.metadata.name.unwrap_or_default();
        let status = ns
            .status
            .as_ref()
            .and_then(|s| s.phase.as_ref())
            .map(|p| p.to_string())
            .unwrap_or_else(|| "Unknown".to_string());

        let age = ns
            .metadata
            .creation_timestamp
            .as_ref()
            .map(|ts| format_age(&ts.0))
            .unwrap_or_else(|| "Unknown".to_string());

        result.push(NamespaceInfo { name, status, age });
    }

    Ok(result)
}

pub async fn list_pods(client: Client, namespace: &str) -> Result<Vec<PodInfo>> {
    let pods: Api<Pod> = Api::namespaced(client, namespace);
    let lp = ListParams::default();
    let pod_list = pods.list(&lp).await?;

    let mut result = Vec::new();

    for pod in pod_list {
        let name = pod.metadata.name.unwrap_or_default();
        let namespace = pod.metadata.namespace.unwrap_or_default();

        let status = pod
            .status
            .as_ref()
            .and_then(|s| s.phase.as_ref())
            .map(|p| p.to_string())
            .unwrap_or_else(|| "Unknown".to_string());

        let container_statuses = pod
            .status
            .as_ref()
            .and_then(|s| s.container_statuses.as_ref());

        let ready_containers = container_statuses
            .map(|cs| cs.iter().filter(|c| c.ready).count())
            .unwrap_or(0);

        let total_containers = container_statuses.map(|cs| cs.len()).unwrap_or(0);

        let ready = format!("{}/{}", ready_containers, total_containers);

        let restarts = container_statuses
            .map(|cs| cs.iter().map(|c| c.restart_count).sum())
            .unwrap_or(0);

        let age = pod
            .metadata
            .creation_timestamp
            .as_ref()
            .map(|ts| format_age(&ts.0))
            .unwrap_or_else(|| "Unknown".to_string());

        let node = pod.spec.as_ref().and_then(|s| s.node_name.clone());

        let ip = pod.status.as_ref().and_then(|s| s.pod_ip.clone());

        result.push(PodInfo {
            name,
            namespace,
            status,
            ready,
            restarts,
            age,
            node,
            ip,
        });
    }

    Ok(result)
}

pub async fn list_deployments(client: Client, namespace: &str) -> Result<Vec<DeploymentInfo>> {
    let deployments: Api<Deployment> = Api::namespaced(client, namespace);
    let lp = ListParams::default();
    let deployment_list = deployments.list(&lp).await?;

    let mut result = Vec::new();

    for deployment in deployment_list {
        let name = deployment.metadata.name.unwrap_or_default();
        let namespace = deployment.metadata.namespace.unwrap_or_default();

        let status = deployment.status.as_ref();

        let ready_replicas = status.and_then(|s| s.ready_replicas).unwrap_or(0);
        let replicas = deployment.spec.as_ref().and_then(|s| s.replicas).unwrap_or(0);

        let ready = format!("{}/{}", ready_replicas, replicas);

        let up_to_date = status.and_then(|s| s.updated_replicas).unwrap_or(0);
        let available = status.and_then(|s| s.available_replicas).unwrap_or(0);

        let age = deployment
            .metadata
            .creation_timestamp
            .as_ref()
            .map(|ts| format_age(&ts.0))
            .unwrap_or_else(|| "Unknown".to_string());

        result.push(DeploymentInfo {
            name,
            namespace,
            ready,
            up_to_date,
            available,
            age,
        });
    }

    Ok(result)
}

pub async fn list_services(client: Client, namespace: &str) -> Result<Vec<ServiceInfo>> {
    let services: Api<Service> = Api::namespaced(client, namespace);
    let lp = ListParams::default();
    let service_list = services.list(&lp).await?;

    let mut result = Vec::new();

    for service in service_list {
        let name = service.metadata.name.unwrap_or_default();
        let namespace = service.metadata.namespace.unwrap_or_default();

        let spec = service.spec.as_ref();

        let service_type = spec
            .and_then(|s| s.type_.as_ref())
            .map(|t| t.to_string())
            .unwrap_or_else(|| "ClusterIP".to_string());

        let cluster_ip = spec
            .and_then(|s| s.cluster_ip.as_ref())
            .map(|ip| ip.to_string())
            .unwrap_or_else(|| "None".to_string());

        let external_ip = spec
            .and_then(|s| s.external_ips.as_ref())
            .and_then(|ips| ips.first())
            .map(|ip| ip.to_string());

        let ports = spec
            .and_then(|s| s.ports.as_ref())
            .map(|ports| {
                ports
                    .iter()
                    .map(|p| format!("{}/{}", p.port, p.protocol.as_ref().unwrap_or(&"TCP".to_string())))
                    .collect::<Vec<_>>()
                    .join(",")
            })
            .unwrap_or_else(|| "None".to_string());

        let age = service
            .metadata
            .creation_timestamp
            .as_ref()
            .map(|ts| format_age(&ts.0))
            .unwrap_or_else(|| "Unknown".to_string());

        result.push(ServiceInfo {
            name,
            namespace,
            service_type,
            cluster_ip,
            external_ip,
            ports,
            age,
        });
    }

    Ok(result)
}

pub async fn get_pod_logs(
    client: Client,
    namespace: &str,
    pod_name: &str,
    container: Option<&str>,
    tail_lines: Option<i64>,
) -> Result<Vec<LogEntry>> {
    let pods: Api<Pod> = Api::namespaced(client, namespace);

    let mut log_params = LogParams::default();
    log_params.timestamps = true;

    if let Some(lines) = tail_lines {
        log_params.tail_lines = Some(lines);
    }

    if let Some(container_name) = container {
        log_params.container = Some(container_name.to_string());
    }

    let logs = pods.logs(pod_name, &log_params).await?;

    let mut result = Vec::new();

    for line in logs.lines() {
        let (timestamp, message) = if let Some(space_idx) = line.find(' ') {
            let ts = &line[..space_idx];
            let msg = &line[space_idx + 1..];
            (Some(ts.to_string()), msg.to_string())
        } else {
            (None, line.to_string())
        };

        result.push(LogEntry {
            timestamp,
            message,
            pod_name: pod_name.to_string(),
        });
    }

    Ok(result)
}

pub async fn delete_pod(client: Client, namespace: &str, pod_name: &str) -> Result<()> {
    let pods: Api<Pod> = Api::namespaced(client, namespace);
    pods.delete(pod_name, &Default::default()).await?;
    Ok(())
}

pub async fn scale_deployment(
    client: Client,
    namespace: &str,
    deployment_name: &str,
    replicas: i32,
) -> Result<()> {
    let deployments: Api<Deployment> = Api::namespaced(client, namespace);

    let patch = serde_json::json!({
        "spec": {
            "replicas": replicas
        }
    });

    deployments
        .patch(
            deployment_name,
            &kube::api::PatchParams::default(),
            &kube::api::Patch::Strategic(&patch),
        )
        .await?;

    Ok(())
}

fn format_age(timestamp: &DateTime<Utc>) -> String {
    let now = SystemTime::now();
    let now: DateTime<Utc> = now.into();

    let duration = now.signed_duration_since(*timestamp);

    let days = duration.num_days();
    if days > 0 {
        return format!("{}d", days);
    }

    let hours = duration.num_hours();
    if hours > 0 {
        return format!("{}h", hours);
    }

    let minutes = duration.num_minutes();
    if minutes > 0 {
        return format!("{}m", minutes);
    }

    format!("{}s", duration.num_seconds())
}

pub async fn list_ingresses(client: Client, namespace: &str) -> Result<Vec<IngressInfo>> {
    let ingresses: Api<Ingress> = Api::namespaced(client, namespace);
    let lp = ListParams::default();
    let ingress_list = ingresses.list(&lp).await?;

    let mut result = Vec::new();

    for ingress in ingress_list {
        let name = ingress.metadata.name.unwrap_or_default();
        let namespace = ingress.metadata.namespace.unwrap_or_default();

        let class = ingress.spec.as_ref()
            .and_then(|s| s.ingress_class_name.clone());

        let mut hosts = Vec::new();
        let mut has_tls = false;

        if let Some(spec) = ingress.spec.as_ref() {
            if let Some(rules) = &spec.rules {
                for rule in rules {
                    if let Some(host) = &rule.host {
                        hosts.push(host.clone());
                    }
                }
            }

            if let Some(tls) = &spec.tls {
                has_tls = !tls.is_empty();
            }
        }

        let addresses = ingress.status
            .as_ref()
            .and_then(|s| s.load_balancer.as_ref())
            .and_then(|lb| lb.ingress.as_ref())
            .map(|ingress_list| {
                ingress_list
                    .iter()
                    .filter_map(|ing| ing.ip.clone().or_else(|| ing.hostname.clone()))
                    .collect()
            })
            .unwrap_or_default();

        let age = ingress
            .metadata
            .creation_timestamp
            .as_ref()
            .map(|ts| format_age(&ts.0))
            .unwrap_or_else(|| "Unknown".to_string());

        result.push(IngressInfo {
            name,
            namespace,
            class,
            hosts,
            addresses,
            age,
            tls: has_tls,
        });
    }

    Ok(result)
}

pub async fn list_istio_virtual_services(
    client: Client,
    namespace: &str,
) -> Result<Vec<IstioVirtualServiceInfo>> {
    use kube::api::DynamicObject;

    let api: Api<DynamicObject> = Api::namespaced_with(
        client,
        namespace,
        &kube::discovery::ApiResource {
            group: "networking.istio.io".to_string(),
            version: "v1beta1".to_string(),
            api_version: "networking.istio.io/v1beta1".to_string(),
            kind: "VirtualService".to_string(),
            plural: "virtualservices".to_string(),
        },
    );

    let lp = ListParams::default();
    let vs_list = match api.list(&lp).await {
        Ok(list) => list,
        Err(_) => return Ok(Vec::new()), // Istio not installed
    };

    let mut result = Vec::new();

    for vs in vs_list {
        let name = vs.name_any();
        let namespace = vs.namespace().unwrap_or_default();

        let spec = vs.data.get("spec");
        let hosts = spec
            .and_then(|s| s.get("hosts"))
            .and_then(|h| h.as_array())
            .map(|arr| {
                arr.iter()
                    .filter_map(|v| v.as_str().map(String::from))
                    .collect()
            })
            .unwrap_or_default();

        let gateways = spec
            .and_then(|s| s.get("gateways"))
            .and_then(|g| g.as_array())
            .map(|arr| {
                arr.iter()
                    .filter_map(|v| v.as_str().map(String::from))
                    .collect()
            })
            .unwrap_or_default();

        let age = vs
            .metadata
            .creation_timestamp
            .as_ref()
            .map(|ts| format_age(&ts.0))
            .unwrap_or_else(|| "Unknown".to_string());

        result.push(IstioVirtualServiceInfo {
            name,
            namespace,
            hosts,
            gateways,
            age,
        });
    }

    Ok(result)
}

pub async fn list_istio_gateways(
    client: Client,
    namespace: &str,
) -> Result<Vec<IstioGatewayInfo>> {
    use kube::api::DynamicObject;

    let api: Api<DynamicObject> = Api::namespaced_with(
        client,
        namespace,
        &kube::discovery::ApiResource {
            group: "networking.istio.io".to_string(),
            version: "v1beta1".to_string(),
            api_version: "networking.istio.io/v1beta1".to_string(),
            kind: "Gateway".to_string(),
            plural: "gateways".to_string(),
        },
    );

    let lp = ListParams::default();
    let gw_list = match api.list(&lp).await {
        Ok(list) => list,
        Err(_) => return Ok(Vec::new()), // Istio not installed
    };

    let mut result = Vec::new();

    for gw in gw_list {
        let name = gw.name_any();
        let namespace = gw.namespace().unwrap_or_default();

        let spec = gw.data.get("spec");
        let servers_data = spec
            .and_then(|s| s.get("servers"))
            .and_then(|s| s.as_array());

        let mut servers = Vec::new();
        if let Some(servers_arr) = servers_data {
            for server in servers_arr {
                let port = server
                    .get("port")
                    .and_then(|p| p.get("number"))
                    .and_then(|n| n.as_u64())
                    .unwrap_or(0) as u16;

                let protocol = server
                    .get("port")
                    .and_then(|p| p.get("protocol"))
                    .and_then(|p| p.as_str())
                    .unwrap_or("HTTP")
                    .to_string();

                let hosts = server
                    .get("hosts")
                    .and_then(|h| h.as_array())
                    .map(|arr| {
                        arr.iter()
                            .filter_map(|v| v.as_str().map(String::from))
                            .collect()
                    })
                    .unwrap_or_default();

                servers.push(GatewayServer {
                    port,
                    protocol,
                    hosts,
                });
            }
        }

        let age = gw
            .metadata
            .creation_timestamp
            .as_ref()
            .map(|ts| format_age(&ts.0))
            .unwrap_or_else(|| "Unknown".to_string());

        result.push(IstioGatewayInfo {
            name,
            namespace,
            servers,
            age,
        });
    }

    Ok(result)
}

pub async fn get_resource_yaml(
    client: Client,
    resource_type: &str,
    namespace: &str,
    name: &str,
) -> Result<String> {
    let yaml = match resource_type {
        "pod" => {
            let pods: Api<Pod> = Api::namespaced(client, namespace);
            let pod = pods.get(name).await?;
            serde_yaml::to_string(&pod)?
        }
        "deployment" => {
            let deployments: Api<Deployment> = Api::namespaced(client, namespace);
            let deployment = deployments.get(name).await?;
            serde_yaml::to_string(&deployment)?
        }
        "service" => {
            let services: Api<Service> = Api::namespaced(client, namespace);
            let service = services.get(name).await?;
            serde_yaml::to_string(&service)?
        }
        "ingress" => {
            let ingresses: Api<Ingress> = Api::namespaced(client, namespace);
            let ingress = ingresses.get(name).await?;
            serde_yaml::to_string(&ingress)?
        }
        _ => return Err(anyhow::anyhow!("Unsupported resource type: {}", resource_type)),
    };

    Ok(yaml)
}
