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

pub fn get_kubeconfig_path() -> Result<PathBuf> {
    if let Ok(path) = std::env::var("KUBECONFIG") {
        return Ok(PathBuf::from(path));
    }

    let home = std::env::var("HOME")
        .or_else(|_| std::env::var("USERPROFILE"))
        .map_err(|_| anyhow::anyhow!("Could not determine home directory"))?;

    Ok(PathBuf::from(home).join(".kube").join("config"))
}

pub fn load_kubeconfig() -> Result<KubeConfig> {
    let path = get_kubeconfig_path()?;
    let contents = std::fs::read_to_string(&path)
        .map_err(|e| anyhow::anyhow!("Failed to read kubeconfig from {:?}: {}", path, e))?;

    let config: KubeConfig = serde_yaml::from_str(&contents)
        .map_err(|e| anyhow::anyhow!("Failed to parse kubeconfig YAML: {}", e))?;

    Ok(config)
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
    let path = get_kubeconfig_path()?;
    let mut config = load_kubeconfig()?;

    // Verify the context exists
    if !config.contexts.iter().any(|ctx| ctx.name == context_name) {
        return Err(anyhow::anyhow!("Context '{}' not found in kubeconfig", context_name));
    }

    // Update current context
    config.current_context = context_name.to_string();

    // Write back to file
    let contents = serde_yaml::to_string(&config)
        .map_err(|e| anyhow::anyhow!("Failed to serialize kubeconfig: {}", e))?;

    std::fs::write(&path, contents)
        .map_err(|e| anyhow::anyhow!("Failed to write kubeconfig to {:?}: {}", path, e))?;

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
