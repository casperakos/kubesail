use anyhow::Result;
use chrono::{DateTime, Utc};
use k8s_openapi::api::apps::v1::{Deployment, StatefulSet, DaemonSet};
use k8s_openapi::api::batch::v1::{Job, CronJob};
use k8s_openapi::api::core::v1::{Namespace, Pod, Service, ConfigMap, Secret, Node, Event, PersistentVolume, PersistentVolumeClaim, ServiceAccount};
use k8s_openapi::api::networking::v1::Ingress;
use k8s_openapi::api::rbac::v1::{Role, RoleBinding, ClusterRole, ClusterRoleBinding};
use k8s_openapi::apiextensions_apiserver::pkg::apis::apiextensions::v1::CustomResourceDefinition;
use kube::api::{Api, ListParams, LogParams, DynamicObject};
use kube::discovery::{ApiResource, Scope};
use kube::{Client, ResourceExt};
use std::time::SystemTime;
use std::collections::HashMap;

use crate::types::{
    DeploymentInfo, IngressInfo, IstioVirtualServiceInfo, IstioGatewayInfo, GatewayServer,
    LogEntry, NamespaceInfo, PodInfo, ServiceInfo, ConfigMapInfo, SecretInfo,
    StatefulSetInfo, DaemonSetInfo, JobInfo, CronJobInfo, NodeInfo, EventInfo,
    PersistentVolumeInfo, PersistentVolumeClaimInfo, RoleInfo, RoleBindingInfo,
    ClusterRoleInfo, ClusterRoleBindingInfo, ServiceAccountInfo, SubjectInfo,
    CRDInfo, CustomResourceInfo, CNPGConnectionDetails,
};

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
    let pods: Api<Pod> = if namespace.is_empty() {
        Api::all(client)
    } else {
        Api::namespaced(client, namespace)
    };
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

        // Extract all container ports
        let ports: Vec<i32> = pod
            .spec
            .as_ref()
            .map(|s| {
                s.containers
                    .iter()
                    .flat_map(|c| {
                        c.ports.as_ref().map(|ports| {
                            ports.iter().map(|p| p.container_port).collect::<Vec<_>>()
                        }).unwrap_or_default()
                    })
                    .collect()
            })
            .unwrap_or_default();

        // Extract labels from pod metadata (convert BTreeMap to HashMap)
        let labels = pod.metadata.labels.as_ref().map(|l| {
            l.iter().map(|(k, v)| (k.clone(), v.clone())).collect()
        });

        // Extract annotations from pod metadata (convert BTreeMap to HashMap)
        let annotations = pod.metadata.annotations.as_ref().map(|a| {
            a.iter().map(|(k, v)| (k.clone(), v.clone())).collect()
        });

        result.push(PodInfo {
            name,
            namespace,
            status,
            ready,
            restarts,
            age,
            node,
            ip,
            ports,
            labels,
            annotations,
        });
    }

    Ok(result)
}

pub async fn list_deployments(client: Client, namespace: &str) -> Result<Vec<DeploymentInfo>> {
    let deployments: Api<Deployment> = if namespace.is_empty() {
        Api::all(client)
    } else {
        Api::namespaced(client, namespace)
    };
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
    let services: Api<Service> = if namespace.is_empty() {
        Api::all(client)
    } else {
        Api::namespaced(client, namespace)
    };
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

        let selector = spec
            .and_then(|s| s.selector.as_ref())
            .map(|sel| {
                sel.iter().map(|(k, v)| (k.clone(), v.clone())).collect()
            });

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
            selector,
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

pub async fn get_pod_containers(client: Client, namespace: &str, pod_name: &str) -> Result<Vec<String>> {
    let pods: Api<Pod> = Api::namespaced(client, namespace);
    let pod = pods.get(pod_name).await?;

    let containers = pod
        .spec
        .ok_or_else(|| anyhow::anyhow!("Pod has no spec"))?
        .containers
        .iter()
        .map(|c| c.name.clone())
        .collect();

    Ok(containers)
}

pub async fn delete_pod(client: Client, namespace: &str, pod_name: &str) -> Result<()> {
    let pods: Api<Pod> = Api::namespaced(client, namespace);
    pods.delete(pod_name, &Default::default()).await?;
    Ok(())
}

pub async fn delete_deployment(
    client: Client,
    namespace: &str,
    deployment_name: &str,
) -> Result<()> {
    let deployments: Api<Deployment> = Api::namespaced(client, namespace);
    deployments
        .delete(deployment_name, &Default::default())
        .await?;
    Ok(())
}

pub async fn delete_service(
    client: Client,
    namespace: &str,
    service_name: &str,
) -> Result<()> {
    let services: Api<k8s_openapi::api::core::v1::Service> = Api::namespaced(client, namespace);
    services
        .delete(service_name, &Default::default())
        .await?;
    Ok(())
}

pub async fn delete_configmap(
    client: Client,
    namespace: &str,
    configmap_name: &str,
) -> Result<()> {
    let configmaps: Api<k8s_openapi::api::core::v1::ConfigMap> = Api::namespaced(client, namespace);
    configmaps
        .delete(configmap_name, &Default::default())
        .await?;
    Ok(())
}

pub async fn delete_secret(
    client: Client,
    namespace: &str,
    secret_name: &str,
) -> Result<()> {
    let secrets: Api<k8s_openapi::api::core::v1::Secret> = Api::namespaced(client, namespace);
    secrets
        .delete(secret_name, &Default::default())
        .await?;
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

pub async fn restart_deployment(
    client: Client,
    namespace: &str,
    deployment_name: &str,
) -> Result<()> {
    let deployments: Api<Deployment> = Api::namespaced(client, namespace);

    // Trigger a rollout restart by adding/updating the restart annotation
    let now = chrono::Utc::now().to_rfc3339();
    let patch = serde_json::json!({
        "spec": {
            "template": {
                "metadata": {
                    "annotations": {
                        "kubectl.kubernetes.io/restartedAt": now
                    }
                }
            }
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

pub async fn scale_statefulset(
    client: Client,
    namespace: &str,
    statefulset_name: &str,
    replicas: i32,
) -> Result<()> {
    let statefulsets: Api<StatefulSet> = Api::namespaced(client, namespace);

    let patch = serde_json::json!({
        "spec": {
            "replicas": replicas
        }
    });

    statefulsets
        .patch(
            statefulset_name,
            &kube::api::PatchParams::default(),
            &kube::api::Patch::Strategic(&patch),
        )
        .await?;

    Ok(())
}

pub async fn restart_statefulset(
    client: Client,
    namespace: &str,
    statefulset_name: &str,
) -> Result<()> {
    let statefulsets: Api<StatefulSet> = Api::namespaced(client, namespace);

    // Trigger a rollout restart by adding/updating the restart annotation
    let now = chrono::Utc::now().to_rfc3339();
    let patch = serde_json::json!({
        "spec": {
            "template": {
                "metadata": {
                    "annotations": {
                        "kubectl.kubernetes.io/restartedAt": now
                    }
                }
            }
        }
    });

    statefulsets
        .patch(
            statefulset_name,
            &kube::api::PatchParams::default(),
            &kube::api::Patch::Strategic(&patch),
        )
        .await?;

    Ok(())
}

pub async fn delete_statefulset(
    client: Client,
    namespace: &str,
    statefulset_name: &str,
) -> Result<()> {
    let statefulsets: Api<StatefulSet> = Api::namespaced(client, namespace);
    statefulsets
        .delete(statefulset_name, &Default::default())
        .await?;
    Ok(())
}

pub async fn restart_daemonset(
    client: Client,
    namespace: &str,
    daemonset_name: &str,
) -> Result<()> {
    let daemonsets: Api<DaemonSet> = Api::namespaced(client, namespace);

    // Trigger a rollout restart by adding/updating the restart annotation
    let now = chrono::Utc::now().to_rfc3339();
    let patch = serde_json::json!({
        "spec": {
            "template": {
                "metadata": {
                    "annotations": {
                        "kubectl.kubernetes.io/restartedAt": now
                    }
                }
            }
        }
    });

    daemonsets
        .patch(
            daemonset_name,
            &kube::api::PatchParams::default(),
            &kube::api::Patch::Strategic(&patch),
        )
        .await?;

    Ok(())
}

pub async fn delete_daemonset(
    client: Client,
    namespace: &str,
    daemonset_name: &str,
) -> Result<()> {
    let daemonsets: Api<DaemonSet> = Api::namespaced(client, namespace);
    daemonsets
        .delete(daemonset_name, &Default::default())
        .await?;
    Ok(())
}

pub async fn delete_job(
    client: Client,
    namespace: &str,
    job_name: &str,
) -> Result<()> {
    let jobs: Api<Job> = Api::namespaced(client, namespace);
    jobs
        .delete(job_name, &Default::default())
        .await?;
    Ok(())
}

pub async fn suspend_cronjob(
    client: Client,
    namespace: &str,
    cronjob_name: &str,
) -> Result<()> {
    let cronjobs: Api<CronJob> = Api::namespaced(client, namespace);
    let patch = serde_json::json!({
        "spec": {
            "suspend": true
        }
    });
    cronjobs.patch(
        cronjob_name,
        &kube::api::PatchParams::default(),
        &kube::api::Patch::Strategic(&patch),
    ).await?;
    Ok(())
}

pub async fn resume_cronjob(
    client: Client,
    namespace: &str,
    cronjob_name: &str,
) -> Result<()> {
    let cronjobs: Api<CronJob> = Api::namespaced(client, namespace);
    let patch = serde_json::json!({
        "spec": {
            "suspend": false
        }
    });
    cronjobs.patch(
        cronjob_name,
        &kube::api::PatchParams::default(),
        &kube::api::Patch::Strategic(&patch),
    ).await?;
    Ok(())
}

pub async fn delete_cronjob(
    client: Client,
    namespace: &str,
    cronjob_name: &str,
) -> Result<()> {
    let cronjobs: Api<CronJob> = Api::namespaced(client, namespace);
    cronjobs.delete(cronjob_name, &Default::default()).await?;
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
    let ingresses: Api<Ingress> = if namespace.is_empty() {
        Api::all(client)
    } else {
        Api::namespaced(client, namespace)
    };
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
        let mut rules_info = Vec::new();

        if let Some(spec) = ingress.spec.as_ref() {
            if let Some(rules) = &spec.rules {
                for rule in rules {
                    let host = rule.host.clone().unwrap_or_else(|| "*".to_string());

                    if rule.host.is_some() {
                        hosts.push(host.clone());
                    }

                    let mut paths_info = Vec::new();
                    if let Some(http) = &rule.http {
                        for path_rule in &http.paths {
                            let path = path_rule.path.clone().unwrap_or_else(|| "/".to_string());
                            let path_type = path_rule.path_type.clone();

                            let (service, port) = if let Some(backend) = &path_rule.backend.service {
                                let svc_name = backend.name.clone();
                                let svc_port = if let Some(port) = &backend.port {
                                    if let Some(num) = port.number {
                                        num.to_string()
                                    } else if let Some(name) = &port.name {
                                        name.clone()
                                    } else {
                                        "unknown".to_string()
                                    }
                                } else {
                                    "unknown".to_string()
                                };
                                (svc_name, svc_port)
                            } else {
                                ("unknown".to_string(), "unknown".to_string())
                            };

                            paths_info.push(crate::types::IngressPath {
                                path,
                                path_type,
                                service,
                                port,
                            });
                        }
                    }

                    rules_info.push(crate::types::IngressRule {
                        host,
                        paths: paths_info,
                    });
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
            rules: rules_info,
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

        // Extract routing destinations from HTTP routes
        let mut routes = Vec::new();
        if let Some(http_routes) = spec.and_then(|s| s.get("http")).and_then(|h| h.as_array()) {
            for http_route in http_routes {
                // Extract match conditions
                let mut match_conditions = Vec::new();
                if let Some(matches) = http_route.get("match").and_then(|m| m.as_array()) {
                    for match_cond in matches {
                        let uri_prefix = match_cond
                            .get("uri")
                            .and_then(|u| u.get("prefix"))
                            .and_then(|p| p.as_str())
                            .map(String::from);

                        let uri_exact = match_cond
                            .get("uri")
                            .and_then(|u| u.get("exact"))
                            .and_then(|e| e.as_str())
                            .map(String::from);

                        let uri_regex = match_cond
                            .get("uri")
                            .and_then(|u| u.get("regex"))
                            .and_then(|r| r.as_str())
                            .map(String::from);

                        let headers = match_cond
                            .get("headers")
                            .and_then(|h| h.as_object())
                            .map(|obj| {
                                obj.keys()
                                    .map(|k| k.to_string())
                                    .collect::<Vec<_>>()
                            })
                            .unwrap_or_default();

                        match_conditions.push(crate::types::RouteMatch {
                            uri_prefix,
                            uri_exact,
                            uri_regex,
                            headers,
                        });
                    }
                }

                // If no match conditions, add a default one (catches all)
                if match_conditions.is_empty() {
                    match_conditions.push(crate::types::RouteMatch {
                        uri_prefix: Some("/".to_string()),
                        uri_exact: None,
                        uri_regex: None,
                        headers: Vec::new(),
                    });
                }

                // Extract route destinations
                if let Some(route_destinations) = http_route.get("route").and_then(|r| r.as_array()) {
                    for dest in route_destinations {
                        if let Some(destination) = dest.get("destination") {
                            let host = destination
                                .get("host")
                                .and_then(|h| h.as_str())
                                .unwrap_or("unknown")
                                .to_string();

                            let port = destination
                                .get("port")
                                .and_then(|p| p.get("number"))
                                .and_then(|n| n.as_u64())
                                .map(|n| n as u16);

                            let weight = dest
                                .get("weight")
                                .and_then(|w| w.as_u64())
                                .map(|w| w as u16);

                            routes.push(crate::types::VirtualServiceRoute {
                                match_conditions: match_conditions.clone(),
                                destination_host: host,
                                destination_port: port,
                                weight,
                            });
                        }
                    }
                }
            }
        }

        result.push(IstioVirtualServiceInfo {
            name,
            namespace,
            hosts,
            gateways,
            age,
            routes,
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
    let yaml = match resource_type.to_lowercase().as_str() {
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
        "configmap" => {
            let configmaps: Api<ConfigMap> = Api::namespaced(client, namespace);
            let cm = configmaps.get(name).await?;
            serde_yaml::to_string(&cm)?
        }
        "secret" => {
            let secrets: Api<Secret> = Api::namespaced(client, namespace);
            let secret = secrets.get(name).await?;
            serde_yaml::to_string(&secret)?
        }
        "statefulset" => {
            let statefulsets: Api<StatefulSet> = Api::namespaced(client, namespace);
            let sts = statefulsets.get(name).await?;
            serde_yaml::to_string(&sts)?
        }
        "daemonset" => {
            let daemonsets: Api<DaemonSet> = Api::namespaced(client, namespace);
            let ds = daemonsets.get(name).await?;
            serde_yaml::to_string(&ds)?
        }
        "job" => {
            let jobs: Api<Job> = Api::namespaced(client, namespace);
            let job = jobs.get(name).await?;
            serde_yaml::to_string(&job)?
        }
        "cronjob" => {
            let cronjobs: Api<CronJob> = Api::namespaced(client, namespace);
            let cj = cronjobs.get(name).await?;
            serde_yaml::to_string(&cj)?
        }
        "ingress" => {
            let ingresses: Api<Ingress> = Api::namespaced(client, namespace);
            let ingress = ingresses.get(name).await?;
            serde_yaml::to_string(&ingress)?
        }
        "persistentvolume" | "pv" => {
            let pvs: Api<PersistentVolume> = Api::all(client);
            let pv = pvs.get(name).await?;
            serde_yaml::to_string(&pv)?
        }
        "persistentvolumeclaim" | "pvc" => {
            let pvcs: Api<PersistentVolumeClaim> = Api::namespaced(client, namespace);
            let pvc = pvcs.get(name).await?;
            serde_yaml::to_string(&pvc)?
        }
        "role" => {
            let roles: Api<Role> = Api::namespaced(client, namespace);
            let role = roles.get(name).await?;
            serde_yaml::to_string(&role)?
        }
        "rolebinding" => {
            let rbs: Api<RoleBinding> = Api::namespaced(client, namespace);
            let rb = rbs.get(name).await?;
            serde_yaml::to_string(&rb)?
        }
        "clusterrole" => {
            let crs: Api<ClusterRole> = Api::all(client);
            let cr = crs.get(name).await?;
            serde_yaml::to_string(&cr)?
        }
        "clusterrolebinding" => {
            let crbs: Api<ClusterRoleBinding> = Api::all(client);
            let crb = crbs.get(name).await?;
            serde_yaml::to_string(&crb)?
        }
        "serviceaccount" => {
            let sas: Api<ServiceAccount> = Api::namespaced(client, namespace);
            let sa = sas.get(name).await?;
            serde_yaml::to_string(&sa)?
        }
        "node" => {
            let nodes: Api<Node> = Api::all(client);
            let node = nodes.get(name).await?;
            serde_yaml::to_string(&node)?
        }
        "namespace" | "ns" => {
            let namespaces: Api<Namespace> = Api::all(client);
            let ns = namespaces.get(name).await?;
            serde_yaml::to_string(&ns)?
        }
        _ => return Err(anyhow::anyhow!("Unsupported resource type: {}", resource_type)),
    };

    Ok(yaml)
}

pub async fn get_custom_resource_yaml(
    client: Client,
    group: &str,
    version: &str,
    plural: &str,
    name: &str,
    namespace: Option<&str>,
) -> Result<String> {
    let api_resource = ApiResource {
        group: group.to_string(),
        version: version.to_string(),
        api_version: if group.is_empty() {
            version.to_string()
        } else {
            format!("{}/{}", group, version)
        },
        kind: plural.to_string(),
        plural: plural.to_string(),
    };

    let api: Api<DynamicObject> = if let Some(ns) = namespace {
        Api::namespaced_with(client, ns, &api_resource)
    } else {
        Api::all_with(client, &api_resource)
    };

    let resource = api.get(name).await?;
    let yaml = serde_yaml::to_string(&resource)?;
    Ok(yaml)
}

pub async fn update_custom_resource_yaml(
    client: Client,
    group: &str,
    version: &str,
    plural: &str,
    name: &str,
    namespace: Option<&str>,
    yaml: &str,
) -> Result<()> {
    let api_resource = ApiResource {
        group: group.to_string(),
        version: version.to_string(),
        api_version: if group.is_empty() {
            version.to_string()
        } else {
            format!("{}/{}", group, version)
        },
        kind: plural.to_string(),
        plural: plural.to_string(),
    };

    let api: Api<DynamicObject> = if let Some(ns) = namespace {
        Api::namespaced_with(client, ns, &api_resource)
    } else {
        Api::all_with(client, &api_resource)
    };

    // Parse the YAML string to DynamicObject
    let resource: DynamicObject = serde_yaml::from_str(yaml)?;

    // Use replace to update the resource
    let pp = kube::api::PostParams::default();
    api.replace(name, &pp, &resource).await?;

    Ok(())
}

pub async fn describe_custom_resource(
    client: Client,
    group: &str,
    version: &str,
    plural: &str,
    name: &str,
    namespace: Option<&str>,
) -> Result<String> {
    use k8s_openapi::api::core::v1::Event;
    use kube::api::ListParams;

    let yaml = get_custom_resource_yaml(client.clone(), group, version, plural, name, namespace).await?;

    let mut description = String::new();
    description.push_str(&format!("Name: {}\n", name));
    if let Some(ns) = namespace {
        description.push_str(&format!("Namespace: {}\n", ns));
    }
    description.push_str(&format!("API Version: {}\n", if group.is_empty() {
        version.to_string()
    } else {
        format!("{}/{}", group, version)
    }));
    description.push_str("\n");
    description.push_str("Details:\n");
    description.push_str(&yaml);

    // Add Events section
    description.push_str("\n\nEvents:\n");
    let events: Api<Event> = if let Some(ns) = namespace {
        Api::namespaced(client, ns)
    } else {
        Api::all(client)
    };

    let event_lp = ListParams::default().fields(&format!("involvedObject.name={}", name));
    if let Ok(event_list) = events.list(&event_lp).await {
        if event_list.items.is_empty() {
            description.push_str("  <none>\n");
        } else {
            description.push_str(&format!("  Type    Reason    Age    Message\n"));
            description.push_str("  ----    ------    ---    -------\n");
            for event in event_list.items.iter().take(10) {
                let event_type = event.type_.as_deref().unwrap_or("Normal");
                let reason = event.reason.as_deref().unwrap_or("");
                let message = event.message.as_deref().unwrap_or("");
                let age = event.last_timestamp.as_ref()
                    .map(|ts| format_age(&ts.0))
                    .unwrap_or_else(|| "Unknown".to_string());

                description.push_str(&format!("  {}    {}    {}    {}\n",
                    event_type, reason, age, message
                ));
            }
        }
    } else {
        description.push_str("  <unable to fetch events>\n");
    }

    Ok(description)
}

pub async fn sync_argocd_app(
    client: Client,
    name: &str,
    namespace: &str,
) -> Result<()> {
    use kube::api::{ApiResource, DynamicObject, Patch, PatchParams};

    // Define the ArgoCD Application API resource
    let api_resource = ApiResource {
        group: "argoproj.io".to_string(),
        version: "v1alpha1".to_string(),
        api_version: "argoproj.io/v1alpha1".to_string(),
        kind: "Application".to_string(),
        plural: "applications".to_string(),
    };

    let api: Api<DynamicObject> = Api::namespaced_with(client, namespace, &api_resource);

    // Create a patch to trigger sync operation
    // This sets the operation field which tells ArgoCD to sync the application
    let patch = serde_json::json!({
        "operation": {
            "sync": {
                "revision": "HEAD"
            }
        }
    });

    api.patch(
        name,
        &PatchParams::default(),
        &Patch::Merge(&patch),
    )
    .await?;

    Ok(())
}

pub async fn list_configmaps(client: Client, namespace: &str) -> Result<Vec<ConfigMapInfo>> {
    let configmaps: Api<ConfigMap> = if namespace.is_empty() {
        Api::all(client)
    } else {
        Api::namespaced(client, namespace)
    };
    let lp = ListParams::default();
    let configmap_list = configmaps.list(&lp).await?;

    let mut result = Vec::new();

    for cm in configmap_list {
        let name = cm.metadata.name.unwrap_or_default();
        let namespace = cm.metadata.namespace.unwrap_or_default();

        let data = cm.data.unwrap_or_default()
            .into_iter()
            .collect::<HashMap<String, String>>();
        let keys = data.len();

        let age = cm
            .metadata
            .creation_timestamp
            .as_ref()
            .map(|ts| format_age(&ts.0))
            .unwrap_or_else(|| "Unknown".to_string());

        result.push(ConfigMapInfo {
            name,
            namespace,
            data,
            age,
            keys,
        });
    }

    Ok(result)
}

pub async fn list_secrets(client: Client, namespace: &str) -> Result<Vec<SecretInfo>> {
    let secrets: Api<Secret> = if namespace.is_empty() {
        Api::all(client)
    } else {
        Api::namespaced(client, namespace)
    };
    let lp = ListParams::default();
    let secret_list = secrets.list(&lp).await?;

    let mut result = Vec::new();

    for secret in secret_list {
        let name = secret.metadata.name.unwrap_or_default();
        let namespace = secret.metadata.namespace.unwrap_or_default();

        let secret_type = secret
            .type_
            .as_ref()
            .map(|t| t.to_string())
            .unwrap_or_else(|| "Opaque".to_string());

        // Decode base64 data
        let mut decoded_data = HashMap::new();
        if let Some(data) = secret.data {
            for (key, value) in data {
                let decoded = String::from_utf8(value.0.clone())
                    .unwrap_or_else(|_| format!("<binary data: {} bytes>", value.0.len()));
                decoded_data.insert(key, decoded);
            }
        }

        let keys = decoded_data.len();

        let age = secret
            .metadata
            .creation_timestamp
            .as_ref()
            .map(|ts| format_age(&ts.0))
            .unwrap_or_else(|| "Unknown".to_string());

        result.push(SecretInfo {
            name,
            namespace,
            secret_type,
            data: decoded_data,
            age,
            keys,
        });
    }

    Ok(result)
}

pub async fn list_statefulsets(client: Client, namespace: &str) -> Result<Vec<StatefulSetInfo>> {
    let statefulsets: Api<StatefulSet> = if namespace.is_empty() {
        Api::all(client)
    } else {
        Api::namespaced(client, namespace)
    };
    let lp = ListParams::default();
    let statefulset_list = statefulsets.list(&lp).await?;

    let mut result = Vec::new();

    for sts in statefulset_list {
        let name = sts.metadata.name.unwrap_or_default();
        let namespace = sts.metadata.namespace.unwrap_or_default();

        let status = sts.status.as_ref();
        let replicas = sts.spec.as_ref().and_then(|s| s.replicas).unwrap_or(0);
        let ready_replicas = status.and_then(|s| s.ready_replicas).unwrap_or(0);

        let ready = format!("{}/{}", ready_replicas, replicas);

        let age = sts
            .metadata
            .creation_timestamp
            .as_ref()
            .map(|ts| format_age(&ts.0))
            .unwrap_or_else(|| "Unknown".to_string());

        result.push(StatefulSetInfo {
            name,
            namespace,
            ready,
            replicas,
            age,
        });
    }

    Ok(result)
}

pub async fn list_daemonsets(client: Client, namespace: &str) -> Result<Vec<DaemonSetInfo>> {
    let daemonsets: Api<DaemonSet> = if namespace.is_empty() {
        Api::all(client)
    } else {
        Api::namespaced(client, namespace)
    };
    let lp = ListParams::default();
    let daemonset_list = daemonsets.list(&lp).await?;

    let mut result = Vec::new();

    for ds in daemonset_list {
        let name = ds.metadata.name.unwrap_or_default();
        let namespace = ds.metadata.namespace.unwrap_or_default();

        let status = ds.status.as_ref();

        let desired = status.map(|s| s.desired_number_scheduled).unwrap_or(0);
        let current = status.map(|s| s.current_number_scheduled).unwrap_or(0);
        let ready = status.map(|s| s.number_ready).unwrap_or(0);
        let up_to_date = status.and_then(|s| s.updated_number_scheduled).unwrap_or(0);
        let available = status.and_then(|s| s.number_available).unwrap_or(0);

        let age = ds
            .metadata
            .creation_timestamp
            .as_ref()
            .map(|ts| format_age(&ts.0))
            .unwrap_or_else(|| "Unknown".to_string());

        result.push(DaemonSetInfo {
            name,
            namespace,
            desired,
            current,
            ready,
            up_to_date,
            available,
            age,
        });
    }

    Ok(result)
}

pub async fn list_jobs(client: Client, namespace: &str) -> Result<Vec<JobInfo>> {
    let jobs: Api<Job> = if namespace.is_empty() {
        Api::all(client)
    } else {
        Api::namespaced(client, namespace)
    };
    let lp = ListParams::default();
    let job_list = jobs.list(&lp).await?;

    let mut result = Vec::new();

    for job in job_list {
        let name = job.metadata.name.unwrap_or_default();
        let namespace = job.metadata.namespace.unwrap_or_default();

        let spec = job.spec.as_ref();
        let status = job.status.as_ref();

        let completions = spec
            .and_then(|s| s.completions)
            .map(|c| c.to_string())
            .unwrap_or_else(|| "1".to_string());

        let active = status.and_then(|s| s.active).unwrap_or(0);
        let succeeded = status.and_then(|s| s.succeeded).unwrap_or(0);
        let failed = status.and_then(|s| s.failed).unwrap_or(0);

        let duration = status
            .and_then(|s| s.completion_time.as_ref())
            .zip(status.and_then(|s| s.start_time.as_ref()))
            .map(|(completion, start)| {
                let dur = completion.0.signed_duration_since(start.0);
                format_age(&(start.0 + dur))
            })
            .unwrap_or_else(|| "Running".to_string());

        let age = job
            .metadata
            .creation_timestamp
            .as_ref()
            .map(|ts| format_age(&ts.0))
            .unwrap_or_else(|| "Unknown".to_string());

        result.push(JobInfo {
            name,
            namespace,
            completions,
            duration,
            age,
            active,
            succeeded,
            failed,
        });
    }

    Ok(result)
}

pub async fn list_cronjobs(client: Client, namespace: &str) -> Result<Vec<CronJobInfo>> {
    let cronjobs: Api<CronJob> = if namespace.is_empty() {
        Api::all(client)
    } else {
        Api::namespaced(client, namespace)
    };
    let lp = ListParams::default();
    let cronjob_list = cronjobs.list(&lp).await?;

    let mut result = Vec::new();

    for cj in cronjob_list {
        let name = cj.metadata.name.unwrap_or_default();
        let namespace = cj.metadata.namespace.unwrap_or_default();

        let spec = cj.spec.as_ref();
        let status = cj.status.as_ref();

        let schedule = spec
            .map(|s| s.schedule.clone())
            .unwrap_or_else(|| "Unknown".to_string());

        let suspend = spec.and_then(|s| s.suspend).unwrap_or(false);

        let active = status
            .and_then(|s| s.active.as_ref())
            .map(|a| a.len() as i32)
            .unwrap_or(0);

        let last_schedule = status
            .and_then(|s| s.last_schedule_time.as_ref())
            .map(|ts| format_age(&ts.0));

        let age = cj
            .metadata
            .creation_timestamp
            .as_ref()
            .map(|ts| format_age(&ts.0))
            .unwrap_or_else(|| "Unknown".to_string());

        result.push(CronJobInfo {
            name,
            namespace,
            schedule,
            suspend,
            active,
            last_schedule,
            age,
        });
    }

    Ok(result)
}

pub async fn list_nodes(client: Client) -> Result<Vec<NodeInfo>> {
    let nodes: Api<Node> = Api::all(client);
    let lp = ListParams::default();
    let node_list = nodes.list(&lp).await?;

    let mut result = Vec::new();

    for node in node_list {
        let name = node.metadata.name.unwrap_or_default();

        let status = node
            .status
            .as_ref()
            .and_then(|s| s.conditions.as_ref())
            .and_then(|conditions| {
                conditions
                    .iter()
                    .find(|c| c.type_ == "Ready")
                    .map(|c| if c.status == "True" { "Ready" } else { "NotReady" })
            })
            .unwrap_or("Unknown")
            .to_string();

        let roles = node
            .metadata
            .labels
            .as_ref()
            .map(|labels| {
                labels
                    .iter()
                    .filter(|(k, _)| k.starts_with("node-role.kubernetes.io/"))
                    .map(|(k, _)| {
                        k.strip_prefix("node-role.kubernetes.io/")
                            .unwrap_or("unknown")
                            .to_string()
                    })
                    .collect::<Vec<_>>()
            })
            .unwrap_or_default();

        let version = node
            .status
            .as_ref()
            .and_then(|s| s.node_info.as_ref())
            .map(|ni| ni.kubelet_version.clone())
            .unwrap_or_else(|| "Unknown".to_string());

        let internal_ip = node
            .status
            .as_ref()
            .and_then(|s| s.addresses.as_ref())
            .and_then(|addresses| {
                addresses
                    .iter()
                    .find(|a| a.type_ == "InternalIP")
                    .map(|a| a.address.clone())
            })
            .unwrap_or_else(|| "Unknown".to_string());

        let os_image = node
            .status
            .as_ref()
            .and_then(|s| s.node_info.as_ref())
            .map(|ni| ni.os_image.clone())
            .unwrap_or_else(|| "Unknown".to_string());

        let kernel_version = node
            .status
            .as_ref()
            .and_then(|s| s.node_info.as_ref())
            .map(|ni| ni.kernel_version.clone())
            .unwrap_or_else(|| "Unknown".to_string());

        let external_ip = node
            .status
            .as_ref()
            .and_then(|s| s.addresses.as_ref())
            .and_then(|addresses| {
                addresses
                    .iter()
                    .find(|a| a.type_ == "ExternalIP")
                    .map(|a| a.address.clone())
            });

        let container_runtime = node
            .status
            .as_ref()
            .and_then(|s| s.node_info.as_ref())
            .map(|ni| ni.container_runtime_version.clone())
            .unwrap_or_else(|| "Unknown".to_string());

        let capacity = node.status.as_ref().and_then(|s| s.capacity.as_ref());
        let allocatable = node.status.as_ref().and_then(|s| s.allocatable.as_ref());

        let cpu_capacity = capacity
            .and_then(|c| c.get("cpu"))
            .map(|q| q.0.clone())
            .unwrap_or_else(|| "0".to_string());

        let cpu_allocatable = allocatable
            .and_then(|a| a.get("cpu"))
            .map(|q| q.0.clone())
            .unwrap_or_else(|| "0".to_string());

        let memory_capacity = capacity
            .and_then(|c| c.get("memory"))
            .map(|q| q.0.clone())
            .unwrap_or_else(|| "0".to_string());

        let memory_allocatable = allocatable
            .and_then(|a| a.get("memory"))
            .map(|q| q.0.clone())
            .unwrap_or_else(|| "0".to_string());

        let pods_capacity = capacity
            .and_then(|c| c.get("pods"))
            .map(|q| q.0.clone())
            .unwrap_or_else(|| "0".to_string());

        let pods_allocatable = allocatable
            .and_then(|a| a.get("pods"))
            .map(|q| q.0.clone())
            .unwrap_or_else(|| "0".to_string());

        // Check for GPU capacity (nvidia.com/gpu or amd.com/gpu)
        let gpu_capacity = capacity.and_then(|c| {
            c.get("nvidia.com/gpu")
                .or_else(|| c.get("amd.com/gpu"))
                .map(|q| q.0.clone())
        });

        let age = node
            .metadata
            .creation_timestamp
            .as_ref()
            .map(|ts| format_age(&ts.0))
            .unwrap_or_else(|| "Unknown".to_string());

        result.push(NodeInfo {
            name,
            status,
            roles,
            age,
            version,
            internal_ip,
            external_ip,
            os_image,
            kernel_version,
            container_runtime,
            cpu_capacity,
            cpu_allocatable,
            memory_capacity,
            memory_allocatable,
            pods_capacity,
            pods_allocatable,
            gpu_capacity,
        });
    }

    Ok(result)
}

// Node Operations
pub async fn cordon_node(client: Client, node_name: &str) -> Result<()> {
    use k8s_openapi::api::core::v1::Node;
    use kube::api::{Patch, PatchParams};
    use serde_json::json;

    let nodes: Api<Node> = Api::all(client);
    let patch = json!({
        "spec": {
            "unschedulable": true
        }
    });

    nodes.patch(node_name, &PatchParams::default(), &Patch::Merge(patch)).await?;
    Ok(())
}

pub async fn uncordon_node(client: Client, node_name: &str) -> Result<()> {
    use k8s_openapi::api::core::v1::Node;
    use kube::api::{Patch, PatchParams};
    use serde_json::json;

    let nodes: Api<Node> = Api::all(client);
    let patch = json!({
        "spec": {
            "unschedulable": false
        }
    });

    nodes.patch(node_name, &PatchParams::default(), &Patch::Merge(patch)).await?;
    Ok(())
}

pub async fn drain_node(client: Client, node_name: &str) -> Result<()> {
    use k8s_openapi::api::core::v1::Pod;
    use kube::api::EvictParams;

    // First, cordon the node
    cordon_node(client.clone(), node_name).await?;

    // Get all pods on this node
    let pods: Api<Pod> = Api::all(client.clone());
    let lp = ListParams::default().fields(&format!("spec.nodeName={}", node_name));
    let pod_list = pods.list(&lp).await?;

    // Evict each pod
    for pod in pod_list {
        let pod_name = pod.metadata.name.unwrap_or_default();
        let pod_namespace = pod.metadata.namespace.unwrap_or_default();

        // Skip daemonset pods (they can't be evicted)
        if let Some(owner_refs) = &pod.metadata.owner_references {
            if owner_refs.iter().any(|r| r.kind == "DaemonSet") {
                continue;
            }
        }

        // Skip static pods (identified by having no controller)
        if pod.metadata.owner_references.is_none() {
            continue;
        }

        let pods_ns: Api<Pod> = Api::namespaced(client.clone(), &pod_namespace);
        let evict_params = EvictParams::default();

        // Try to evict the pod
        if let Err(e) = pods_ns.evict(&pod_name, &evict_params).await {
            eprintln!("Failed to evict pod {}/{}: {}", pod_namespace, pod_name, e);
        }
    }

    Ok(())
}

pub async fn delete_node(client: Client, node_name: &str) -> Result<()> {
    use k8s_openapi::api::core::v1::Node;
    use kube::api::DeleteParams;

    let nodes: Api<Node> = Api::all(client);
    nodes.delete(node_name, &DeleteParams::default()).await?;
    Ok(())
}

pub async fn describe_node(client: Client, node_name: &str) -> Result<String> {
    use k8s_openapi::api::core::v1::{Node, Pod};

    let nodes: Api<Node> = Api::all(client.clone());
    let node = nodes.get(node_name).await?;

    let mut description = String::new();

    // Basic Info
    description.push_str(&format!("Name: {}\n", node_name));
    description.push_str(&format!("Roles: {}\n",
        node.metadata.labels.as_ref()
            .and_then(|labels| {
                let roles: Vec<String> = labels.keys()
                    .filter(|k| k.starts_with("node-role.kubernetes.io/"))
                    .map(|k| k.strip_prefix("node-role.kubernetes.io/").unwrap_or(k).to_string())
                    .collect();
                if roles.is_empty() { None } else { Some(roles.join(", ")) }
            })
            .unwrap_or_else(|| "<none>".to_string())
    ));

    // Labels
    description.push_str("\nLabels:\n");
    if let Some(labels) = &node.metadata.labels {
        for (key, value) in labels {
            description.push_str(&format!("  {}={}\n", key, value));
        }
    }

    // Annotations
    description.push_str("\nAnnotations:\n");
    if let Some(annotations) = &node.metadata.annotations {
        for (key, value) in annotations {
            description.push_str(&format!("  {}={}\n", key, value));
        }
    }

    // Taints
    description.push_str("\nTaints:\n");
    if let Some(taints) = node.spec.as_ref().and_then(|s| s.taints.as_ref()) {
        for taint in taints {
            description.push_str(&format!("  {}={}:{}\n",
                taint.key,
                taint.value.as_ref().unwrap_or(&"".to_string()),
                taint.effect
            ));
        }
    } else {
        description.push_str("  <none>\n");
    }

    // Unschedulable
    if let Some(unschedulable) = node.spec.as_ref().and_then(|s| s.unschedulable) {
        if unschedulable {
            description.push_str("\nUnschedulable: true\n");
        }
    }

    // Conditions
    description.push_str("\nConditions:\n");
    if let Some(conditions) = node.status.as_ref().and_then(|s| s.conditions.as_ref()) {
        for condition in conditions {
            description.push_str(&format!("  {} {} ({})\n    Reason: {}\n    Message: {}\n",
                condition.type_,
                condition.status,
                condition.last_transition_time.as_ref()
                    .map(|t| format_age(&t.0))
                    .unwrap_or_else(|| "Unknown".to_string()),
                condition.reason.as_ref().unwrap_or(&"".to_string()),
                condition.message.as_ref().unwrap_or(&"".to_string())
            ));
        }
    }

    // Addresses
    description.push_str("\nAddresses:\n");
    if let Some(addresses) = node.status.as_ref().and_then(|s| s.addresses.as_ref()) {
        for addr in addresses {
            description.push_str(&format!("  {}: {}\n", addr.type_, addr.address));
        }
    }

    // Capacity and Allocatable
    description.push_str("\nCapacity:\n");
    if let Some(capacity) = node.status.as_ref().and_then(|s| s.capacity.as_ref()) {
        for (key, value) in capacity {
            description.push_str(&format!("  {}: {}\n", key, value.0));
        }
    }

    description.push_str("\nAllocatable:\n");
    if let Some(allocatable) = node.status.as_ref().and_then(|s| s.allocatable.as_ref()) {
        for (key, value) in allocatable {
            description.push_str(&format!("  {}: {}\n", key, value.0));
        }
    }

    // System Info
    if let Some(node_info) = node.status.as_ref().and_then(|s| s.node_info.as_ref()) {
        description.push_str("\nSystem Info:\n");
        description.push_str(&format!("  OS Image: {}\n", node_info.os_image));
        description.push_str(&format!("  Kernel Version: {}\n", node_info.kernel_version));
        description.push_str(&format!("  Container Runtime: {}\n", node_info.container_runtime_version));
        description.push_str(&format!("  Kubelet Version: {}\n", node_info.kubelet_version));
        description.push_str(&format!("  Kube-Proxy Version: {}\n", node_info.kube_proxy_version));
    }

    // Get pods running on this node
    description.push_str("\nNon-terminated Pods:\n");
    let pods: Api<Pod> = Api::all(client.clone());
    let lp = ListParams::default().fields(&format!("spec.nodeName={}", node_name));
    if let Ok(pod_list) = pods.list(&lp).await {
        let mut total_cpu = 0i64;
        let mut total_memory = 0i64;

        for pod in &pod_list {
            let pod_name = pod.metadata.name.as_deref().unwrap_or("unknown");
            let pod_ns = pod.metadata.namespace.as_deref().unwrap_or("default");

            // Calculate resource requests
            if let Some(spec) = &pod.spec {
                for container in &spec.containers {
                        if let Some(resources) = &container.resources {
                            if let Some(requests) = &resources.requests {
                                if let Some(cpu) = requests.get("cpu") {
                                    let cpu_str = &cpu.0;
                                    if cpu_str.ends_with('m') {
                                        if let Ok(val) = cpu_str.trim_end_matches('m').parse::<i64>() {
                                            total_cpu += val;
                                        }
                                    } else if let Ok(val) = cpu_str.parse::<i64>() {
                                        total_cpu += val * 1000;
                                    }
                                }
                                if let Some(mem) = requests.get("memory") {
                                    let mem_str = &mem.0;
                                    if mem_str.ends_with("Ki") {
                                        if let Ok(val) = mem_str.trim_end_matches("Ki").parse::<i64>() {
                                            total_memory += val;
                                        }
                                    } else if mem_str.ends_with("Mi") {
                                        if let Ok(val) = mem_str.trim_end_matches("Mi").parse::<i64>() {
                                            total_memory += val * 1024;
                                        }
                                    } else if mem_str.ends_with("Gi") {
                                        if let Ok(val) = mem_str.trim_end_matches("Gi").parse::<i64>() {
                                            total_memory += val * 1024 * 1024;
                                        }
                                    }
                                }
                            }
                        }
                    }
            }

            description.push_str(&format!("  {}/{}\n", pod_ns, pod_name));
        }

        description.push_str(&format!("\nAllocated resources:\n"));
        description.push_str(&format!("  CPU Requests: {}m\n", total_cpu));
        description.push_str(&format!("  Memory Requests: {}Ki\n", total_memory));
        description.push_str(&format!("  Total Pods: {}\n", pod_list.items.len()));
    }

    // Events
    description.push_str("\nEvents:\n");
    let events: Api<Event> = Api::all(client);
    let event_lp = ListParams::default().fields(&format!("involvedObject.name={}", node_name));
    if let Ok(event_list) = events.list(&event_lp).await {
        if event_list.items.is_empty() {
            description.push_str("  <none>\n");
        } else {
            for event in event_list.items.iter().take(10) {
                let event_type = event.type_.as_deref().unwrap_or("Normal");
                let reason = event.reason.as_deref().unwrap_or("");
                let message = event.message.as_deref().unwrap_or("");
                let age = event.last_timestamp.as_ref()
                    .map(|ts| format_age(&ts.0))
                    .unwrap_or_else(|| "Unknown".to_string());

                description.push_str(&format!("  {} {} ({} ago)\n    {}\n",
                    event_type, reason, age, message
                ));
            }
        }
    }

    Ok(description)
}

pub async fn describe_resource(
    client: Client,
    resource_type: &str,
    namespace: Option<&str>,
    name: &str,
) -> Result<String> {
    use k8s_openapi::api::core::v1::Event;
    use kube::api::ListParams;

    // Get the resource YAML first
    let yaml = get_resource_yaml(client.clone(), resource_type, namespace.unwrap_or("default"), name).await?;

    let mut description = String::new();
    description.push_str(&format!("Name: {}\n", name));
    if let Some(ns) = namespace {
        description.push_str(&format!("Namespace: {}\n", ns));
    }
    description.push_str(&format!("Type: {}\n", resource_type));
    description.push_str("\n");

    // Add resource-specific information based on type
    description.push_str("Details:\n");
    description.push_str(&yaml);
    description.push_str("\n\n");

    // Get events related to this resource
    description.push_str("Events:\n");
    let events: Api<Event> = if let Some(ns) = namespace {
        Api::namespaced(client, ns)
    } else {
        Api::all(client)
    };

    let event_lp = ListParams::default().fields(&format!("involvedObject.name={}", name));
    if let Ok(event_list) = events.list(&event_lp).await {
        if event_list.items.is_empty() {
            description.push_str("  <none>\n");
        } else {
            for event in event_list.items.iter().take(10) {
                let event_type = event.type_.as_deref().unwrap_or("Normal");
                let reason = event.reason.as_deref().unwrap_or("");
                let message = event.message.as_deref().unwrap_or("");
                let age = event.last_timestamp.as_ref()
                    .map(|ts| format_age(&ts.0))
                    .unwrap_or_else(|| "Unknown".to_string());

                description.push_str(&format!("  {} {} ({} ago)\n    {}\n",
                    event_type, reason, age, message
                ));
            }
        }
    }

    Ok(description)
}

pub async fn list_events(client: Client, namespace: &str) -> Result<Vec<EventInfo>> {
    let events: Api<Event> = if namespace.is_empty() {
        Api::all(client)
    } else {
        Api::namespaced(client, namespace)
    };
    let lp = ListParams::default();
    let event_list = events.list(&lp).await?;

    let mut result = Vec::new();

    for event in event_list {
        let event_type = event.type_.unwrap_or_else(|| "Normal".to_string());
        let reason = event.reason.unwrap_or_else(|| "Unknown".to_string());
        let message = event.message.unwrap_or_else(|| "No message".to_string());

        let object = event
            .involved_object
            .name
            .map(|name| {
                format!(
                    "{}/{}",
                    event.involved_object.kind.unwrap_or_else(|| "Unknown".to_string()),
                    name
                )
            })
            .unwrap_or_else(|| "Unknown".to_string());

        let source = event
            .source
            .as_ref()
            .and_then(|s| s.component.as_ref())
            .map(|c| c.to_string())
            .unwrap_or_else(|| "Unknown".to_string());

        let first_seen = event
            .first_timestamp
            .as_ref()
            .map(|ts| format_age(&ts.0))
            .unwrap_or_else(|| "Unknown".to_string());

        let last_seen = event
            .last_timestamp
            .as_ref()
            .map(|ts| format_age(&ts.0))
            .unwrap_or_else(|| "Unknown".to_string());

        let count = event.count.unwrap_or(1);

        result.push(EventInfo {
            event_type,
            reason,
            object,
            message,
            source,
            first_seen,
            last_seen,
            count,
        });
    }

    Ok(result)
}

pub async fn list_persistent_volumes(client: Client) -> Result<Vec<PersistentVolumeInfo>> {
    let pvs: Api<PersistentVolume> = Api::all(client);
    let lp = ListParams::default();
    let pv_list = pvs.list(&lp).await?;

    let mut result = Vec::new();

    for pv in pv_list {
        let name = pv.metadata.name.unwrap_or_default();

        let spec = pv.spec.as_ref();

        let capacity = spec
            .and_then(|s| s.capacity.as_ref())
            .and_then(|c| c.get("storage"))
            .map(|q| q.0.clone())
            .unwrap_or_else(|| "Unknown".to_string());

        let access_modes = spec
            .and_then(|s| s.access_modes.as_ref())
            .map(|modes| modes.clone())
            .unwrap_or_default();

        let reclaim_policy = spec
            .and_then(|s| s.persistent_volume_reclaim_policy.as_ref())
            .map(|p| p.to_string())
            .unwrap_or_else(|| "Unknown".to_string());

        let status = pv
            .status
            .as_ref()
            .and_then(|s| s.phase.as_ref())
            .map(|p| p.to_string())
            .unwrap_or_else(|| "Unknown".to_string());

        let claim = pv
            .spec
            .as_ref()
            .and_then(|s| s.claim_ref.as_ref())
            .map(|c| {
                format!(
                    "{}/{}",
                    c.namespace.as_ref().unwrap_or(&"Unknown".to_string()),
                    c.name.as_ref().unwrap_or(&"Unknown".to_string())
                )
            });

        let storage_class = spec
            .and_then(|s| s.storage_class_name.as_ref())
            .map(|sc| sc.to_string());

        let age = pv
            .metadata
            .creation_timestamp
            .as_ref()
            .map(|ts| format_age(&ts.0))
            .unwrap_or_else(|| "Unknown".to_string());

        result.push(PersistentVolumeInfo {
            name,
            capacity,
            access_modes,
            reclaim_policy,
            status,
            claim,
            storage_class,
            age,
        });
    }

    Ok(result)
}

pub async fn list_persistent_volume_claims(
    client: Client,
    namespace: &str,
) -> Result<Vec<PersistentVolumeClaimInfo>> {
    let pvcs: Api<PersistentVolumeClaim> = if namespace.is_empty() {
        Api::all(client)
    } else {
        Api::namespaced(client, namespace)
    };
    let lp = ListParams::default();
    let pvc_list = pvcs.list(&lp).await?;

    let mut result = Vec::new();

    for pvc in pvc_list {
        let name = pvc.metadata.name.unwrap_or_default();
        let namespace = pvc.metadata.namespace.unwrap_or_default();

        let status = pvc
            .status
            .as_ref()
            .and_then(|s| s.phase.as_ref())
            .map(|p| p.to_string())
            .unwrap_or_else(|| "Unknown".to_string());

        let volume = pvc.spec.as_ref().and_then(|s| s.volume_name.clone());

        let capacity = pvc
            .status
            .as_ref()
            .and_then(|s| s.capacity.as_ref())
            .and_then(|c| c.get("storage"))
            .map(|q| q.0.clone());

        let access_modes = pvc
            .spec
            .as_ref()
            .and_then(|s| s.access_modes.as_ref())
            .map(|modes| modes.clone())
            .unwrap_or_default();

        let storage_class = pvc
            .spec
            .as_ref()
            .and_then(|s| s.storage_class_name.as_ref())
            .map(|sc| sc.to_string());

        let age = pvc
            .metadata
            .creation_timestamp
            .as_ref()
            .map(|ts| format_age(&ts.0))
            .unwrap_or_else(|| "Unknown".to_string());

        result.push(PersistentVolumeClaimInfo {
            name,
            namespace,
            status,
            volume,
            capacity,
            access_modes,
            storage_class,
            age,
        });
    }

    Ok(result)
}

// RBAC Operations
pub async fn list_roles(client: Client, namespace: &str) -> Result<Vec<RoleInfo>> {
    let roles: Api<Role> = if namespace.is_empty() {
        Api::all(client)
    } else {
        Api::namespaced(client, namespace)
    };
    let lp = ListParams::default();
    let role_list = roles.list(&lp).await?;

    let mut result = Vec::new();

    for role in role_list {
        let name = role.metadata.name.unwrap_or_default();
        let namespace = role.metadata.namespace.unwrap_or_default();

        let rules_count = role.rules.as_ref().map(|r| r.len()).unwrap_or(0);

        let age = role
            .metadata
            .creation_timestamp
            .as_ref()
            .map(|ts| format_age(&ts.0))
            .unwrap_or_else(|| "Unknown".to_string());

        result.push(RoleInfo {
            name,
            namespace,
            age,
            rules_count,
        });
    }

    Ok(result)
}

pub async fn list_role_bindings(client: Client, namespace: &str) -> Result<Vec<RoleBindingInfo>> {
    let role_bindings: Api<RoleBinding> = if namespace.is_empty() {
        Api::all(client)
    } else {
        Api::namespaced(client, namespace)
    };
    let lp = ListParams::default();
    let rb_list = role_bindings.list(&lp).await?;

    let mut result = Vec::new();

    for rb in rb_list {
        let name = rb.metadata.name.unwrap_or_default();
        let namespace = rb.metadata.namespace.unwrap_or_default();

        let role = rb.role_ref.name.clone();
        let role_kind = rb.role_ref.kind.clone();

        let subjects = rb
            .subjects
            .as_ref()
            .map(|subs| {
                subs.iter()
                    .map(|s| SubjectInfo {
                        kind: s.kind.clone(),
                        name: s.name.clone(),
                        namespace: s.namespace.clone(),
                    })
                    .collect()
            })
            .unwrap_or_default();

        let age = rb
            .metadata
            .creation_timestamp
            .as_ref()
            .map(|ts| format_age(&ts.0))
            .unwrap_or_else(|| "Unknown".to_string());

        result.push(RoleBindingInfo {
            name,
            namespace,
            role,
            role_kind,
            subjects,
            age,
        });
    }

    Ok(result)
}

pub async fn list_cluster_roles(client: Client) -> Result<Vec<ClusterRoleInfo>> {
    let cluster_roles: Api<ClusterRole> = Api::all(client);
    let lp = ListParams::default();
    let cr_list = cluster_roles.list(&lp).await?;

    let mut result = Vec::new();

    for cr in cr_list {
        let name = cr.metadata.name.unwrap_or_default();

        let rules_count = cr.rules.as_ref().map(|r| r.len()).unwrap_or(0);

        let age = cr
            .metadata
            .creation_timestamp
            .as_ref()
            .map(|ts| format_age(&ts.0))
            .unwrap_or_else(|| "Unknown".to_string());

        result.push(ClusterRoleInfo {
            name,
            age,
            rules_count,
        });
    }

    Ok(result)
}

pub async fn list_cluster_role_bindings(client: Client) -> Result<Vec<ClusterRoleBindingInfo>> {
    let cluster_role_bindings: Api<ClusterRoleBinding> = Api::all(client);
    let lp = ListParams::default();
    let crb_list = cluster_role_bindings.list(&lp).await?;

    let mut result = Vec::new();

    for crb in crb_list {
        let name = crb.metadata.name.unwrap_or_default();

        let role = crb.role_ref.name.clone();

        let subjects = crb
            .subjects
            .as_ref()
            .map(|subs| {
                subs.iter()
                    .map(|s| SubjectInfo {
                        kind: s.kind.clone(),
                        name: s.name.clone(),
                        namespace: s.namespace.clone(),
                    })
                    .collect()
            })
            .unwrap_or_default();

        let age = crb
            .metadata
            .creation_timestamp
            .as_ref()
            .map(|ts| format_age(&ts.0))
            .unwrap_or_else(|| "Unknown".to_string());

        result.push(ClusterRoleBindingInfo {
            name,
            role,
            subjects,
            age,
        });
    }

    Ok(result)
}

pub async fn list_service_accounts(client: Client, namespace: &str) -> Result<Vec<ServiceAccountInfo>> {
    let service_accounts: Api<ServiceAccount> = if namespace.is_empty() {
        Api::all(client)
    } else {
        Api::namespaced(client, namespace)
    };
    let lp = ListParams::default();
    let sa_list = service_accounts.list(&lp).await?;

    let mut result = Vec::new();

    for sa in sa_list {
        let name = sa.metadata.name.unwrap_or_default();
        let namespace = sa.metadata.namespace.unwrap_or_default();

        let secrets = sa.secrets.as_ref().map(|s| s.len()).unwrap_or(0);

        let age = sa
            .metadata
            .creation_timestamp
            .as_ref()
            .map(|ts| format_age(&ts.0))
            .unwrap_or_else(|| "Unknown".to_string());

        result.push(ServiceAccountInfo {
            name,
            namespace,
            secrets,
            age,
        });
    }

    Ok(result)
}

pub async fn get_pods_for_resource(
    client: Client,
    resource_type: &str,
    resource_name: &str,
    namespace: &str,
) -> Result<Vec<PodInfo>> {
    use kube::api::ListParams;

    // Determine the label selector based on resource type
    let label_selector = match resource_type.to_lowercase().as_str() {
        "deployment" => {
            // For deployments, we need to get the deployment's selector
            let deployments: Api<Deployment> = Api::namespaced(client.clone(), namespace);
            let deployment = deployments.get(resource_name).await?;

            // Extract label selector from deployment spec
            if let Some(spec) = deployment.spec {
                if let Some(selector) = spec.selector.match_labels {
                    // Convert labels to selector string
                    selector
                        .iter()
                        .map(|(k, v)| format!("{}={}", k, v))
                        .collect::<Vec<_>>()
                        .join(",")
                } else {
                    return Ok(Vec::new());
                }
            } else {
                return Ok(Vec::new());
            }
        }
        "statefulset" => {
            let statefulsets: Api<StatefulSet> = Api::namespaced(client.clone(), namespace);
            let statefulset = statefulsets.get(resource_name).await?;

            if let Some(spec) = statefulset.spec {
                if let Some(selector) = spec.selector.match_labels {
                    selector
                        .iter()
                        .map(|(k, v)| format!("{}={}", k, v))
                        .collect::<Vec<_>>()
                        .join(",")
                } else {
                    return Ok(Vec::new());
                }
            } else {
                return Ok(Vec::new());
            }
        }
        "daemonset" => {
            let daemonsets: Api<DaemonSet> = Api::namespaced(client.clone(), namespace);
            let daemonset = daemonsets.get(resource_name).await?;

            if let Some(spec) = daemonset.spec {
                if let Some(selector) = spec.selector.match_labels {
                    selector
                        .iter()
                        .map(|(k, v)| format!("{}={}", k, v))
                        .collect::<Vec<_>>()
                        .join(",")
                } else {
                    return Ok(Vec::new());
                }
            } else {
                return Ok(Vec::new());
            }
        }
        "job" => {
            // For jobs, use job-name label
            format!("job-name={}", resource_name)
        }
        _ => return Err(anyhow::anyhow!("Unsupported resource type: {}", resource_type)),
    };

    // Query pods with the label selector
    let pods: Api<Pod> = Api::namespaced(client, namespace);
    let lp = ListParams::default().labels(&label_selector);
    let pod_list = pods.list(&lp).await?;

    // Convert to PodInfo (reuse the existing logic from list_pods)
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

        let ports: Vec<i32> = pod
            .spec
            .as_ref()
            .map(|s| {
                s.containers
                    .iter()
                    .flat_map(|c| {
                        c.ports.as_ref().map(|ports| {
                            ports.iter().map(|p| p.container_port).collect::<Vec<_>>()
                        }).unwrap_or_default()
                    })
                    .collect()
            })
            .unwrap_or_default();

        // Extract labels from pod metadata (convert BTreeMap to HashMap)
        let labels = pod.metadata.labels.as_ref().map(|l| {
            l.iter().map(|(k, v)| (k.clone(), v.clone())).collect()
        });

        // Extract annotations from pod metadata (convert BTreeMap to HashMap)
        let annotations = pod.metadata.annotations.as_ref().map(|a| {
            a.iter().map(|(k, v)| (k.clone(), v.clone())).collect()
        });

        result.push(PodInfo {
            name,
            namespace,
            status,
            ready,
            restarts,
            age,
            node,
            ip,
            ports,
            labels,
            annotations,
        });
    }

    Ok(result)
}

// Apply YAML to update a resource
pub async fn apply_resource_yaml(
    client: Client,
    resource_type: &str,
    namespace: &str,
    yaml_content: &str,
) -> Result<()> {
    use kube::api::{Patch, PatchParams};
    use serde_json::Value;

    // Parse the YAML to JSON
    let value: Value = serde_yaml::from_str(yaml_content)?;

    // Create patch params for server-side apply
    let patch_params = PatchParams::apply("kubesail");

    // Apply the resource based on type
    match resource_type.to_lowercase().as_str() {
        "pod" => {
            let api: Api<Pod> = Api::namespaced(client, namespace);
            let pod: Pod = serde_json::from_value(value)?;
            api.patch(&pod.name_any(), &patch_params, &Patch::Apply(&pod)).await?;
        }
        "deployment" => {
            let api: Api<Deployment> = Api::namespaced(client, namespace);
            let deployment: Deployment = serde_json::from_value(value)?;
            api.patch(&deployment.name_any(), &patch_params, &Patch::Apply(&deployment)).await?;
        }
        "service" => {
            let api: Api<Service> = Api::namespaced(client, namespace);
            let service: Service = serde_json::from_value(value)?;
            api.patch(&service.name_any(), &patch_params, &Patch::Apply(&service)).await?;
        }
        "configmap" => {
            let api: Api<ConfigMap> = Api::namespaced(client, namespace);
            let cm: ConfigMap = serde_json::from_value(value)?;
            api.patch(&cm.name_any(), &patch_params, &Patch::Apply(&cm)).await?;
        }
        "secret" => {
            let api: Api<Secret> = Api::namespaced(client, namespace);
            let secret: Secret = serde_json::from_value(value)?;
            api.patch(&secret.name_any(), &patch_params, &Patch::Apply(&secret)).await?;
        }
        "statefulset" => {
            let api: Api<StatefulSet> = Api::namespaced(client, namespace);
            let sts: StatefulSet = serde_json::from_value(value)?;
            api.patch(&sts.name_any(), &patch_params, &Patch::Apply(&sts)).await?;
        }
        "daemonset" => {
            let api: Api<DaemonSet> = Api::namespaced(client, namespace);
            let ds: DaemonSet = serde_json::from_value(value)?;
            api.patch(&ds.name_any(), &patch_params, &Patch::Apply(&ds)).await?;
        }
        "job" => {
            let api: Api<Job> = Api::namespaced(client, namespace);
            let job: Job = serde_json::from_value(value)?;
            api.patch(&job.name_any(), &patch_params, &Patch::Apply(&job)).await?;
        }
        "cronjob" => {
            let api: Api<CronJob> = Api::namespaced(client, namespace);
            let cj: CronJob = serde_json::from_value(value)?;
            api.patch(&cj.name_any(), &patch_params, &Patch::Apply(&cj)).await?;
        }
        "ingress" => {
            let api: Api<Ingress> = Api::namespaced(client, namespace);
            let ingress: Ingress = serde_json::from_value(value)?;
            api.patch(&ingress.name_any(), &patch_params, &Patch::Apply(&ingress)).await?;
        }
        "persistentvolumeclaim" | "pvc" => {
            let api: Api<PersistentVolumeClaim> = Api::namespaced(client, namespace);
            let pvc: PersistentVolumeClaim = serde_json::from_value(value)?;
            api.patch(&pvc.name_any(), &patch_params, &Patch::Apply(&pvc)).await?;
        }
        "persistentvolume" | "pv" => {
            let api: Api<PersistentVolume> = Api::all(client);
            let pv: PersistentVolume = serde_json::from_value(value)?;
            api.patch(&pv.name_any(), &patch_params, &Patch::Apply(&pv)).await?;
        }
        "role" => {
            let api: Api<Role> = Api::namespaced(client, namespace);
            let role: Role = serde_json::from_value(value)?;
            api.patch(&role.name_any(), &patch_params, &Patch::Apply(&role)).await?;
        }
        "rolebinding" => {
            let api: Api<RoleBinding> = Api::namespaced(client, namespace);
            let rb: RoleBinding = serde_json::from_value(value)?;
            api.patch(&rb.name_any(), &patch_params, &Patch::Apply(&rb)).await?;
        }
        "clusterrole" => {
            let api: Api<ClusterRole> = Api::all(client);
            let cr: ClusterRole = serde_json::from_value(value)?;
            api.patch(&cr.name_any(), &patch_params, &Patch::Apply(&cr)).await?;
        }
        "clusterrolebinding" => {
            let api: Api<ClusterRoleBinding> = Api::all(client);
            let crb: ClusterRoleBinding = serde_json::from_value(value)?;
            api.patch(&crb.name_any(), &patch_params, &Patch::Apply(&crb)).await?;
        }
        "serviceaccount" => {
            let api: Api<ServiceAccount> = Api::namespaced(client, namespace);
            let sa: ServiceAccount = serde_json::from_value(value)?;
            api.patch(&sa.name_any(), &patch_params, &Patch::Apply(&sa)).await?;
        }
        _ => {
            return Err(anyhow::anyhow!("Unsupported resource type: {}", resource_type));
        }
    }

    Ok(())
}

// CRD Operations
pub async fn list_crds(client: Client) -> Result<Vec<CRDInfo>> {
    let crds: Api<CustomResourceDefinition> = Api::all(client);
    let lp = ListParams::default();
    let crd_list = crds.list(&lp).await?;

    let mut result = Vec::new();

    for crd in crd_list {
        let name = crd.metadata.name.unwrap_or_default();

        let spec = crd.spec;
        let group = spec.group.clone();

        // Get the served version (prefer storage version)
        let version = spec
            .versions
            .iter()
            .find(|v| v.storage)
            .or_else(|| spec.versions.first())
            .map(|v| v.name.clone())
            .unwrap_or_else(|| "unknown".to_string());

        let kind = spec.names.kind.clone();
        let plural = spec.names.plural.clone();
        let singular = spec.names.singular.clone().unwrap_or_else(|| kind.to_lowercase());

        let scope = match spec.scope.as_str() {
            "Namespaced" => "Namespaced".to_string(),
            "Cluster" => "Cluster".to_string(),
            _ => "Unknown".to_string(),
        };

        let categories = spec
            .names
            .categories
            .unwrap_or_default();

        let age = crd
            .metadata
            .creation_timestamp
            .as_ref()
            .map(|ts| format_age(&ts.0))
            .unwrap_or_else(|| "Unknown".to_string());

        result.push(CRDInfo {
            name,
            group,
            version,
            kind,
            plural,
            singular,
            scope,
            age,
            categories,
        });
    }

    // Sort by name
    result.sort_by(|a, b| a.name.cmp(&b.name));

    Ok(result)
}

pub async fn list_custom_resources(
    client: Client,
    group: &str,
    version: &str,
    plural: &str,
    namespace: Option<&str>,
) -> Result<Vec<CustomResourceInfo>> {
    // Create ApiResource for dynamic discovery
    let api_resource = ApiResource {
        group: group.to_string(),
        version: version.to_string(),
        api_version: if group.is_empty() {
            version.to_string()
        } else {
            format!("{}/{}", group, version)
        },
        kind: plural.to_string(), // We'll use plural as kind placeholder
        plural: plural.to_string(),
    };

    // Create dynamic API
    let api: Api<DynamicObject> = if let Some(ns) = namespace {
        Api::namespaced_with(client, ns, &api_resource)
    } else {
        Api::all_with(client, &api_resource)
    };

    let lp = ListParams::default();
    let list = api.list(&lp).await?;

    let mut result = Vec::new();

    for item in list {
        let name = item.metadata.name.clone().unwrap_or_default();
        let namespace = item.metadata.namespace.clone();

        let kind = item.types.as_ref()
            .map(|t| t.kind.clone())
            .unwrap_or_else(|| plural.to_string());

        let api_version = item.types.as_ref()
            .map(|t| t.api_version.clone())
            .unwrap_or_else(|| {
                if group.is_empty() {
                    version.to_string()
                } else {
                    format!("{}/{}", group, version)
                }
            });

        let age = item
            .metadata
            .creation_timestamp
            .as_ref()
            .map(|ts| format_age(&ts.0))
            .unwrap_or_else(|| "Unknown".to_string());

        // Store full metadata as JSON for later use
        let metadata = serde_json::to_value(&item).unwrap_or(serde_json::Value::Null);

        result.push(CustomResourceInfo {
            name,
            namespace,
            kind,
            api_version,
            age,
            metadata,
        });
    }

    Ok(result)
}

pub async fn delete_custom_resource(
    client: Client,
    group: &str,
    version: &str,
    plural: &str,
    name: &str,
    namespace: Option<&str>,
) -> Result<()> {
    use kube::api::DeleteParams;

    let api_resource = ApiResource {
        group: group.to_string(),
        version: version.to_string(),
        api_version: if group.is_empty() {
            version.to_string()
        } else {
            format!("{}/{}", group, version)
        },
        kind: plural.to_string(),
        plural: plural.to_string(),
    };

    let api: Api<DynamicObject> = if let Some(ns) = namespace {
        Api::namespaced_with(client, ns, &api_resource)
    } else {
        Api::all_with(client, &api_resource)
    };

    api.delete(name, &DeleteParams::default()).await?;
    Ok(())
}

// CloudNativePG cluster connection details
pub async fn get_cnpg_cluster_connection(
    client: Client,
    cluster_name: &str,
    namespace: &str,
) -> Result<CNPGConnectionDetails> {
    use serde_json::Value;

    tracing::info!(
        "Fetching CNPG cluster connection details for cluster: {}, namespace: {}",
        cluster_name,
        namespace
    );

    let secrets: Api<Secret> = Api::namespaced(client.clone(), namespace);

    // Helper function to decode secret data
    let decode_secret_data = |secret: &Secret, key: &str| -> Result<String> {
        let data = secret.data.as_ref()
            .ok_or_else(|| anyhow::anyhow!("Secret has no data field"))?;

        let bytes = data.get(key)
            .ok_or_else(|| anyhow::anyhow!("Secret key '{}' not found", key))?;

        String::from_utf8(bytes.0.clone())
            .map_err(|e| anyhow::anyhow!("UTF8 conversion failed for key '{}': {}", key, e))
    };

    // ROBUST APPROACH: Try CloudNativePG's auto-generated -app secret first
    // This secret contains ALL connection details pre-formatted
    let app_secret_name = format!("{}-app", cluster_name);
    tracing::info!("Attempting to fetch CloudNativePG auto-generated secret: {}", app_secret_name);

    if let Ok(app_secret) = secrets.get(&app_secret_name).await {
        tracing::info!("Found -app secret, checking if it has all required fields...");

        // Check if this secret has all the comprehensive connection details
        if let Some(data) = &app_secret.data {
            let has_comprehensive_data = data.contains_key("host")
                && data.contains_key("port")
                && data.contains_key("dbname")
                && data.contains_key("username")
                && data.contains_key("password")
                && data.contains_key("uri");

            if has_comprehensive_data {
                tracing::info!("-app secret has comprehensive connection details, using it directly");

                // Extract all fields from the -app secret
                let host = decode_secret_data(&app_secret, "host")?;
                let port = decode_secret_data(&app_secret, "port")?;
                let database = decode_secret_data(&app_secret, "dbname")?;
                let username = decode_secret_data(&app_secret, "username")
                    .or_else(|_| decode_secret_data(&app_secret, "user"))?; // Try both username and user
                let password = decode_secret_data(&app_secret, "password")?;
                let uri = decode_secret_data(&app_secret, "uri")?;
                let fqdn_uri = decode_secret_data(&app_secret, "fqdn-uri")
                    .unwrap_or_else(|_| format!(
                        "postgresql://{}:{}@{}-rw.{}.svc.cluster.local:{}/{}",
                        username, password, cluster_name, namespace, port, database
                    ));
                let jdbc_uri = decode_secret_data(&app_secret, "jdbc-uri")
                    .unwrap_or_else(|_| format!("jdbc:postgresql://{}:{}/{}", host, port, database));
                let fqdn_jdbc_uri = decode_secret_data(&app_secret, "fqdn-jdbc-uri")
                    .unwrap_or_else(|_| format!(
                        "jdbc:postgresql://{}-rw.{}.svc.cluster.local:{}/{}",
                        cluster_name, namespace, port, database
                    ));
                let pgpass = decode_secret_data(&app_secret, "pgpass")
                    .unwrap_or_else(|_| format!("{}:{}:{}:{}:{}", host, port, database, username, password));

                tracing::info!("Successfully extracted all connection details from -app secret");

                return Ok(CNPGConnectionDetails {
                    cluster_name: cluster_name.to_string(),
                    namespace: namespace.to_string(),
                    database,
                    username,
                    password,
                    host,
                    port,
                    uri,
                    fqdn_uri,
                    jdbc_uri,
                    fqdn_jdbc_uri,
                    pgpass,
                });
            } else {
                tracing::warn!("-app secret exists but doesn't have comprehensive data, falling back to manual construction");
            }
        }
    } else {
        tracing::info!("-app secret not found, falling back to cluster spec approach");
    }

    // FALLBACK: Manual construction from cluster spec + separate secret
    // Get the Cluster resource to extract database name and other config
    let clusters: Api<DynamicObject> = Api::namespaced_with(
        client.clone(),
        namespace,
        &ApiResource {
            group: "postgresql.cnpg.io".to_string(),
            version: "v1".to_string(),
            api_version: "postgresql.cnpg.io/v1".to_string(),
            kind: "Cluster".to_string(),
            plural: "clusters".to_string(),
        },
    );

    tracing::debug!("Attempting to fetch Cluster resource: {}", cluster_name);
    let cluster = clusters.get(cluster_name).await.map_err(|e| {
        tracing::error!("Failed to fetch Cluster resource: {}", e);
        e
    })?;
    tracing::info!("Successfully fetched Cluster resource");

    let cluster_data: Value = serde_json::to_value(&cluster.data)?;

    // Extract database configuration from cluster spec
    let database = cluster_data["spec"]["bootstrap"]["initdb"]["database"]
        .as_str()
        .unwrap_or("app")
        .to_string();

    let username = cluster_data["spec"]["bootstrap"]["initdb"]["owner"]
        .as_str()
        .unwrap_or("app")
        .to_string();

    // Try multiple secret name patterns
    let configured_secret = cluster_data["spec"]["bootstrap"]["initdb"]["secret"]["name"]
        .as_str()
        .map(|s| s.to_string());

    let secret_candidates = if let Some(configured) = configured_secret {
        vec![
            configured.clone(),
            format!("{}-app", cluster_name),
            format!("{}-appuser", cluster_name),
            format!("{}-superuser", cluster_name),
        ]
    } else {
        vec![
            format!("{}-app", cluster_name),
            format!("{}-appuser", cluster_name),
            format!("{}-superuser", cluster_name),
        ]
    };

    tracing::info!("Trying secret candidates: {:?}", secret_candidates);

    let mut secret = None;
    let mut used_secret_name = String::new();

    for candidate in secret_candidates {
        tracing::debug!("Attempting to fetch secret: {}", candidate);
        match secrets.get(&candidate).await {
            Ok(s) => {
                tracing::info!("Found secret: {}", candidate);
                used_secret_name = candidate;
                secret = Some(s);
                break;
            }
            Err(e) => {
                tracing::debug!("Secret '{}' not found: {}", candidate, e);
            }
        }
    }

    let secret = secret.ok_or_else(|| {
        anyhow::anyhow!("Could not find any suitable secret for cluster {}", cluster_name)
    })?;

    let password = decode_secret_data(&secret, "password")?;

    // CloudNativePG standard service names
    let host = format!("{}-rw", cluster_name);
    let port = "5432".to_string();
    let fqdn_host = format!("{}-rw.{}.svc.cluster.local", cluster_name, namespace);

    // Construct connection strings
    let uri = format!(
        "postgresql://{}:{}@{}:{}/{}",
        username, password, host, port, database
    );

    let fqdn_uri = format!(
        "postgresql://{}:{}@{}:{}/{}",
        username, password, fqdn_host, port, database
    );

    let jdbc_uri = format!(
        "jdbc:postgresql://{}:{}/{}",
        host, port, database
    );

    let fqdn_jdbc_uri = format!(
        "jdbc:postgresql://{}:{}/{}",
        fqdn_host, port, database
    );

    let pgpass = format!(
        "{}:{}:{}:{}:{}",
        host, port, database, username, password
    );

    tracing::info!("Successfully built CNPG connection details from cluster spec and secret '{}'", used_secret_name);

    Ok(CNPGConnectionDetails {
        cluster_name: cluster_name.to_string(),
        namespace: namespace.to_string(),
        database,
        username,
        password,
        host,
        port,
        uri,
        fqdn_uri,
        jdbc_uri,
        fqdn_jdbc_uri,
        pgpass,
    })
}
