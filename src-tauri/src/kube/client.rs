use anyhow::Result;
use kube::{Client, Config};
use std::sync::Arc;
use tokio::sync::RwLock;

pub struct KubeClientManager {
    client: Arc<RwLock<Option<Client>>>,
}

impl KubeClientManager {
    pub fn new() -> Self {
        Self {
            client: Arc::new(RwLock::new(None)),
        }
    }

    pub async fn init_client(&self) -> Result<()> {
        let config = Config::infer().await?;
        let client = Client::try_from(config)?;

        let mut client_lock = self.client.write().await;
        *client_lock = Some(client);

        Ok(())
    }

    pub async fn get_client(&self) -> Result<Client> {
        let client_lock = self.client.read().await;

        match client_lock.as_ref() {
            Some(client) => Ok(client.clone()),
            None => {
                drop(client_lock);
                self.init_client().await?;

                let client_lock = self.client.read().await;
                Ok(client_lock.as_ref().unwrap().clone())
            }
        }
    }

    pub async fn reinit_client(&self) -> Result<()> {
        self.init_client().await
    }
}

impl Default for KubeClientManager {
    fn default() -> Self {
        Self::new()
    }
}
