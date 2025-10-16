use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct KubeConfig {
    #[serde(rename = "current-context")]
    pub current_context: String,
    pub contexts: Vec<ContextEntry>,
    pub clusters: Vec<ClusterEntry>,
    pub users: Vec<UserEntry>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ContextEntry {
    pub name: String,
    pub context: Context,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Context {
    pub cluster: String,
    pub user: String,
    pub namespace: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ClusterEntry {
    pub name: String,
    pub cluster: Cluster,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Cluster {
    pub server: String,
    #[serde(rename = "certificate-authority-data")]
    pub certificate_authority_data: Option<String>,
    #[serde(rename = "certificate-authority")]
    pub certificate_authority: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct UserEntry {
    pub name: String,
    pub user: User,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct User {
    #[serde(rename = "client-certificate-data")]
    pub client_certificate_data: Option<String>,
    #[serde(rename = "client-key-data")]
    pub client_key_data: Option<String>,
    pub token: Option<String>,
    pub exec: Option<ExecConfig>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ExecConfig {
    #[serde(rename = "apiVersion")]
    pub api_version: String,
    pub command: String,
    pub args: Option<Vec<String>>,
    pub env: Option<Vec<EnvVar>>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct EnvVar {
    pub name: String,
    pub value: String,
}

pub fn get_kubeconfig_paths() -> Result<Vec<PathBuf>> {
    if let Ok(paths_str) = std::env::var("KUBECONFIG") {
        // Split by colon (Unix) or semicolon (Windows)
        let separator = if cfg!(windows) { ';' } else { ':' };
        let paths: Vec<PathBuf> = paths_str
            .split(separator)
            .filter(|s| !s.is_empty())
            .map(PathBuf::from)
            .collect();

        if !paths.is_empty() {
            return Ok(paths);
        }
    }

    let home = std::env::var("HOME")
        .or_else(|_| std::env::var("USERPROFILE"))
        .map_err(|_| anyhow::anyhow!("Could not determine home directory"))?;

    Ok(vec![PathBuf::from(home).join(".kube").join("config")])
}

pub fn get_kubeconfig_path() -> Result<PathBuf> {
    // For backwards compatibility, return the first path
    let paths = get_kubeconfig_paths()?;
    paths.into_iter().next()
        .ok_or_else(|| anyhow::anyhow!("No kubeconfig path found"))
}

pub fn load_kubeconfig() -> Result<KubeConfig> {
    let paths = get_kubeconfig_paths()?;

    // Load and merge all kubeconfig files
    let mut merged_config: Option<KubeConfig> = None;
    let mut first_current_context: Option<String> = None;

    for (index, path) in paths.iter().enumerate() {
        if !path.exists() {
            continue; // Skip non-existent files
        }

        let contents = std::fs::read_to_string(&path)
            .map_err(|e| anyhow::anyhow!("Failed to read kubeconfig from {:?}: {}", path, e))?;

        let config: KubeConfig = serde_yaml::from_str(&contents)
            .map_err(|e| anyhow::anyhow!("Failed to parse kubeconfig YAML from {:?}: {}", path, e))?;

        // Save the current context from the first file
        if index == 0 {
            first_current_context = Some(config.current_context.clone());
        }

        if let Some(ref mut merged) = merged_config {
            // Merge contexts, clusters, and users (avoid duplicates)
            for ctx in &config.contexts {
                if !merged.contexts.iter().any(|c| c.name == ctx.name) {
                    merged.contexts.push(ctx.clone());
                }
            }
            for cluster in &config.clusters {
                if !merged.clusters.iter().any(|c| c.name == cluster.name) {
                    merged.clusters.push(cluster.clone());
                }
            }
            for user in &config.users {
                if !merged.users.iter().any(|u| u.name == user.name) {
                    merged.users.push(user.clone());
                }
            }
        } else {
            merged_config = Some(config);
        }
    }

    let mut final_config = merged_config.ok_or_else(|| anyhow::anyhow!("No valid kubeconfig files found"))?;

    // Use the current context from the first file, kubectl-style
    if let Some(first_ctx) = first_current_context {
        final_config.current_context = first_ctx;
    }

    Ok(final_config)
}

pub fn get_current_context(config: &KubeConfig) -> Option<&ContextEntry> {
    config.contexts.iter()
        .find(|ctx| ctx.name == config.current_context)
}

// Helper function for future use
#[allow(dead_code)]
pub fn get_cluster_by_name<'a>(config: &'a KubeConfig, name: &str) -> Option<&'a ClusterEntry> {
    config.clusters.iter().find(|c| c.name == name)
}

pub fn switch_context(context_name: &str) -> Result<()> {
    let paths = get_kubeconfig_paths()?;

    // Verify the context exists in the merged config
    let merged_config = load_kubeconfig()?;
    if !merged_config.contexts.iter().any(|ctx| ctx.name == context_name) {
        return Err(anyhow::anyhow!("Context '{}' not found in kubeconfig", context_name));
    }

    // Update the first kubeconfig file only (kubectl-style behavior)
    let first_path = paths.first()
        .ok_or_else(|| anyhow::anyhow!("No kubeconfig path found"))?;

    // Load the first file specifically (not merged)
    let contents = std::fs::read_to_string(&first_path)
        .map_err(|e| anyhow::anyhow!("Failed to read kubeconfig from {:?}: {}", first_path, e))?;

    let mut config: KubeConfig = serde_yaml::from_str(&contents)
        .map_err(|e| anyhow::anyhow!("Failed to parse kubeconfig YAML: {}", e))?;

    // Update current context
    config.current_context = context_name.to_string();

    // Write back to the first file only
    let updated_contents = serde_yaml::to_string(&config)
        .map_err(|e| anyhow::anyhow!("Failed to serialize kubeconfig: {}", e))?;

    std::fs::write(&first_path, updated_contents)
        .map_err(|e| anyhow::anyhow!("Failed to write kubeconfig to {:?}: {}", first_path, e))?;

    Ok(())
}

pub fn load_custom_kubeconfig(path: &str) -> Result<KubeConfig> {
    let path = PathBuf::from(path);
    let contents = std::fs::read_to_string(&path)
        .map_err(|e| anyhow::anyhow!("Failed to read kubeconfig from {:?}: {}", path, e))?;

    let config: KubeConfig = serde_yaml::from_str(&contents)
        .map_err(|e| anyhow::anyhow!("Failed to parse kubeconfig YAML: {}", e))?;

    Ok(config)
}

pub fn set_kubeconfig_path(path: &str) -> Result<()> {
    std::env::set_var("KUBECONFIG", path);
    Ok(())
}
