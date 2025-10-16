mod commands;
mod helm;
mod kube;
mod metrics;
mod portforward;
mod shell;
mod types;

use kube::KubeClientManager;
use portforward::PortForwardManager;
use shell::ShellManager;

/// Set up PATH environment variable to include common locations for kubectl and its plugins
fn setup_path_env() {
    use std::env;

    let current_path = env::var("PATH").unwrap_or_default();
    let mut paths: Vec<String> = vec![];

    // Add current PATH
    if !current_path.is_empty() {
        paths.push(current_path);
    }

    // Add common locations for kubectl plugins and binaries
    if let Ok(home) = env::var("HOME") {
        // Homebrew locations (macOS)
        paths.push("/opt/homebrew/bin".to_string());
        paths.push("/usr/local/bin".to_string());

        // User's local bin
        paths.push(format!("{}/.local/bin", home));
        paths.push(format!("{}/bin", home));

        // Krew (kubectl plugin manager)
        paths.push(format!("{}/.krew/bin", home));
    }

    // System paths
    paths.push("/usr/bin".to_string());
    paths.push("/bin".to_string());
    paths.push("/usr/sbin".to_string());
    paths.push("/sbin".to_string());

    // Windows paths
    if cfg!(target_os = "windows") {
        if let Ok(programfiles) = env::var("ProgramFiles") {
            paths.push(format!("{}\\kubectl", programfiles));
        }
    }

    // Join all paths with the appropriate separator
    let separator = if cfg!(target_os = "windows") { ";" } else { ":" };
    let new_path = paths.join(separator);

    env::set_var("PATH", &new_path);
    tracing::info!("Set PATH to: {}", new_path);
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Initialize logging
    tracing_subscriber::fmt::init();

    // Set up PATH to include common locations for kubectl and its plugins
    setup_path_env();

    let client_manager = KubeClientManager::new();
    let portforward_manager = PortForwardManager::new();
    let shell_manager = ShellManager::new();

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .manage(client_manager)
        .manage(portforward_manager)
        .manage(shell_manager)
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
            commands::switch_kube_context,
            commands::load_custom_kubeconfig_file,
            commands::get_current_context_info,
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
            commands::get_pods_for_resource,
            commands::start_port_forward,
            commands::stop_port_forward,
            commands::list_port_forwards,
            commands::cordon_node,
            commands::uncordon_node,
            commands::drain_node,
            commands::delete_node,
            commands::describe_node,
            commands::describe_resource,
            commands::start_shell_session,
            commands::send_shell_input,
            commands::close_shell_session,
            commands::get_pod_containers,
            commands::get_crds,
            commands::get_custom_resources,
            commands::delete_custom_resource,
            commands::get_custom_resource_yaml,
            commands::update_custom_resource_yaml,
            commands::describe_custom_resource,
            commands::sync_argocd_app,
            commands::helm_check_installed,
            commands::helm_list_releases,
            commands::helm_get_release,
            commands::helm_get_manifest,
            commands::helm_get_values,
            commands::helm_uninstall_release,
            commands::helm_rollback_release,
            commands::helm_get_history,
            commands::helm_upgrade_release,
            commands::detect_metrics_capabilities,
            commands::get_cluster_metrics_data,
            commands::get_namespace_pod_metrics,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
