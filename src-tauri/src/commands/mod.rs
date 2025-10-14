use crate::kube::{get_current_context, load_kubeconfig, KubeClientManager};
use crate::types::*;
use tauri::State;

#[tauri::command]
pub async fn get_kubeconfig_contexts(
) -> Result<Vec<ContextInfo>, String> {
    let config = load_kubeconfig().map_err(|e| e.to_string())?;

    let contexts: Vec<ContextInfo> = config
        .contexts
        .iter()
        .map(|ctx_entry| ContextInfo {
            name: ctx_entry.name.clone(),
            cluster: ctx_entry.context.cluster.clone(),
            namespace: ctx_entry.context.namespace.clone(),
            user: ctx_entry.context.user.clone(),
            current: ctx_entry.name == config.current_context,
        })
        .collect();

    Ok(contexts)
}

#[tauri::command]
pub async fn get_clusters() -> Result<Vec<ClusterInfo>, String> {
    let config = load_kubeconfig().map_err(|e| e.to_string())?;

    let current_ctx = get_current_context(&config);
    let current_cluster = current_ctx.map(|ctx| ctx.context.cluster.as_str());

    let clusters: Vec<ClusterInfo> = config
        .clusters
        .iter()
        .map(|cluster_entry| ClusterInfo {
            name: cluster_entry.name.clone(),
            server: cluster_entry.cluster.server.clone(),
            current: Some(cluster_entry.name.as_str()) == current_cluster,
        })
        .collect();

    Ok(clusters)
}

#[tauri::command]
pub async fn get_namespaces(
    client_manager: State<'_, KubeClientManager>,
) -> Result<Vec<NamespaceInfo>, String> {
    let client = client_manager
        .get_client()
        .await
        .map_err(|e| e.to_string())?;

    crate::kube::list_namespaces(client)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_pods(
    namespace: String,
    client_manager: State<'_, KubeClientManager>,
) -> Result<Vec<PodInfo>, String> {
    let client = client_manager
        .get_client()
        .await
        .map_err(|e| e.to_string())?;

    crate::kube::list_pods(client, &namespace)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_deployments(
    namespace: String,
    client_manager: State<'_, KubeClientManager>,
) -> Result<Vec<DeploymentInfo>, String> {
    let client = client_manager
        .get_client()
        .await
        .map_err(|e| e.to_string())?;

    crate::kube::list_deployments(client, &namespace)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_services(
    namespace: String,
    client_manager: State<'_, KubeClientManager>,
) -> Result<Vec<ServiceInfo>, String> {
    let client = client_manager
        .get_client()
        .await
        .map_err(|e| e.to_string())?;

    crate::kube::list_services(client, &namespace)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_pod_logs(
    namespace: String,
    pod_name: String,
    container: Option<String>,
    tail_lines: Option<i64>,
    client_manager: State<'_, KubeClientManager>,
) -> Result<Vec<LogEntry>, String> {
    let client = client_manager
        .get_client()
        .await
        .map_err(|e| e.to_string())?;

    crate::kube::get_pod_logs(
        client,
        &namespace,
        &pod_name,
        container.as_deref(),
        tail_lines,
    )
    .await
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_pod(
    namespace: String,
    pod_name: String,
    client_manager: State<'_, KubeClientManager>,
) -> Result<(), String> {
    let client = client_manager
        .get_client()
        .await
        .map_err(|e| e.to_string())?;

    crate::kube::delete_pod(client, &namespace, &pod_name)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn scale_deployment(
    namespace: String,
    deployment_name: String,
    replicas: i32,
    client_manager: State<'_, KubeClientManager>,
) -> Result<(), String> {
    let client = client_manager
        .get_client()
        .await
        .map_err(|e| e.to_string())?;

    crate::kube::scale_deployment(client, &namespace, &deployment_name, replicas)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn reinit_kube_client(
    client_manager: State<'_, KubeClientManager>,
) -> Result<(), String> {
    client_manager
        .reinit_client()
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_ingresses(
    namespace: String,
    client_manager: State<'_, KubeClientManager>,
) -> Result<Vec<IngressInfo>, String> {
    let client = client_manager
        .get_client()
        .await
        .map_err(|e| e.to_string())?;

    crate::kube::list_ingresses(client, &namespace)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_istio_virtual_services(
    namespace: String,
    client_manager: State<'_, KubeClientManager>,
) -> Result<Vec<IstioVirtualServiceInfo>, String> {
    let client = client_manager
        .get_client()
        .await
        .map_err(|e| e.to_string())?;

    crate::kube::list_istio_virtual_services(client, &namespace)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_istio_gateways(
    namespace: String,
    client_manager: State<'_, KubeClientManager>,
) -> Result<Vec<IstioGatewayInfo>, String> {
    let client = client_manager
        .get_client()
        .await
        .map_err(|e| e.to_string())?;

    crate::kube::list_istio_gateways(client, &namespace)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_resource_yaml(
    resource_type: String,
    namespace: String,
    name: String,
    client_manager: State<'_, KubeClientManager>,
) -> Result<String, String> {
    let client = client_manager
        .get_client()
        .await
        .map_err(|e| e.to_string())?;

    crate::kube::get_resource_yaml(client, &resource_type, &namespace, &name)
        .await
        .map_err(|e| e.to_string())
}
