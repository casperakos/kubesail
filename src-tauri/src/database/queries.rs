use crate::database::{
    DatabaseConnection, DatabaseError, DatabaseResult, DbColumn, DbDatabase, DbSchema, DbTable,
    QueryResult, TableDataRequest,
};
use std::collections::HashMap;
use std::time::Instant;

/// List all databases
pub async fn list_databases(conn: &DatabaseConnection) -> DatabaseResult<Vec<DbDatabase>> {
    let client = conn.get_client().await?;

    let rows = client
        .query(
            r#"
            SELECT
                datname as name,
                pg_size_pretty(pg_database_size(datname)) as size
            FROM pg_database
            WHERE datistemplate = false
            ORDER BY datname
            "#,
            &[],
        )
        .await?;

    let databases = rows
        .into_iter()
        .map(|row| DbDatabase {
            name: row.get("name"),
            size: row.get("size"),
        })
        .collect();

    Ok(databases)
}

/// List all schemas in the current database
pub async fn list_schemas(conn: &DatabaseConnection) -> DatabaseResult<Vec<DbSchema>> {
    let client = conn.get_client().await?;

    let rows = client
        .query(
            r#"
            SELECT
                schema_name as name,
                schema_owner as owner
            FROM information_schema.schemata
            WHERE schema_name NOT LIKE 'pg_%'
              AND schema_name != 'information_schema'
            ORDER BY schema_name
            "#,
            &[],
        )
        .await?;

    let schemas = rows
        .into_iter()
        .map(|row| DbSchema {
            name: row.get("name"),
            owner: row.get("owner"),
        })
        .collect();

    Ok(schemas)
}

/// List all tables in a schema
pub async fn list_tables(
    conn: &DatabaseConnection,
    schema: &str,
) -> DatabaseResult<Vec<DbTable>> {
    let client = conn.get_client().await?;

    let rows = client
        .query(
            r#"
            SELECT
                table_schema as schema,
                table_name as name,
                table_type as table_type,
                (
                    SELECT COUNT(*)::bigint
                    FROM information_schema.columns
                    WHERE columns.table_schema = tables.table_schema
                      AND columns.table_name = tables.table_name
                ) as column_count
            FROM information_schema.tables
            WHERE table_schema = $1
            ORDER BY table_name
            "#,
            &[&schema],
        )
        .await?;

    let mut tables = Vec::new();

    for row in rows {
        let schema: String = row.get("schema");
        let name: String = row.get("name");
        let table_type: String = row.get("table_type");

        // Try to get row count (may fail for views or large tables)
        let row_count = match get_table_row_count(&client, &schema, &name).await {
            Ok(count) => Some(count),
            Err(e) => {
                tracing::warn!(
                    "Failed to get row count for {}.{}: {}",
                    schema,
                    name,
                    e
                );
                None
            }
        };

        tables.push(DbTable {
            schema,
            name,
            table_type,
            row_count,
        });
    }

    Ok(tables)
}

/// Get table row count
async fn get_table_row_count(
    client: &deadpool_postgres::Client,
    schema: &str,
    table: &str,
) -> DatabaseResult<i64> {
    // Use a safe query with timeout
    let query = format!(
        "SELECT COUNT(*)::bigint FROM {}.{} LIMIT 1000000",
        quote_identifier(schema),
        quote_identifier(table)
    );

    let row = client.query_one(&query, &[]).await?;
    Ok(row.get(0))
}

/// Get columns for a table
pub async fn get_table_columns(
    conn: &DatabaseConnection,
    schema: &str,
    table: &str,
) -> DatabaseResult<Vec<DbColumn>> {
    let client = conn.get_client().await?;

    let rows = client
        .query(
            r#"
            SELECT
                c.column_name as name,
                c.data_type,
                c.is_nullable,
                c.column_default,
                c.character_maximum_length,
                CASE
                    WHEN pk.column_name IS NOT NULL THEN true
                    ELSE false
                END as is_primary_key
            FROM information_schema.columns c
            LEFT JOIN (
                SELECT ku.column_name
                FROM information_schema.table_constraints tc
                JOIN information_schema.key_column_usage ku
                    ON tc.constraint_name = ku.constraint_name
                    AND tc.table_schema = ku.table_schema
                WHERE tc.constraint_type = 'PRIMARY KEY'
                    AND tc.table_schema = $1
                    AND tc.table_name = $2
            ) pk ON c.column_name = pk.column_name
            WHERE c.table_schema = $1
              AND c.table_name = $2
            ORDER BY c.ordinal_position
            "#,
            &[&schema, &table],
        )
        .await?;

    let columns = rows
        .into_iter()
        .map(|row| {
            let is_nullable: String = row.get("is_nullable");
            DbColumn {
                name: row.get("name"),
                data_type: row.get("data_type"),
                is_nullable: is_nullable == "YES",
                column_default: row.get("column_default"),
                character_maximum_length: row.get("character_maximum_length"),
                is_primary_key: row.get("is_primary_key"),
            }
        })
        .collect();

    Ok(columns)
}

/// Get table data with pagination
pub async fn get_table_data(
    conn: &DatabaseConnection,
    request: &TableDataRequest,
) -> DatabaseResult<QueryResult> {
    let columns = get_table_columns(conn, &request.schema, &request.table).await?;

    // Build the SELECT query with pagination
    let query = format!(
        "SELECT * FROM {}.{} LIMIT $1 OFFSET $2",
        quote_identifier(&request.schema),
        quote_identifier(&request.table)
    );

    execute_query(conn, &query, &columns, &[&request.limit, &request.offset]).await
}

/// Execute a custom SQL query
pub async fn execute_custom_query(
    conn: &DatabaseConnection,
    query: &str,
) -> DatabaseResult<QueryResult> {
    let client = conn.get_client().await?;
    let start = Instant::now();

    // Prepare the query
    let stmt = client.prepare(query).await?;

    // Get column information from the statement
    let columns = stmt
        .columns()
        .iter()
        .map(|col| DbColumn {
            name: col.name().to_string(),
            data_type: format!("{:?}", col.type_()),
            is_nullable: true, // We don't know for custom queries
            column_default: None,
            character_maximum_length: None,
            is_primary_key: false,
        })
        .collect::<Vec<_>>();

    // Execute the query
    let rows = client.query(&stmt, &[]).await?;

    let execution_time_ms = start.elapsed().as_millis() as u64;

    // Convert rows to HashMap
    let result_rows = rows
        .into_iter()
        .map(|row| {
            let mut map = HashMap::new();
            for (idx, col) in columns.iter().enumerate() {
                let value = row_value_to_json(&row, idx);
                map.insert(col.name.clone(), value);
            }
            map
        })
        .collect::<Vec<_>>();

    let row_count = result_rows.len();

    Ok(QueryResult {
        columns,
        rows: result_rows,
        row_count,
        execution_time_ms,
    })
}

/// Execute a query with parameters
async fn execute_query(
    conn: &DatabaseConnection,
    query: &str,
    columns: &[DbColumn],
    params: &[&(dyn tokio_postgres::types::ToSql + Sync)],
) -> DatabaseResult<QueryResult> {
    let client = conn.get_client().await?;
    let start = Instant::now();

    let rows = client.query(query, params).await?;

    let execution_time_ms = start.elapsed().as_millis() as u64;

    // Convert rows to HashMap
    let result_rows = rows
        .into_iter()
        .map(|row| {
            let mut map = HashMap::new();
            for (idx, col) in columns.iter().enumerate() {
                let value = row_value_to_json(&row, idx);
                map.insert(col.name.clone(), value);
            }
            map
        })
        .collect::<Vec<_>>();

    let row_count = result_rows.len();

    Ok(QueryResult {
        columns: columns.to_vec(),
        rows: result_rows,
        row_count,
        execution_time_ms,
    })
}

/// Convert a row value to JSON
fn row_value_to_json(row: &tokio_postgres::Row, idx: usize) -> serde_json::Value {
    use tokio_postgres::types::Type;

    let col = &row.columns()[idx];
    let col_type = col.type_();

    // Handle NULL values
    if row.try_get::<_, Option<String>>(idx).unwrap_or(None).is_none()
        && matches!(
            col_type,
            &Type::TEXT
                | &Type::VARCHAR
                | &Type::CHAR
                | &Type::BPCHAR
                | &Type::NAME
        )
    {
        return serde_json::Value::Null;
    }

    match col_type {
        &Type::BOOL => row
            .try_get::<_, Option<bool>>(idx)
            .ok()
            .flatten()
            .map(serde_json::Value::Bool)
            .unwrap_or(serde_json::Value::Null),

        &Type::INT2 | &Type::INT4 => row
            .try_get::<_, Option<i32>>(idx)
            .ok()
            .flatten()
            .map(|v| serde_json::Value::Number(v.into()))
            .unwrap_or(serde_json::Value::Null),

        &Type::INT8 => row
            .try_get::<_, Option<i64>>(idx)
            .ok()
            .flatten()
            .map(|v| serde_json::Value::Number(v.into()))
            .unwrap_or(serde_json::Value::Null),

        &Type::FLOAT4 | &Type::FLOAT8 => row
            .try_get::<_, Option<f64>>(idx)
            .ok()
            .flatten()
            .and_then(|v| serde_json::Number::from_f64(v))
            .map(serde_json::Value::Number)
            .unwrap_or(serde_json::Value::Null),

        &Type::TEXT | &Type::VARCHAR | &Type::CHAR | &Type::BPCHAR | &Type::NAME => row
            .try_get::<_, Option<String>>(idx)
            .ok()
            .flatten()
            .map(serde_json::Value::String)
            .unwrap_or(serde_json::Value::Null),

        &Type::JSON | &Type::JSONB => row
            .try_get::<_, Option<serde_json::Value>>(idx)
            .ok()
            .flatten()
            .unwrap_or(serde_json::Value::Null),

        &Type::TIMESTAMP | &Type::TIMESTAMPTZ => row
            .try_get::<_, Option<chrono::NaiveDateTime>>(idx)
            .ok()
            .flatten()
            .map(|dt| serde_json::Value::String(dt.to_string()))
            .unwrap_or(serde_json::Value::Null),

        &Type::DATE => row
            .try_get::<_, Option<chrono::NaiveDate>>(idx)
            .ok()
            .flatten()
            .map(|d| serde_json::Value::String(d.to_string()))
            .unwrap_or(serde_json::Value::Null),

        &Type::UUID => row
            .try_get::<_, Option<uuid::Uuid>>(idx)
            .ok()
            .flatten()
            .map(|u| serde_json::Value::String(u.to_string()))
            .unwrap_or(serde_json::Value::Null),

        // Handle numeric types - get as string and parse to f64
        &Type::NUMERIC => row
            .try_get::<_, Option<String>>(idx)
            .ok()
            .flatten()
            .and_then(|s| s.parse::<f64>().ok())
            .and_then(|v| serde_json::Number::from_f64(v))
            .map(serde_json::Value::Number)
            .unwrap_or(serde_json::Value::Null),

        // Handle array types
        _ if col_type.name().starts_with('_') => {
            // Try to handle common array types
            match col_type.name() {
                "_text" | "_varchar" | "_char" | "_bpchar" => {
                    row.try_get::<_, Option<Vec<String>>>(idx)
                        .ok()
                        .flatten()
                        .map(|arr| serde_json::Value::Array(
                            arr.into_iter()
                                .map(serde_json::Value::String)
                                .collect()
                        ))
                        .unwrap_or(serde_json::Value::Null)
                }
                "_int2" | "_int4" => {
                    row.try_get::<_, Option<Vec<i32>>>(idx)
                        .ok()
                        .flatten()
                        .map(|arr| serde_json::Value::Array(
                            arr.into_iter()
                                .map(|v| serde_json::Value::Number(v.into()))
                                .collect()
                        ))
                        .unwrap_or(serde_json::Value::Null)
                }
                "_int8" => {
                    row.try_get::<_, Option<Vec<i64>>>(idx)
                        .ok()
                        .flatten()
                        .map(|arr| serde_json::Value::Array(
                            arr.into_iter()
                                .map(|v| serde_json::Value::Number(v.into()))
                                .collect()
                        ))
                        .unwrap_or(serde_json::Value::Null)
                }
                "_float4" | "_float8" => {
                    row.try_get::<_, Option<Vec<f64>>>(idx)
                        .ok()
                        .flatten()
                        .map(|arr| serde_json::Value::Array(
                            arr.into_iter()
                                .filter_map(|v| serde_json::Number::from_f64(v))
                                .map(serde_json::Value::Number)
                                .collect()
                        ))
                        .unwrap_or(serde_json::Value::Null)
                }
                "_bool" => {
                    row.try_get::<_, Option<Vec<bool>>>(idx)
                        .ok()
                        .flatten()
                        .map(|arr| serde_json::Value::Array(
                            arr.into_iter()
                                .map(serde_json::Value::Bool)
                                .collect()
                        ))
                        .unwrap_or(serde_json::Value::Null)
                }
                // For other array types, try to get as string array or show placeholder
                _ => {
                    row.try_get::<_, Option<Vec<String>>>(idx)
                        .ok()
                        .flatten()
                        .map(|arr| serde_json::Value::Array(
                            arr.into_iter()
                                .map(serde_json::Value::String)
                                .collect()
                        ))
                        .unwrap_or_else(|| serde_json::Value::String(format!("<{}>", col_type.name())))
                }
            }
        }

        // Default: try to get as string
        _ => row
            .try_get::<_, Option<String>>(idx)
            .ok()
            .flatten()
            .map(serde_json::Value::String)
            .unwrap_or_else(|| {
                serde_json::Value::String(format!("<{}>", col_type.name()))
            }),
    }
}

/// Quote a SQL identifier (table name, column name, etc.)
fn quote_identifier(identifier: &str) -> String {
    format!("\"{}\"", identifier.replace("\"", "\"\""))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_quote_identifier() {
        assert_eq!(quote_identifier("table"), "\"table\"");
        assert_eq!(quote_identifier("my_table"), "\"my_table\"");
        assert_eq!(
            quote_identifier("table\"with\"quotes"),
            "\"table\"\"with\"\"quotes\""
        );
    }
}
