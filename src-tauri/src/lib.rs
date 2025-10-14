mod commands;
mod kube;
mod portforward;
mod types;

use kube::KubeClientManager;
use portforward::PortForwardManager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Initialize logging
    tracing_subscriber::fmt::init();

    let client_manager = KubeClientManager::new();
    let portforward_manager = PortForwardManager::new();

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .manage(client_manager)
        .manage(portforward_manager)
        .invoke_handler(tauri::generate_handler![
            commands::get_kubeconfig_contexts,
            commands::get_clusters,
            commands::get_namespaces,
            commands::get_pods,
            commands::get_deployments,
            commands::get_services,
            commands::get_pod_logs,
            commands::delete_pod,
            commands::scale_deployment,
            commands::restart_deployment,
            commands::delete_deployment,
            commands::delete_service,
            commands::delete_configmap,
            commands::delete_secret,
            commands::reinit_kube_client,
            commands::get_ingresses,
            commands::get_istio_virtual_services,
            commands::get_istio_gateways,
            commands::get_resource_yaml,
            commands::get_configmaps,
            commands::get_secrets,
            commands::get_statefulsets,
            commands::get_daemonsets,
            commands::get_jobs,
            commands::get_cronjobs,
            commands::get_nodes,
            commands::get_events,
            commands::get_persistent_volumes,
            commands::get_persistent_volume_claims,
            commands::get_roles,
            commands::get_role_bindings,
            commands::get_cluster_roles,
            commands::get_cluster_role_bindings,
            commands::get_service_accounts,
            commands::apply_resource_yaml,
            commands::scale_statefulset,
            commands::restart_statefulset,
            commands::delete_statefulset,
            commands::restart_daemonset,
            commands::delete_daemonset,
            commands::delete_job,
            commands::suspend_cronjob,
            commands::resume_cronjob,
            commands::delete_cronjob,
            commands::start_port_forward,
            commands::stop_port_forward,
            commands::list_port_forwards,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
