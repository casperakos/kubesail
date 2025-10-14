use crate::types::PortForwardInfo;
use anyhow::{Context, Result};
use std::collections::HashMap;
use std::process::{Child, Command, Stdio};
use std::sync::Arc;
use tokio::sync::Mutex;

pub struct PortForwardManager {
    forwards: Arc<Mutex<HashMap<String, PortForwardHandle>>>,
}

struct PortForwardHandle {
    info: PortForwardInfo,
    process: Option<Child>,
}

impl PortForwardManager {
    pub fn new() -> Self {
        Self {
            forwards: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    pub async fn start_port_forward(
        &self,
        resource_type: &str,
        resource_name: &str,
        namespace: &str,
        local_port: u16,
        remote_port: u16,
    ) -> Result<PortForwardInfo> {
        let id = format!("{}-{}-{}-{}", resource_type, namespace, resource_name, local_port);

        // Check if already running
        {
            let forwards = self.forwards.lock().await;
            if forwards.contains_key(&id) {
                return Err(anyhow::anyhow!("Port forward already exists"));
            }
        }

        // Start kubectl port-forward
        let child = Command::new("kubectl")
            .arg("port-forward")
            .arg("-n")
            .arg(namespace)
            .arg(format!("{}/{}", resource_type, resource_name))
            .arg(format!("{}:{}", local_port, remote_port))
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .context("Failed to start kubectl port-forward")?;

        let info = PortForwardInfo {
            id: id.clone(),
            resource_type: resource_type.to_string(),
            resource_name: resource_name.to_string(),
            namespace: namespace.to_string(),
            local_port,
            remote_port,
            status: "running".to_string(),
        };

        let handle = PortForwardHandle {
            info: info.clone(),
            process: Some(child),
        };

        let mut forwards = self.forwards.lock().await;
        forwards.insert(id, handle);

        Ok(info)
    }

    pub async fn stop_port_forward(&self, id: &str) -> Result<()> {
        let mut forwards = self.forwards.lock().await;

        if let Some(mut handle) = forwards.remove(id) {
            if let Some(mut process) = handle.process.take() {
                process.kill().context("Failed to kill port-forward process")?;
            }
            Ok(())
        } else {
            Err(anyhow::anyhow!("Port forward not found"))
        }
    }

    pub async fn list_port_forwards(&self) -> Vec<PortForwardInfo> {
        let mut forwards = self.forwards.lock().await;

        // Clean up dead processes
        forwards.retain(|_, handle| {
            if let Some(ref mut process) = handle.process {
                match process.try_wait() {
                    Ok(Some(_)) => false, // Process exited, remove it
                    Ok(None) => true,     // Still running
                    Err(_) => false,      // Error checking status, remove it
                }
            } else {
                false
            }
        });

        forwards.values().map(|h| h.info.clone()).collect()
    }

    pub async fn stop_all(&self) -> Result<()> {
        let mut forwards = self.forwards.lock().await;

        for (_, mut handle) in forwards.drain() {
            if let Some(mut process) = handle.process.take() {
                let _ = process.kill();
            }
        }

        Ok(())
    }
}

impl Drop for PortForwardHandle {
    fn drop(&mut self) {
        if let Some(mut process) = self.process.take() {
            let _ = process.kill();
        }
    }
}
