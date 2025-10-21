use crate::database::{
    queries, ConnectionManager, DatabaseConnection, DatabaseError, DbConnectionInfo, DbDatabase,
    DbSchema, DbTable, DbColumn, QueryResult, QueryRequest, TableDataRequest,
};
use crate::portforward::PortForwardManager;
use std::sync::Arc;
use tauri::State;

/// Connect to a CloudNativePG database cluster
#[tauri::command]
pub async fn db_connect(
    cluster_name: String,
    namespace: String,
    database: String,
    username: String,
    password: String,
    pf_manager: State<'_, PortForwardManager>,
    connection_manager: State<'_, ConnectionManager>,
) -> Result<DbConnectionInfo, String> {
    tracing::info!(
        "Database connect request: {}/{}, database: {}",
        namespace,
        cluster_name,
        database
    );

    // Create the database connection
    let connection = DatabaseConnection::create(
        pf_manager.inner(),
        &cluster_name,
        &namespace,
        &database,
        &username,
        &password,
    )
    .await
    .map_err(|e| format!("Failed to create database connection: {}", e))?;

    let info = connection.info().clone();
    let connection_id = info.connection_id.clone();

    // Store the connection
    let mut manager = connection_manager.write().await;
    manager.insert(connection_id.clone(), connection);

    tracing::info!("Database connection created: {}", connection_id);

    Ok(info)
}

/// Disconnect from a database
#[tauri::command]
pub async fn db_disconnect(
    connection_id: String,
    pf_manager: State<'_, PortForwardManager>,
    connection_manager: State<'_, ConnectionManager>,
) -> Result<(), String> {
    tracing::info!("Database disconnect request: {}", connection_id);

    // Remove the connection from the manager
    let mut manager = connection_manager.write().await;
    let connection = manager
        .remove(&connection_id)
        .ok_or_else(|| format!("Connection not found: {}", connection_id))?;

    // Close the connection
    connection
        .close(pf_manager.inner())
        .await
        .map_err(|e| format!("Failed to close database connection: {}", e))?;

    tracing::info!("Database connection closed: {}", connection_id);

    Ok(())
}

/// List all active database connections
#[tauri::command]
pub async fn db_list_connections(
    connection_manager: State<'_, ConnectionManager>,
) -> Result<Vec<DbConnectionInfo>, String> {
    let manager = connection_manager.read().await;
    let connections = manager
        .values()
        .map(|conn| conn.info().clone())
        .collect();

    Ok(connections)
}

/// List all databases in the current connection
#[tauri::command]
pub async fn db_list_databases(
    connection_id: String,
    connection_manager: State<'_, ConnectionManager>,
) -> Result<Vec<DbDatabase>, String> {
    let manager = connection_manager.read().await;
    let connection = manager
        .get(&connection_id)
        .ok_or_else(|| format!("Connection not found: {}", connection_id))?;

    queries::list_databases(connection)
        .await
        .map_err(|e| format!("Failed to list databases: {}", e))
}

/// List all schemas in the current database
#[tauri::command]
pub async fn db_list_schemas(
    connection_id: String,
    connection_manager: State<'_, ConnectionManager>,
) -> Result<Vec<DbSchema>, String> {
    let manager = connection_manager.read().await;
    let connection = manager
        .get(&connection_id)
        .ok_or_else(|| format!("Connection not found: {}", connection_id))?;

    queries::list_schemas(connection)
        .await
        .map_err(|e| format!("Failed to list schemas: {}", e))
}

/// List all tables in a schema
#[tauri::command]
pub async fn db_list_tables(
    connection_id: String,
    schema: String,
    connection_manager: State<'_, ConnectionManager>,
) -> Result<Vec<DbTable>, String> {
    let manager = connection_manager.read().await;
    let connection = manager
        .get(&connection_id)
        .ok_or_else(|| format!("Connection not found: {}", connection_id))?;

    queries::list_tables(connection, &schema)
        .await
        .map_err(|e| format!("Failed to list tables: {}", e))
}

/// Get columns for a table
#[tauri::command]
pub async fn db_get_table_columns(
    connection_id: String,
    schema: String,
    table: String,
    connection_manager: State<'_, ConnectionManager>,
) -> Result<Vec<DbColumn>, String> {
    let manager = connection_manager.read().await;
    let connection = manager
        .get(&connection_id)
        .ok_or_else(|| format!("Connection not found: {}", connection_id))?;

    queries::get_table_columns(connection, &schema, &table)
        .await
        .map_err(|e| format!("Failed to get table columns: {}", e))
}

/// Get table data with pagination
#[tauri::command]
pub async fn db_get_table_data(
    request: TableDataRequest,
    connection_manager: State<'_, ConnectionManager>,
) -> Result<QueryResult, String> {
    let manager = connection_manager.read().await;
    let connection = manager
        .get(&request.connection_id)
        .ok_or_else(|| format!("Connection not found: {}", request.connection_id))?;

    queries::get_table_data(connection, &request)
        .await
        .map_err(|e| format!("Failed to get table data: {}", e))
}

/// Execute a custom SQL query
#[tauri::command]
pub async fn db_execute_query(
    request: QueryRequest,
    connection_manager: State<'_, ConnectionManager>,
) -> Result<QueryResult, String> {
    let manager = connection_manager.read().await;
    let connection = manager
        .get(&request.connection_id)
        .ok_or_else(|| format!("Connection not found: {}", request.connection_id))?;

    queries::execute_custom_query(connection, &request.query)
        .await
        .map_err(|e| format!("Failed to execute query: {}", e))
}

/// Check database connection health
#[tauri::command]
pub async fn db_health_check(
    connection_id: String,
    connection_manager: State<'_, ConnectionManager>,
) -> Result<bool, String> {
    let manager = connection_manager.read().await;
    let connection = manager
        .get(&connection_id)
        .ok_or_else(|| format!("Connection not found: {}", connection_id))?;

    connection
        .health_check()
        .await
        .map_err(|e| format!("Health check failed: {}", e))
}

/// Get current database name
#[tauri::command]
pub async fn db_current_database(
    connection_id: String,
    connection_manager: State<'_, ConnectionManager>,
) -> Result<String, String> {
    let manager = connection_manager.read().await;
    let connection = manager
        .get(&connection_id)
        .ok_or_else(|| format!("Connection not found: {}", connection_id))?;

    connection
        .current_database()
        .await
        .map_err(|e| format!("Failed to get current database: {}", e))
}

/// Get PostgreSQL version
#[tauri::command]
pub async fn db_version(
    connection_id: String,
    connection_manager: State<'_, ConnectionManager>,
) -> Result<String, String> {
    let manager = connection_manager.read().await;
    let connection = manager
        .get(&connection_id)
        .ok_or_else(|| format!("Connection not found: {}", connection_id))?;

    connection
        .version()
        .await
        .map_err(|e| format!("Failed to get database version: {}", e))
}
