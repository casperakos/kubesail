use anyhow::{anyhow, Result};
use serde::{Deserialize, Serialize};
use tokio::process::Command;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HelmRelease {
    pub name: String,
    pub namespace: String,
    pub revision: String,
    pub updated: String,
    pub status: String,
    pub chart: String,
    pub app_version: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HelmReleaseDetail {
    pub name: String,
    pub info: HelmReleaseInfo,
    pub chart: HelmChart,
    pub config: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HelmReleaseInfo {
    pub first_deployed: String,
    pub last_deployed: String,
    pub deleted: String,
    pub description: String,
    pub status: String,
    pub notes: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HelmChart {
    pub metadata: HelmChartMetadata,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HelmChartMetadata {
    pub name: String,
    pub version: String,
    pub description: Option<String>,
    pub api_version: String,
    pub app_version: Option<String>,
    pub keywords: Option<Vec<String>>,
    pub home: Option<String>,
    pub sources: Option<Vec<String>>,
}

/// Check if helm CLI is available
pub async fn check_helm_installed() -> Result<bool> {
    let output = Command::new("helm").arg("version").output().await?;
    Ok(output.status.success())
}

/// List all Helm releases in a namespace or all namespaces
pub async fn list_releases(namespace: Option<&str>, all_namespaces: bool) -> Result<Vec<HelmRelease>> {
    let mut cmd = Command::new("helm");
    cmd.arg("list");
    cmd.arg("--output").arg("json");

    if all_namespaces {
        cmd.arg("--all-namespaces");
    } else if let Some(ns) = namespace {
        cmd.arg("--namespace").arg(ns);
    }

    let output = cmd.output().await?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(anyhow!("Failed to list Helm releases: {}", stderr));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let releases: Vec<HelmRelease> = serde_json::from_str(&stdout)?;
    Ok(releases)
}

/// Get details of a specific Helm release
pub async fn get_release(name: &str, namespace: &str) -> Result<HelmReleaseDetail> {
    let mut cmd = Command::new("helm");
    cmd.arg("get").arg("all");
    cmd.arg(name);
    cmd.arg("--namespace").arg(namespace);
    cmd.arg("--output").arg("json");

    let output = cmd.output().await?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(anyhow!("Failed to get Helm release: {}", stderr));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let release: HelmReleaseDetail = serde_json::from_str(&stdout)?;
    Ok(release)
}

/// Get the manifest (rendered Kubernetes resources) of a Helm release
pub async fn get_manifest(name: &str, namespace: &str) -> Result<String> {
    let mut cmd = Command::new("helm");
    cmd.arg("get").arg("manifest");
    cmd.arg(name);
    cmd.arg("--namespace").arg(namespace);

    let output = cmd.output().await?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(anyhow!("Failed to get Helm manifest: {}", stderr));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    Ok(stdout.to_string())
}

/// Get the values of a Helm release
pub async fn get_values(name: &str, namespace: &str) -> Result<String> {
    let mut cmd = Command::new("helm");
    cmd.arg("get").arg("values");
    cmd.arg(name);
    cmd.arg("--namespace").arg(namespace);
    cmd.arg("--output").arg("yaml");

    let output = cmd.output().await?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(anyhow!("Failed to get Helm values: {}", stderr));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    Ok(stdout.to_string())
}

/// Uninstall a Helm release
pub async fn uninstall_release(name: &str, namespace: &str) -> Result<String> {
    let mut cmd = Command::new("helm");
    cmd.arg("uninstall");
    cmd.arg(name);
    cmd.arg("--namespace").arg(namespace);

    let output = cmd.output().await?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(anyhow!("Failed to uninstall Helm release: {}", stderr));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    Ok(stdout.to_string())
}

/// Rollback a Helm release to a previous revision
pub async fn rollback_release(name: &str, namespace: &str, revision: u32) -> Result<String> {
    let mut cmd = Command::new("helm");
    cmd.arg("rollback");
    cmd.arg(name);
    cmd.arg(revision.to_string());
    cmd.arg("--namespace").arg(namespace);

    let output = cmd.output().await?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(anyhow!("Failed to rollback Helm release: {}", stderr));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    Ok(stdout.to_string())
}

/// Get the history of a Helm release
pub async fn get_history(name: &str, namespace: &str) -> Result<Vec<serde_json::Value>> {
    let mut cmd = Command::new("helm");
    cmd.arg("history");
    cmd.arg(name);
    cmd.arg("--namespace").arg(namespace);
    cmd.arg("--output").arg("json");

    let output = cmd.output().await?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(anyhow!("Failed to get Helm history: {}", stderr));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let history: Vec<serde_json::Value> = serde_json::from_str(&stdout)?;
    Ok(history)
}

/// Get default values for a Helm chart
pub async fn get_chart_values(chart: &str) -> Result<String> {
    let mut cmd = Command::new("helm");
    cmd.arg("show");
    cmd.arg("values");
    cmd.arg(chart);

    let output = cmd.output().await?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(anyhow!("Failed to get chart values: {}", stderr));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    Ok(stdout.to_string())
}

/// Upgrade a Helm release with new values
pub async fn upgrade_release(
    name: &str,
    chart: &str,
    namespace: &str,
    values: Option<&str>,
    create_namespace: bool,
    version: Option<&str>,
) -> Result<String> {
    let mut cmd = Command::new("helm");
    cmd.arg("upgrade");
    cmd.arg(name);
    cmd.arg(chart);
    cmd.arg("--namespace").arg(namespace);
    cmd.arg("--install"); // Install if not exists

    if create_namespace {
        cmd.arg("--create-namespace");
    }

    if let Some(ver) = version {
        cmd.arg("--version").arg(ver);
    }

    if let Some(vals) = values {
        // Write values to a temporary file
        let temp_file = std::env::temp_dir().join(format!("helm-values-{}.yaml", uuid::Uuid::new_v4()));
        tokio::fs::write(&temp_file, vals).await?;
        cmd.arg("--values").arg(&temp_file);
    }

    let output = cmd.output().await?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(anyhow!("Failed to upgrade Helm release: {}", stderr));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    Ok(stdout.to_string())
}
