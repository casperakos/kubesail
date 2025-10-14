use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClusterInfo {
    pub name: String,
    pub server: String,
    pub current: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContextInfo {
    pub name: String,
    pub cluster: String,
    pub namespace: Option<String>,
    pub user: String,
    pub current: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NamespaceInfo {
    pub name: String,
    pub status: String,
    pub age: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PodInfo {
    pub name: String,
    pub namespace: String,
    pub status: String,
    pub ready: String,
    pub restarts: i32,
    pub age: String,
    pub node: Option<String>,
    pub ip: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeploymentInfo {
    pub name: String,
    pub namespace: String,
    pub ready: String,
    pub up_to_date: i32,
    pub available: i32,
    pub age: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServiceInfo {
    pub name: String,
    pub namespace: String,
    pub service_type: String,
    pub cluster_ip: String,
    pub external_ip: Option<String>,
    pub ports: String,
    pub age: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LogEntry {
    pub timestamp: Option<String>,
    pub message: String,
    pub pod_name: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PortForwardRequest {
    pub namespace: String,
    pub pod_name: String,
    pub local_port: u16,
    pub remote_port: u16,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IngressInfo {
    pub name: String,
    pub namespace: String,
    pub class: Option<String>,
    pub hosts: Vec<String>,
    pub addresses: Vec<String>,
    pub age: String,
    pub tls: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IngressRule {
    pub host: String,
    pub paths: Vec<IngressPath>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IngressPath {
    pub path: String,
    pub path_type: String,
    pub service: String,
    pub port: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IstioVirtualServiceInfo {
    pub name: String,
    pub namespace: String,
    pub hosts: Vec<String>,
    pub gateways: Vec<String>,
    pub age: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IstioGatewayInfo {
    pub name: String,
    pub namespace: String,
    pub servers: Vec<GatewayServer>,
    pub age: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GatewayServer {
    pub port: u16,
    pub protocol: String,
    pub hosts: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConfigMapInfo {
    pub name: String,
    pub namespace: String,
    pub data: std::collections::HashMap<String, String>,
    pub age: String,
    pub keys: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SecretInfo {
    pub name: String,
    pub namespace: String,
    pub secret_type: String,
    pub data: std::collections::HashMap<String, String>, // base64 decoded
    pub age: String,
    pub keys: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StatefulSetInfo {
    pub name: String,
    pub namespace: String,
    pub ready: String,
    pub replicas: i32,
    pub age: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DaemonSetInfo {
    pub name: String,
    pub namespace: String,
    pub desired: i32,
    pub current: i32,
    pub ready: i32,
    pub up_to_date: i32,
    pub available: i32,
    pub age: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JobInfo {
    pub name: String,
    pub namespace: String,
    pub completions: String,
    pub duration: String,
    pub age: String,
    pub active: i32,
    pub succeeded: i32,
    pub failed: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CronJobInfo {
    pub name: String,
    pub namespace: String,
    pub schedule: String,
    pub suspend: bool,
    pub active: i32,
    pub last_schedule: Option<String>,
    pub age: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NodeInfo {
    pub name: String,
    pub status: String,
    pub roles: Vec<String>,
    pub age: String,
    pub version: String,
    pub internal_ip: String,
    pub os_image: String,
    pub kernel_version: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EventInfo {
    pub event_type: String,
    pub reason: String,
    pub object: String,
    pub message: String,
    pub source: String,
    pub first_seen: String,
    pub last_seen: String,
    pub count: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PersistentVolumeInfo {
    pub name: String,
    pub capacity: String,
    pub access_modes: Vec<String>,
    pub reclaim_policy: String,
    pub status: String,
    pub claim: Option<String>,
    pub storage_class: Option<String>,
    pub age: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PersistentVolumeClaimInfo {
    pub name: String,
    pub namespace: String,
    pub status: String,
    pub volume: Option<String>,
    pub capacity: Option<String>,
    pub access_modes: Vec<String>,
    pub storage_class: Option<String>,
    pub age: String,
}

// RBAC Types
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RoleInfo {
    pub name: String,
    pub namespace: String,
    pub age: String,
    pub rules_count: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RoleBindingInfo {
    pub name: String,
    pub namespace: String,
    pub role: String,
    pub role_kind: String,
    pub subjects: Vec<SubjectInfo>,
    pub age: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClusterRoleInfo {
    pub name: String,
    pub age: String,
    pub rules_count: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClusterRoleBindingInfo {
    pub name: String,
    pub role: String,
    pub subjects: Vec<SubjectInfo>,
    pub age: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServiceAccountInfo {
    pub name: String,
    pub namespace: String,
    pub secrets: usize,
    pub age: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SubjectInfo {
    pub kind: String,
    pub name: String,
    pub namespace: Option<String>,
}
