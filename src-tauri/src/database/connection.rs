use crate::database::{DatabaseError, DatabaseResult, DbConnectionInfo, DatabasePortForward};
use crate::portforward::PortForwardManager;
use deadpool_postgres::{Config, Manager, ManagerConfig, Pool, RecyclingMethod, Runtime};
use std::sync::Arc;
use tokio::sync::RwLock;
use tokio_postgres::NoTls;

/// Database connection with connection pooling
#[derive(Debug)]
pub struct DatabaseConnection {
    pub info: DbConnectionInfo,
    pub pool: Pool,
    port_forward: DatabasePortForward,
}

impl DatabaseConnection {
    /// Create a new database connection
    ///
    /// This will:
    /// 1. Create a port-forward to the PostgreSQL cluster
    /// 2. Set up a connection pool to localhost:local_port
    /// 3. Test the connection
    pub async fn create(
        pf_manager: &PortForwardManager,
        cluster_name: &str,
        namespace: &str,
        database: &str,
        username: &str,
        password: &str,
    ) -> DatabaseResult<Self> {
        tracing::info!(
            "Creating database connection to {}/{}, database: {}",
            namespace,
            cluster_name,
            database
        );

        // Generate a unique connection ID
        let connection_id = uuid::Uuid::new_v4().to_string();

        // Create port-forward first
        let port_forward = DatabasePortForward::create(
            pf_manager,
            cluster_name,
            namespace,
            connection_id.clone(),
        )
        .await?;

        tracing::info!(
            "Port-forward established on localhost:{}",
            port_forward.local_port
        );

        // Wait for the port-forward to be fully ready
        tracing::info!("Waiting for port-forward to be ready...");
        tokio::time::sleep(tokio::time::Duration::from_secs(2)).await;

        // Configure connection pool
        let mut cfg = Config::new();
        cfg.host = Some("127.0.0.1".to_string());
        cfg.port = Some(port_forward.local_port);
        cfg.dbname = Some(database.to_string());
        cfg.user = Some(username.to_string());
        cfg.password = Some(password.to_string());
        cfg.connect_timeout = Some(std::time::Duration::from_secs(10)); // 10 second connection timeout

        // Connection pool settings
        cfg.manager = Some(ManagerConfig {
            recycling_method: RecyclingMethod::Fast,
        });

        // Create the pool
        let pool = cfg
            .create_pool(Some(Runtime::Tokio1), NoTls)
            .map_err(|e| DatabaseError::ConfigError(format!("Failed to create pool: {}", e)))?;

        tracing::info!("Connection pool created, testing connection to 127.0.0.1:{}...", port_forward.local_port);

        // Test the connection with detailed error logging
        let client = pool.get().await.map_err(|e| {
            tracing::error!("Failed to get connection from pool: {}", e);
            DatabaseError::PoolError(e)
        })?;

        tracing::info!("Got connection from pool, executing test query...");

        // Simple query to verify connection
        client
            .query("SELECT 1", &[])
            .await
            .map_err(|e| {
                tracing::error!("Test query failed: {}", e);
                DatabaseError::PostgresError(e)
            })?;

        tracing::info!("Database connection established successfully");

        let info = DbConnectionInfo {
            connection_id: connection_id.clone(),
            cluster_name: cluster_name.to_string(),
            namespace: namespace.to_string(),
            database: database.to_string(),
            local_port: port_forward.local_port,
        };

        Ok(Self {
            info,
            pool,
            port_forward,
        })
    }

    /// Get a client from the connection pool
    pub async fn get_client(
        &self,
    ) -> DatabaseResult<deadpool_postgres::Client> {
        self.pool.get().await.map_err(DatabaseError::PoolError)
    }

    /// Close the database connection
    ///
    /// This will:
    /// 1. Close all pooled connections
    /// 2. Stop the port-forward
    pub async fn close(
        self,
        pf_manager: &PortForwardManager,
    ) -> DatabaseResult<()> {
        tracing::info!(
            "Closing database connection: {}",
            self.info.connection_id
        );

        // Close the pool
        self.pool.close();

        // Stop the port-forward
        DatabasePortForward::stop(pf_manager, &self.port_forward.port_forward_id).await?;

        tracing::info!("Database connection closed successfully");
        Ok(())
    }

    /// Get connection information
    pub fn info(&self) -> &DbConnectionInfo {
        &self.info
    }

    /// Check if the connection is healthy
    pub async fn health_check(&self) -> DatabaseResult<bool> {
        match self.pool.get().await {
            Ok(client) => {
                match client.query("SELECT 1", &[]).await {
                    Ok(_) => Ok(true),
                    Err(e) => {
                        tracing::warn!("Health check query failed: {}", e);
                        Ok(false)
                    }
                }
            }
            Err(e) => {
                tracing::warn!("Health check connection failed: {}", e);
                Ok(false)
            }
        }
    }

    /// Get the current database name
    pub async fn current_database(&self) -> DatabaseResult<String> {
        let client = self.get_client().await?;
        let row = client
            .query_one("SELECT current_database()", &[])
            .await?;
        Ok(row.get(0))
    }

    /// Get PostgreSQL version
    pub async fn version(&self) -> DatabaseResult<String> {
        let client = self.get_client().await?;
        let row = client.query_one("SELECT version()", &[]).await?;
        Ok(row.get(0))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_connection_info() {
        let info = DbConnectionInfo {
            connection_id: "test-123".to_string(),
            cluster_name: "test-cluster".to_string(),
            namespace: "test-ns".to_string(),
            database: "testdb".to_string(),
            local_port: 54321,
        };

        assert_eq!(info.connection_id, "test-123");
        assert_eq!(info.cluster_name, "test-cluster");
        assert_eq!(info.namespace, "test-ns");
        assert_eq!(info.database, "testdb");
        assert_eq!(info.local_port, 54321);
    }
}
