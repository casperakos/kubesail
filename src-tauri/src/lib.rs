mod commands;
mod kube;
mod types;

use kube::KubeClientManager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Initialize logging
    tracing_subscriber::fmt::init();

    let client_manager = KubeClientManager::new();

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .manage(client_manager)
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
            commands::reinit_kube_client,
            commands::get_ingresses,
            commands::get_istio_virtual_services,
            commands::get_istio_gateways,
            commands::get_resource_yaml,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
