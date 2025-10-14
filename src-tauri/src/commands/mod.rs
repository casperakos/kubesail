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
pub async fn restart_deployment(
    namespace: String,
    deployment_name: String,
    client_manager: State<'_, KubeClientManager>,
) -> Result<(), String> {
    let client = client_manager
        .get_client()
        .await
        .map_err(|e| e.to_string())?;

    crate::kube::restart_deployment(client, &namespace, &deployment_name)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_deployment(
    namespace: String,
    deployment_name: String,
    client_manager: State<'_, KubeClientManager>,
) -> Result<(), String> {
    let client = client_manager
        .get_client()
        .await
        .map_err(|e| e.to_string())?;

    crate::kube::delete_deployment(client, &namespace, &deployment_name)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_service(
    namespace: String,
    service_name: String,
    client_manager: State<'_, KubeClientManager>,
) -> Result<(), String> {
    let client = client_manager
        .get_client()
        .await
        .map_err(|e| e.to_string())?;

    crate::kube::delete_service(client, &namespace, &service_name)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_configmap(
    namespace: String,
    configmap_name: String,
    client_manager: State<'_, KubeClientManager>,
) -> Result<(), String> {
    let client = client_manager
        .get_client()
        .await
        .map_err(|e| e.to_string())?;

    crate::kube::delete_configmap(client, &namespace, &configmap_name)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_secret(
    namespace: String,
    secret_name: String,
    client_manager: State<'_, KubeClientManager>,
) -> Result<(), String> {
    let client = client_manager
        .get_client()
        .await
        .map_err(|e| e.to_string())?;

    crate::kube::delete_secret(client, &namespace, &secret_name)
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
    namespace: Option<String>,
    name: String,
    client_manager: State<'_, KubeClientManager>,
) -> Result<String, String> {
    let client = client_manager
        .get_client()
        .await
        .map_err(|e| e.to_string())?;

    crate::kube::get_resource_yaml(client, &resource_type, namespace.as_deref().unwrap_or(""), &name)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_configmaps(
    namespace: String,
    client_manager: State<'_, KubeClientManager>,
) -> Result<Vec<ConfigMapInfo>, String> {
    let client = client_manager
        .get_client()
        .await
        .map_err(|e| e.to_string())?;

    crate::kube::list_configmaps(client, &namespace)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_secrets(
    namespace: String,
    client_manager: State<'_, KubeClientManager>,
) -> Result<Vec<SecretInfo>, String> {
    let client = client_manager
        .get_client()
        .await
        .map_err(|e| e.to_string())?;

    crate::kube::list_secrets(client, &namespace)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_statefulsets(
    namespace: String,
    client_manager: State<'_, KubeClientManager>,
) -> Result<Vec<StatefulSetInfo>, String> {
    let client = client_manager
        .get_client()
        .await
        .map_err(|e| e.to_string())?;

    crate::kube::list_statefulsets(client, &namespace)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_daemonsets(
    namespace: String,
    client_manager: State<'_, KubeClientManager>,
) -> Result<Vec<DaemonSetInfo>, String> {
    let client = client_manager
        .get_client()
        .await
        .map_err(|e| e.to_string())?;

    crate::kube::list_daemonsets(client, &namespace)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_jobs(
    namespace: String,
    client_manager: State<'_, KubeClientManager>,
) -> Result<Vec<JobInfo>, String> {
    let client = client_manager
        .get_client()
        .await
        .map_err(|e| e.to_string())?;

    crate::kube::list_jobs(client, &namespace)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_cronjobs(
    namespace: String,
    client_manager: State<'_, KubeClientManager>,
) -> Result<Vec<CronJobInfo>, String> {
    let client = client_manager
        .get_client()
        .await
        .map_err(|e| e.to_string())?;

    crate::kube::list_cronjobs(client, &namespace)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_nodes(
    client_manager: State<'_, KubeClientManager>,
) -> Result<Vec<NodeInfo>, String> {
    let client = client_manager
        .get_client()
        .await
        .map_err(|e| e.to_string())?;

    crate::kube::list_nodes(client)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_events(
    namespace: String,
    client_manager: State<'_, KubeClientManager>,
) -> Result<Vec<EventInfo>, String> {
    let client = client_manager
        .get_client()
        .await
        .map_err(|e| e.to_string())?;

    crate::kube::list_events(client, &namespace)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_persistent_volumes(
    client_manager: State<'_, KubeClientManager>,
) -> Result<Vec<PersistentVolumeInfo>, String> {
    let client = client_manager
        .get_client()
        .await
        .map_err(|e| e.to_string())?;

    crate::kube::list_persistent_volumes(client)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_persistent_volume_claims(
    namespace: String,
    client_manager: State<'_, KubeClientManager>,
) -> Result<Vec<PersistentVolumeClaimInfo>, String> {
    let client = client_manager
        .get_client()
        .await
        .map_err(|e| e.to_string())?;

    crate::kube::list_persistent_volume_claims(client, &namespace)
        .await
        .map_err(|e| e.to_string())
}

// RBAC Commands
#[tauri::command]
pub async fn get_roles(
    namespace: String,
    client_manager: State<'_, KubeClientManager>,
) -> Result<Vec<RoleInfo>, String> {
    let client = client_manager
        .get_client()
        .await
        .map_err(|e| e.to_string())?;

    crate::kube::list_roles(client, &namespace)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_role_bindings(
    namespace: String,
    client_manager: State<'_, KubeClientManager>,
) -> Result<Vec<RoleBindingInfo>, String> {
    let client = client_manager
        .get_client()
        .await
        .map_err(|e| e.to_string())?;

    crate::kube::list_role_bindings(client, &namespace)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_cluster_roles(
    client_manager: State<'_, KubeClientManager>,
) -> Result<Vec<ClusterRoleInfo>, String> {
    let client = client_manager
        .get_client()
        .await
        .map_err(|e| e.to_string())?;

    crate::kube::list_cluster_roles(client)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_cluster_role_bindings(
    client_manager: State<'_, KubeClientManager>,
) -> Result<Vec<ClusterRoleBindingInfo>, String> {
    let client = client_manager
        .get_client()
        .await
        .map_err(|e| e.to_string())?;

    crate::kube::list_cluster_role_bindings(client)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_service_accounts(
    namespace: String,
    client_manager: State<'_, KubeClientManager>,
) -> Result<Vec<ServiceAccountInfo>, String> {
    let client = client_manager
        .get_client()
        .await
        .map_err(|e| e.to_string())?;

    crate::kube::list_service_accounts(client, &namespace)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn apply_resource_yaml(
    resource_type: String,
    namespace: Option<String>,
    yaml_content: String,
    client_manager: State<'_, KubeClientManager>,
) -> Result<(), String> {
    let client = client_manager
        .get_client()
        .await
        .map_err(|e| e.to_string())?;

    crate::kube::apply_resource_yaml(client, &resource_type, namespace.as_deref().unwrap_or(""), &yaml_content)
        .await
        .map_err(|e| e.to_string())
}

// Port Forward Commands
#[tauri::command]
pub async fn start_port_forward(
    resource_type: String,
    resource_name: String,
    namespace: String,
    local_port: u16,
    remote_port: u16,
    portforward_manager: State<'_, crate::portforward::PortForwardManager>,
) -> Result<crate::types::PortForwardInfo, String> {
    portforward_manager
        .start_port_forward(&resource_type, &resource_name, &namespace, local_port, remote_port)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn stop_port_forward(
    id: String,
    portforward_manager: State<'_, crate::portforward::PortForwardManager>,
) -> Result<(), String> {
    portforward_manager
        .stop_port_forward(&id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn list_port_forwards(
    portforward_manager: State<'_, crate::portforward::PortForwardManager>,
) -> Result<Vec<crate::types::PortForwardInfo>, String> {
    Ok(portforward_manager.list_port_forwards().await)
}
