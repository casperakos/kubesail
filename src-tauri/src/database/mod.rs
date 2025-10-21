use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;

pub mod connection;
pub mod portforward;
pub mod queries;

pub use connection::DatabaseConnection;
pub use portforward::DatabasePortForward;

/// Global database connection manager
pub type ConnectionManager = Arc<RwLock<HashMap<String, DatabaseConnection>>>;

/// Database connection details
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DbConnectionInfo {
    pub connection_id: String,
    pub cluster_name: String,
    pub namespace: String,
    pub database: String,
    pub local_port: u16,
}

/// Database table information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DbTable {
    pub schema: String,
    pub name: String,
    pub table_type: String, // TABLE or VIEW
    pub row_count: Option<i64>,
}

/// Table column information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DbColumn {
    pub name: String,
    pub data_type: String,
    pub is_nullable: bool,
    pub column_default: Option<String>,
    pub character_maximum_length: Option<i32>,
    pub is_primary_key: bool,
}

/// Query result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QueryResult {
    pub columns: Vec<DbColumn>,
    pub rows: Vec<HashMap<String, serde_json::Value>>,
    pub row_count: usize,
    pub execution_time_ms: u64,
}

/// Query execution request
#[derive(Debug, Clone, Deserialize)]
pub struct QueryRequest {
    pub connection_id: String,
    pub query: String,
    #[serde(default)]
    pub params: Vec<serde_json::Value>,
}

/// Table data request
#[derive(Debug, Clone, Deserialize)]
pub struct TableDataRequest {
    pub connection_id: String,
    pub schema: String,
    pub table: String,
    #[serde(default = "default_limit")]
    pub limit: i64,
    #[serde(default)]
    pub offset: i64,
}

fn default_limit() -> i64 {
    100
}

/// Database information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DbDatabase {
    pub name: String,
    pub size: Option<String>,
}

/// Schema information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DbSchema {
    pub name: String,
    pub owner: Option<String>,
}

/// Error type for database operations
#[derive(Debug, thiserror::Error)]
pub enum DatabaseError {
    #[error("Connection not found: {0}")]
    ConnectionNotFound(String),

    #[error("Port forward error: {0}")]
    PortForwardError(String),

    #[error("PostgreSQL error: {0}")]
    PostgresError(#[from] tokio_postgres::Error),

    #[error("Pool error: {0}")]
    PoolError(#[from] deadpool_postgres::PoolError),

    #[error("Configuration error: {0}")]
    ConfigError(String),

    #[error("Query execution error: {0}")]
    QueryError(String),

    #[error("Other error: {0}")]
    Other(#[from] anyhow::Error),
}

pub type DatabaseResult<T> = Result<T, DatabaseError>;
