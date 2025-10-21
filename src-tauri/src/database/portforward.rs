use crate::database::{DatabaseError, DatabaseResult};
use crate::portforward::PortForwardManager;
use std::sync::Arc;
use tokio::sync::RwLock;

/// Database port forward information
#[derive(Debug, Clone)]
pub struct DatabasePortForward {
    pub connection_id: String,
    pub port_forward_id: String,  // ID used by PortForwardManager
    pub local_port: u16,
    pub namespace: String,
    pub service_name: String,
    pub remote_port: u16,
}

impl DatabasePortForward {
    /// Create a new port forward for a CloudNativePG cluster
    ///
    /// This creates a port-forward to the read-write service of the cluster
    /// Service name format: {cluster_name}-rw
    /// Port: 5432 (PostgreSQL default)
    pub async fn create(
        pf_manager: &PortForwardManager,
        cluster_name: &str,
        namespace: &str,
        connection_id: String,
    ) -> DatabaseResult<Self> {
        tracing::info!(
            "Creating port-forward for database cluster: {}/{}",
            namespace,
            cluster_name
        );

        // CloudNativePG read-write service naming convention
        let service_name = format!("{}-rw", cluster_name);
        let remote_port = 5432;

        // Find a free local port
        let local_port = Self::find_free_port().await?;

        tracing::info!(
            "Creating port-forward: localhost:{} -> {}.{}:{}",
            local_port,
            service_name,
            namespace,
            remote_port
        );

        // Create the port-forward using the existing infrastructure
        // The port-forward manager will handle the actual kubectl port-forward
        let pf_info = pf_manager
            .start_port_forward(
                "service",
                &service_name,
                namespace,
                local_port,
                remote_port,
            )
            .await
            .map_err(|e| {
                DatabaseError::PortForwardError(format!("Failed to create port-forward: {}", e))
            })?;

        tracing::info!(
            "Port-forward created successfully: {} -> localhost:{}",
            service_name,
            local_port
        );

        Ok(Self {
            connection_id,
            port_forward_id: pf_info.id,
            local_port,
            namespace: namespace.to_string(),
            service_name,
            remote_port,
        })
    }

    /// Find an available port for port-forwarding
    async fn find_free_port() -> DatabaseResult<u16> {
        use std::net::{TcpListener, SocketAddr};

        // Bind to port 0 to let the OS assign a free port
        let listener = TcpListener::bind("127.0.0.1:0").map_err(|e| {
            DatabaseError::PortForwardError(format!("Failed to find free port: {}", e))
        })?;

        let addr = listener.local_addr().map_err(|e| {
            DatabaseError::PortForwardError(format!("Failed to get local address: {}", e))
        })?;

        Ok(addr.port())
    }

    /// Stop the port-forward
    pub async fn stop(
        pf_manager: &PortForwardManager,
        port_forward_id: &str,
    ) -> DatabaseResult<()> {
        tracing::info!("Stopping port-forward: {}", port_forward_id);

        pf_manager
            .stop_port_forward(port_forward_id)
            .await
            .map_err(|e| {
                DatabaseError::PortForwardError(format!("Failed to stop port-forward: {}", e))
            })?;

        tracing::info!("Port-forward stopped successfully");
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_find_free_port() {
        let port = DatabasePortForward::find_free_port().await;
        assert!(port.is_ok());
        let port_num = port.unwrap();
        assert!(port_num > 1024); // Should be above well-known ports
        assert!(port_num < 65535);
    }
}
