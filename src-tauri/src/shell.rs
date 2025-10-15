use anyhow::{Context, Result};
use futures::{StreamExt, TryStreamExt};
use k8s_openapi::api::core::v1::Pod;
use kube::{
    api::{Api, AttachParams},
    Client,
};
use std::collections::HashMap;
use std::sync::Arc;
use tauri::{AppHandle, Emitter, Manager};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::sync::{Mutex, RwLock};
use uuid::Uuid;

type SessionId = String;

#[derive(Clone)]
pub struct ShellSession {
    pub session_id: SessionId,
    pub pod_name: String,
    pub namespace: String,
    pub container: Option<String>,
}

pub struct ShellManager {
    sessions: Arc<RwLock<HashMap<SessionId, Arc<Mutex<Option<tokio::task::JoinHandle<()>>>>>>>,
    stdin_senders: Arc<RwLock<HashMap<SessionId, tokio::sync::mpsc::UnboundedSender<String>>>>,
}

impl ShellManager {
    pub fn new() -> Self {
        Self {
            sessions: Arc::new(RwLock::new(HashMap::new())),
            stdin_senders: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    pub async fn start_session(
        &self,
        app: AppHandle,
        client: Client,
        pod_name: String,
        namespace: String,
        container: Option<String>,
        shell: Option<String>,
    ) -> Result<SessionId> {
        let session_id = Uuid::new_v4().to_string();

        let pods: Api<Pod> = Api::namespaced(client.clone(), &namespace);

        // Get pod to check container info
        let pod = pods.get(&pod_name).await
            .context("Failed to get pod details")?;

        // Validate pod phase
        let pod_phase = pod.status
            .as_ref()
            .and_then(|s| s.phase.as_ref())
            .map(|p| p.as_str())
            .unwrap_or("Unknown");

        if pod_phase != "Running" {
            anyhow::bail!("Pod is not in Running state (current phase: {}). Cannot establish shell connection.", pod_phase);
        }

        // Determine which container to use
        let target_container = if let Some(c) = container {
            c
        } else {
            // If no container specified, use the first container
            pod.spec
                .as_ref()
                .and_then(|spec| spec.containers.first())
                .map(|c| c.name.clone())
                .ok_or_else(|| anyhow::anyhow!("Pod has no containers"))?
        };

        // Validate container is ready
        let container_ready = pod.status
            .as_ref()
            .and_then(|s| s.container_statuses.as_ref())
            .and_then(|statuses| {
                statuses.iter()
                    .find(|cs| cs.name == target_container)
                    .map(|cs| cs.ready)
            })
            .unwrap_or(false);

        if !container_ready {
            anyhow::bail!("Container '{}' is not ready. Cannot establish shell connection.", target_container);
        }

        // List of shells to try in order of preference
        let shells_to_try = if let Some(s) = shell {
            vec![s]
        } else {
            vec![
                "/bin/bash".to_string(),
                "/bin/sh".to_string(),
                "/bin/ash".to_string(),
            ]
        };

        // When TTY is enabled, stderr must be false (stderr is merged into stdout in TTY mode)
        let mut attach_params = AttachParams::default()
            .stdin(true)
            .stdout(true)
            .stderr(false)
            .tty(true)
            .container(&target_container);

        // Try each shell until one works
        let mut last_error = None;
        let mut attached = None;

        for shell_cmd in shells_to_try.iter() {
            match pods.exec(&pod_name, vec![shell_cmd.clone()], &attach_params).await {
                Ok(a) => {
                    attached = Some(a);
                    break;
                }
                Err(e) => {
                    eprintln!("Failed to exec with {}: {}", shell_cmd, e);
                    last_error = Some(e);
                }
            }
        }

        let mut attached = attached.ok_or_else(|| {
            anyhow::anyhow!(
                "Failed to execute shell in container '{}'. Tried /bin/bash, /bin/sh, /bin/ash. Last error: {}",
                target_container,
                last_error.map(|e| e.to_string()).unwrap_or_else(|| "Unknown error".to_string())
            )
        })?;

        // Create stdin channel
        let (stdin_tx, mut stdin_rx) = tokio::sync::mpsc::unbounded_channel::<String>();

        // Store stdin sender
        {
            let mut senders = self.stdin_senders.write().await;
            senders.insert(session_id.clone(), stdin_tx);
        }

        let session_id_clone = session_id.clone();
        let app_clone = app.clone();

        // Get stdio handles (no stderr in TTY mode - it's merged into stdout)
        let mut stdin_writer = attached.stdin().unwrap();
        let mut stdout_reader = attached.stdout().unwrap();

        // Spawn shell session task
        let handle = tokio::spawn(async move {
            // Spawn task to handle stdin from frontend
            let stdin_task = {
                tokio::spawn(async move {
                    while let Some(data) = stdin_rx.recv().await {
                        if let Err(e) = stdin_writer.write_all(data.as_bytes()).await {
                            eprintln!("Error writing to stdin: {}", e);
                            break;
                        }
                        if let Err(e) = stdin_writer.flush().await {
                            eprintln!("Error flushing stdin: {}", e);
                            break;
                        }
                    }
                })
            };

            // Spawn task to read stdout (includes stderr in TTY mode)
            let stdout_task = {
                let app = app_clone.clone();
                let session_id = session_id_clone.clone();
                tokio::spawn(async move {
                    let mut buffer = vec![0u8; 4096];
                    loop {
                        match stdout_reader.read(&mut buffer).await {
                            Ok(0) => break, // EOF
                            Ok(n) => {
                                let data = String::from_utf8_lossy(&buffer[..n]).to_string();
                                let _ = app.emit(&format!("shell-output-{}", session_id), data);
                            }
                            Err(e) => {
                                eprintln!("Error reading stdout: {}", e);
                                break;
                            }
                        }
                    }
                })
            };

            // Wait for all tasks to complete
            let _ = tokio::join!(stdin_task, stdout_task);

            // Notify frontend that session ended
            let _ = app_clone.emit(&format!("shell-closed-{}", session_id_clone), ());
        });

        // Store session handle
        {
            let mut sessions = self.sessions.write().await;
            sessions.insert(session_id.clone(), Arc::new(Mutex::new(Some(handle))));
        }

        Ok(session_id)
    }

    pub async fn send_input(&self, session_id: &str, data: String) -> Result<()> {
        let senders = self.stdin_senders.read().await;
        if let Some(sender) = senders.get(session_id) {
            sender
                .send(data)
                .context("Failed to send input to shell session")?;
            Ok(())
        } else {
            anyhow::bail!("Shell session not found")
        }
    }

    pub async fn close_session(&self, session_id: &str) -> Result<()> {
        // Remove stdin sender
        {
            let mut senders = self.stdin_senders.write().await;
            senders.remove(session_id);
        }

        // Cancel and remove session
        {
            let mut sessions = self.sessions.write().await;
            if let Some(handle_mutex) = sessions.remove(session_id) {
                let mut handle_opt = handle_mutex.lock().await;
                if let Some(handle) = handle_opt.take() {
                    handle.abort();
                }
            }
        }

        Ok(())
    }

    pub async fn close_all_sessions(&self) -> Result<()> {
        // Clear stdin senders
        {
            let mut senders = self.stdin_senders.write().await;
            senders.clear();
        }

        // Cancel all sessions
        {
            let mut sessions = self.sessions.write().await;
            for (_, handle_mutex) in sessions.drain() {
                let mut handle_opt = handle_mutex.lock().await;
                if let Some(handle) = handle_opt.take() {
                    handle.abort();
                }
            }
        }

        Ok(())
    }
}

impl Default for ShellManager {
    fn default() -> Self {
        Self::new()
    }
}
