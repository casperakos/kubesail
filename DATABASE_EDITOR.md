# Database Editor Feature

## Overview

The Database Editor allows users to connect to CloudNativePG PostgreSQL databases directly from KubeSail, browse schema, view/edit data, and execute SQL queries.

## Architecture

### High-Level Flow

```
User selects CNPG Cluster
    ↓
Auto Port-Forward Created (localhost:random_port → cluster-rw:5432)
    ↓
PostgreSQL Connection Established
    ↓
Database Browser / Query Editor UI
    ↓
Query Execution / Data Display
```

### Components

#### 1. Backend (Rust)

**Module Structure:**
```
src-tauri/src/database/
├── mod.rs           # Module exports and types
├── portforward.rs   # Port-forward lifecycle management
├── connection.rs    # PostgreSQL connection pooling
└── queries.rs       # Query execution and schema introspection
```

**Key Responsibilities:**
- **Port-Forward Management**: Auto-create kubectl port-forwards, track lifecycle, cleanup
- **Connection Pooling**: Manage PostgreSQL connections efficiently with `deadpool-postgres`
- **Query Execution**: Execute SELECT, INSERT, UPDATE, DELETE with transaction support
- **Schema Introspection**: List databases, schemas, tables, columns, indexes
- **Security**: Credential handling, connection isolation, query sanitization

#### 2. Frontend (React/TypeScript)

**Component Structure:**
```
src/features/database/
├── DatabaseEditor.tsx        # Main component
├── ConnectionPanel.tsx       # Connection UI
├── DatabaseBrowser.tsx       # Tree view (databases → tables)
├── TableViewer.tsx          # Data grid with pagination
├── SQLQueryEditor.tsx       # Monaco-based SQL editor
└── ResultsView.tsx          # Query results display
```

**Key Responsibilities:**
- **Connection Management**: UI for connecting to clusters
- **Tree Navigation**: Hierarchical database/schema/table browser
- **Data Viewing**: Paginated table data with sorting/filtering
- **Query Editing**: SQL editor with syntax highlighting and auto-complete
- **Results Display**: Formatted query results with export options

## Implementation Details

### Port-Forward Management

**Approach:**
Use existing `create_port_forward` Tauri command to establish connection to CNPG cluster's read-write service (`{cluster}-rw`).

**Key Points:**
- Auto-select random local port to avoid conflicts
- Track port-forward by connection ID
- Auto-cleanup on disconnect or app close
- Reuse existing port-forward if already active

**Implementation:**
```rust
// portforward.rs
pub struct DatabasePortForward {
    pub connection_id: String,
    pub local_port: u16,
    pub namespace: String,
    pub service_name: String,
    pub remote_port: u16,
}

pub async fn create_db_port_forward(
    cluster_name: &str,
    namespace: &str,
) -> Result<DatabasePortForward> {
    // Create port-forward to {cluster}-rw service on port 5432
    // Return connection details
}
```

### PostgreSQL Connection

**Approach:**
Use `deadpool-postgres` for connection pooling with credentials from CNPG connection details.

**Configuration:**
```rust
// connection.rs
pub struct DatabaseConnection {
    pool: Pool,
    connection_id: String,
    database: String,
}

impl DatabaseConnection {
    pub async fn new(
        host: &str,  // localhost
        port: u16,   // local port from port-forward
        database: &str,
        username: &str,
        password: &str,
    ) -> Result<Self>
}
```

**Connection String:**
```
postgresql://username:password@localhost:{local_port}/database
```

### Query Execution

**Safety Measures:**
1. **Read-Only by Default**: Option to enable write mode
2. **Transaction Support**: Wrap UPDATE/INSERT/DELETE in transactions
3. **Query Timeouts**: Prevent long-running queries
4. **Row Limits**: Default LIMIT on SELECT queries
5. **Prepared Statements**: Use parameterized queries

**Query Types:**
```rust
pub enum QueryType {
    Select,      // Read data
    Insert,      // Insert rows
    Update,      // Update rows
    Delete,      // Delete rows
    DDL,         // CREATE, ALTER, DROP (admin only)
    Transaction, // BEGIN, COMMIT, ROLLBACK
}
```

### Schema Introspection

**Queries for Schema Discovery:**

**List Databases:**
```sql
SELECT datname FROM pg_database
WHERE datistemplate = false
ORDER BY datname;
```

**List Schemas:**
```sql
SELECT schema_name FROM information_schema.schemata
WHERE schema_name NOT IN ('pg_catalog', 'information_schema')
ORDER BY schema_name;
```

**List Tables:**
```sql
SELECT table_schema, table_name, table_type
FROM information_schema.tables
WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
ORDER BY table_schema, table_name;
```

**Get Table Columns:**
```sql
SELECT
    column_name,
    data_type,
    is_nullable,
    column_default,
    character_maximum_length
FROM information_schema.columns
WHERE table_schema = $1 AND table_name = $2
ORDER BY ordinal_position;
```

**Get Table Data (with pagination):**
```sql
SELECT * FROM {schema}.{table}
ORDER BY {primary_key}
LIMIT $1 OFFSET $2;
```

## Tauri Commands API

### Connection Management

```typescript
// Connect to database
invoke('db_connect', {
  clusterName: string,
  namespace: string,
  database: string,
})
-> { connectionId: string, localPort: number }

// Disconnect
invoke('db_disconnect', {
  connectionId: string,
})
-> void
```

### Schema Introspection

```typescript
// List databases
invoke('db_list_databases', {
  connectionId: string,
})
-> { databases: string[] }

// List tables in database
invoke('db_list_tables', {
  connectionId: string,
  schema?: string,
})
-> { tables: Table[] }

// Get table schema
invoke('db_get_table_schema', {
  connectionId: string,
  schema: string,
  table: string,
})
-> { columns: Column[] }
```

### Data Operations

```typescript
// Execute SELECT query
invoke('db_query_select', {
  connectionId: string,
  query: string,
  params?: any[],
  limit?: number,
  offset?: number,
})
-> { rows: any[], rowCount: number, columns: Column[] }

// Execute INSERT/UPDATE/DELETE
invoke('db_query_modify', {
  connectionId: string,
  query: string,
  params?: any[],
})
-> { rowsAffected: number }

// Get table data (convenience)
invoke('db_get_table_data', {
  connectionId: string,
  schema: string,
  table: string,
  limit: number,
  offset: number,
})
-> { rows: any[], total: number }
```

## UI/UX Design

### Connection Flow

1. User clicks "Connect" button on CloudNativePG cluster
2. Show connection dialog with:
   - Cluster name (read-only)
   - Database selection dropdown
   - Connection status indicator
   - "Connect" button
3. On connect:
   - Create port-forward (shows progress)
   - Establish PostgreSQL connection
   - Navigate to Database Editor view

### Database Browser

**Left Panel: Tree View**
```
📁 Databases
  📁 keycloak
    📁 Schemas
      📁 public
        📊 Tables
          └─ users
          └─ sessions
        📋 Views
          └─ active_sessions
  📁 postgres
    ...
```

**Right Panel: Content**
- Table data viewer (when table selected)
- Query editor (when "Query" tab active)
- Results view (after query execution)

### Table Viewer

**Features:**
- **Pagination**: 50/100/500 rows per page
- **Sorting**: Click column header to sort
- **Filtering**: Search/filter in each column
- **Editing**: Double-click cell to edit (if write mode enabled)
- **Export**: CSV/JSON export
- **Refresh**: Manual refresh button

**Grid Layout:**
```
╔════════════════════════════════════════╗
║ Table: public.users          [⟳]     ║
╠════════════════════════════════════════╣
║ id │ name      │ email       │ ... ║
║ 1  │ John Doe  │ j@ex.com    │ ... ║
║ 2  │ Jane Doe  │ jane@ex.com │ ... ║
║ ...                                  ║
╠════════════════════════════════════════╣
║ Showing 1-50 of 1,234  [< 1 2 3 >]  ║
╚════════════════════════════════════════╝
```

### SQL Query Editor

**Features:**
- Monaco Editor with PostgreSQL syntax highlighting
- Auto-complete for tables/columns
- Query history
- Execute button (Cmd+Enter / Ctrl+Enter)
- Explain plan visualization
- Query formatting

**Layout:**
```
┌─────────────────────────────────────┐
│ SQL Query Editor                    │
├─────────────────────────────────────┤
│ SELECT * FROM users WHERE...        │
│                                     │
│                                     │
├─────────────────────────────────────┤
│ [Execute] [Format] [History]        │
└─────────────────────────────────────┘
```

## Security Considerations

### Credential Handling
- Credentials never stored in browser
- Passed from CNPG secrets directly to connection
- Connection IDs used instead of credentials in API calls

### Query Safety
- SQL injection prevention via prepared statements
- Query whitelisting for dangerous operations
- Transaction rollback on errors
- Read-only mode by default

### Resource Management
- Connection pooling to prevent resource exhaustion
- Automatic connection timeout and cleanup
- Port-forward cleanup on disconnect
- Query execution timeouts

## Future Enhancements

### Phase 2
- [ ] Visual query builder
- [ ] Database diagram/ERD view
- [ ] Backup/restore functionality
- [ ] Real-time query monitoring
- [ ] Connection pooling stats

### Phase 3
- [ ] Multi-database connections
- [ ] Query performance analyzer
- [ ] Index optimization suggestions
- [ ] Collaborative query editing
- [ ] Saved queries/favorites

## Testing Strategy

### Unit Tests
- Port-forward lifecycle
- Connection pooling
- Query execution
- Schema introspection

### Integration Tests
- Full connection flow with test database
- Query execution with various data types
- Error handling and recovery

### Manual Testing Checklist
- [ ] Connect to keycloak-postgres
- [ ] Browse databases and tables
- [ ] Execute SELECT query
- [ ] Execute INSERT/UPDATE/DELETE
- [ ] Test pagination
- [ ] Test connection cleanup
- [ ] Test multiple simultaneous connections
- [ ] Test error scenarios (wrong credentials, network errors)

## References

- [tokio-postgres Documentation](https://docs.rs/tokio-postgres)
- [deadpool-postgres Documentation](https://docs.rs/deadpool-postgres)
- [Monaco Editor](https://microsoft.github.io/monaco-editor/)
- [PostgreSQL Information Schema](https://www.postgresql.org/docs/current/information-schema.html)
