use crate::kube::{get_current_context, load_kubeconfig, KubeClientManager};
use crate::shell::ShellManager;
use crate::types::*;
use tauri::{AppHandle, State};

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
pub async fn switch_kube_context(
    context_name: String,
    client_manager: State<'_, KubeClientManager>,
) -> Result<(), String> {
    crate::kube::switch_context(&context_name)
        .map_err(|e| e.to_string())?;

    client_manager
        .reinit_client()
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn load_custom_kubeconfig_file(
    path: String,
    client_manager: State<'_, KubeClientManager>,
) -> Result<(), String> {
    crate::kube::set_kubeconfig_path(&path)
        .map_err(|e| e.to_string())?;

    client_manager
        .reinit_client()
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_current_context_info() -> Result<Option<ContextInfo>, String> {
    let config = crate::kube::load_kubeconfig()
        .map_err(|e| e.to_string())?;

    let current = crate::kube::get_current_context(&config);

    Ok(current.map(|ctx| ContextInfo {
        name: ctx.name.clone(),
        cluster: ctx.context.cluster.clone(),
        namespace: ctx.context.namespace.clone(),
        user: ctx.context.user.clone(),
        current: true,
    }))
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

#[tauri::command]
pub async fn scale_statefulset(
    namespace: String,
    statefulset_name: String,
    replicas: i32,
    client_manager: State<'_, KubeClientManager>,
) -> Result<(), String> {
    let client = client_manager
        .get_client()
        .await
        .map_err(|e| e.to_string())?;

    crate::kube::scale_statefulset(client, &namespace, &statefulset_name, replicas)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn restart_statefulset(
    namespace: String,
    statefulset_name: String,
    client_manager: State<'_, KubeClientManager>,
) -> Result<(), String> {
    let client = client_manager
        .get_client()
        .await
        .map_err(|e| e.to_string())?;

    crate::kube::restart_statefulset(client, &namespace, &statefulset_name)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_statefulset(
    namespace: String,
    statefulset_name: String,
    client_manager: State<'_, KubeClientManager>,
) -> Result<(), String> {
    let client = client_manager
        .get_client()
        .await
        .map_err(|e| e.to_string())?;

    crate::kube::delete_statefulset(client, &namespace, &statefulset_name)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn restart_daemonset(
    namespace: String,
    daemonset_name: String,
    client_manager: State<'_, KubeClientManager>,
) -> Result<(), String> {
    let client = client_manager
        .get_client()
        .await
        .map_err(|e| e.to_string())?;

    crate::kube::restart_daemonset(client, &namespace, &daemonset_name)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_daemonset(
    namespace: String,
    daemonset_name: String,
    client_manager: State<'_, KubeClientManager>,
) -> Result<(), String> {
    let client = client_manager
        .get_client()
        .await
        .map_err(|e| e.to_string())?;

    crate::kube::delete_daemonset(client, &namespace, &daemonset_name)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_job(
    namespace: String,
    job_name: String,
    client_manager: State<'_, KubeClientManager>,
) -> Result<(), String> {
    let client = client_manager
        .get_client()
        .await
        .map_err(|e| e.to_string())?;

    crate::kube::delete_job(client, &namespace, &job_name)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn suspend_cronjob(
    namespace: String,
    cronjob_name: String,
    client_manager: State<'_, KubeClientManager>,
) -> Result<(), String> {
    let client = client_manager.get_client().await.map_err(|e| e.to_string())?;
    crate::kube::suspend_cronjob(client, &namespace, &cronjob_name)
        .await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn resume_cronjob(
    namespace: String,
    cronjob_name: String,
    client_manager: State<'_, KubeClientManager>,
) -> Result<(), String> {
    let client = client_manager.get_client().await.map_err(|e| e.to_string())?;
    crate::kube::resume_cronjob(client, &namespace, &cronjob_name)
        .await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_cronjob(
    namespace: String,
    cronjob_name: String,
    client_manager: State<'_, KubeClientManager>,
) -> Result<(), String> {
    let client = client_manager.get_client().await.map_err(|e| e.to_string())?;
    crate::kube::delete_cronjob(client, &namespace, &cronjob_name)
        .await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_pods_for_resource(
    resource_type: String,
    resource_name: String,
    namespace: String,
    client_manager: State<'_, KubeClientManager>,
) -> Result<Vec<PodInfo>, String> {
    let client = client_manager.get_client().await.map_err(|e| e.to_string())?;
    crate::kube::get_pods_for_resource(client, &resource_type, &resource_name, &namespace)
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

// Node Operations
#[tauri::command]
pub async fn cordon_node(
    node_name: String,
    client_manager: State<'_, KubeClientManager>,
) -> Result<(), String> {
    let client = client_manager
        .get_client()
        .await
        .map_err(|e| e.to_string())?;

    crate::kube::cordon_node(client, &node_name)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn uncordon_node(
    node_name: String,
    client_manager: State<'_, KubeClientManager>,
) -> Result<(), String> {
    let client = client_manager
        .get_client()
        .await
        .map_err(|e| e.to_string())?;

    crate::kube::uncordon_node(client, &node_name)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn drain_node(
    node_name: String,
    client_manager: State<'_, KubeClientManager>,
) -> Result<(), String> {
    let client = client_manager
        .get_client()
        .await
        .map_err(|e| e.to_string())?;

    crate::kube::drain_node(client, &node_name)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_node(
    node_name: String,
    client_manager: State<'_, KubeClientManager>,
) -> Result<(), String> {
    let client = client_manager
        .get_client()
        .await
        .map_err(|e| e.to_string())?;

    crate::kube::delete_node(client, &node_name)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn describe_node(
    node_name: String,
    client_manager: State<'_, KubeClientManager>,
) -> Result<String, String> {
    let client = client_manager
        .get_client()
        .await
        .map_err(|e| e.to_string())?;

    crate::kube::describe_node(client, &node_name)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn describe_resource(
    resource_type: String,
    namespace: Option<String>,
    name: String,
    client_manager: State<'_, KubeClientManager>,
) -> Result<String, String> {
    let client = client_manager
        .get_client()
        .await
        .map_err(|e| e.to_string())?;

    crate::kube::describe_resource(
        client,
        &resource_type,
        namespace.as_deref(),
        &name,
    )
    .await
    .map_err(|e| e.to_string())
}

// Shell commands
#[tauri::command]
pub async fn start_shell_session(
    app: AppHandle,
    pod_name: String,
    namespace: String,
    container: Option<String>,
    shell: Option<String>,
    client_manager: State<'_, KubeClientManager>,
    shell_manager: State<'_, ShellManager>,
) -> Result<String, String> {
    let client = client_manager
        .get_client()
        .await
        .map_err(|e| e.to_string())?;

    shell_manager
        .start_session(app, client, pod_name, namespace, container, shell)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn send_shell_input(
    session_id: String,
    data: String,
    shell_manager: State<'_, ShellManager>,
) -> Result<(), String> {
    shell_manager
        .send_input(&session_id, data)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn close_shell_session(
    session_id: String,
    shell_manager: State<'_, ShellManager>,
) -> Result<(), String> {
    shell_manager
        .close_session(&session_id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_pod_containers(
    pod_name: String,
    namespace: String,
    client_manager: State<'_, KubeClientManager>,
) -> Result<Vec<String>, String> {
    let client = client_manager
        .get_client()
        .await
        .map_err(|e| e.to_string())?;

    crate::kube::get_pod_containers(client, &namespace, &pod_name)
        .await
        .map_err(|e| e.to_string())
}

// CRD Commands
#[tauri::command]
pub async fn get_crds(
    client_manager: State<'_, KubeClientManager>,
) -> Result<Vec<CRDInfo>, String> {
    let client = client_manager
        .get_client()
        .await
        .map_err(|e| e.to_string())?;

    crate::kube::list_crds(client)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_custom_resources(
    client_manager: State<'_, KubeClientManager>,
    group: String,
    version: String,
    plural: String,
    namespace: Option<String>,
) -> Result<Vec<CustomResourceInfo>, String> {
    let client = client_manager
        .get_client()
        .await
        .map_err(|e| e.to_string())?;

    crate::kube::list_custom_resources(
        client,
        &group,
        &version,
        &plural,
        namespace.as_deref(),
    )
    .await
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_custom_resource(
    client_manager: State<'_, KubeClientManager>,
    group: String,
    version: String,
    plural: String,
    name: String,
    namespace: Option<String>,
) -> Result<(), String> {
    let client = client_manager
        .get_client()
        .await
        .map_err(|e| e.to_string())?;

    crate::kube::delete_custom_resource(
        client,
        &group,
        &version,
        &plural,
        &name,
        namespace.as_deref(),
    )
    .await
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_custom_resource_yaml(
    client_manager: State<'_, KubeClientManager>,
    group: String,
    version: String,
    plural: String,
    name: String,
    namespace: Option<String>,
) -> Result<String, String> {
    let client = client_manager
        .get_client()
        .await
        .map_err(|e| e.to_string())?;

    crate::kube::get_custom_resource_yaml(
        client,
        &group,
        &version,
        &plural,
        &name,
        namespace.as_deref(),
    )
    .await
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn describe_custom_resource(
    client_manager: State<'_, KubeClientManager>,
    group: String,
    version: String,
    plural: String,
    name: String,
    namespace: Option<String>,
) -> Result<String, String> {
    let client = client_manager
        .get_client()
        .await
        .map_err(|e| e.to_string())?;

    crate::kube::describe_custom_resource(
        client,
        &group,
        &version,
        &plural,
        &name,
        namespace.as_deref(),
    )
    .await
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn sync_argocd_app(
    client_manager: State<'_, KubeClientManager>,
    name: String,
    namespace: String,
) -> Result<(), String> {
    let client = client_manager
        .get_client()
        .await
        .map_err(|e| e.to_string())?;

    crate::kube::sync_argocd_app(client, &name, &namespace)
        .await
        .map_err(|e| e.to_string())
}
