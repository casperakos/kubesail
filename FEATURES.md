# KubeSail Features

## Overview
KubeSail is a modern Kubernetes management desktop application built with Tauri 2.0, React, and Rust. It provides a fast, native experience for managing Kubernetes clusters with support for standard resources and service mesh technologies.

## 🎯 Core Features

### Resource Management
- **Pods** - View, monitor, and delete pods with real-time status updates
- **Deployments** - Scale deployments, view replica status and availability
- **Services** - Monitor ClusterIP, NodePort, and LoadBalancer services
- **Namespaces** - Switch between namespaces seamlessly

### Ingress & Traffic Management
- **Ingress Resources** - Full support for:
  - Nginx Ingress Controller
  - Istio Ingress Gateway
  - Traefik
  - Any Kubernetes Ingress resource
- **Visual Indicators**:
  - Ingress class badges (color-coded by controller type)
  - Host routing information
  - TLS/SSL status with shield icon
  - Load balancer addresses
  - Age tracking

### Istio Service Mesh Support
- **VirtualServices**
  - View traffic routing rules
  - See hosts and associated gateways
  - Track routing configurations
- **Gateways**
  - Monitor gateway servers
  - View port, protocol, and host configurations
  - Track ingress/egress gateways

## 🔥 Key Highlights

### Why Developers Love It
1. **Native Performance** - Built with Rust, not Electron
2. **Small Footprint** - ~10MB binary vs 100MB+ for Electron apps
3. **Real-time Updates** - Auto-refresh every 2-10 seconds
4. **Keyboard-First** - Ready for shortcuts (architecture in place)
5. **Beautiful UI** - Modern design with Tailwind CSS
6. **Type-Safe** - Full TypeScript + Rust type safety

### Ingress Detection
Automatically detects and displays:
- Ingress class (nginx, istio, traefik, etc.)
- Hostname routing
- TLS certificates
- Backend services
- Load balancer IPs

### Service Mesh Integration
Works seamlessly with:
- Istio (VirtualServices, Gateways)
- Gracefully handles clusters without Istio (no errors)

## 📊 Resource Views

### Pods List
- Status indicators (Running, Pending, Failed)
- Ready containers (X/Y format)
- Restart counts
- Node placement
- Pod IP addresses
- Quick delete action

### Deployments List
- Replica status (ready/desired)
- Up-to-date count
- Available replicas
- Interactive scaling
- Color-coded health status

### Services List
- Service type badges
- ClusterIP addresses
- External IPs (for LoadBalancers)
- Port mappings
- Protocol information

### Ingresses List
- Controller class badges
- Multiple host support
- TLS/SSL indicators
- Load balancer addresses
- Empty host (*) support

### Istio Resources
- **VirtualServices**: Hosts, gateways, routing rules
- **Gateways**: Server configurations, ports, protocols

## 🚀 Performance

### Real-time Refresh Intervals
- Pods: 5 seconds
- Deployments: 5 seconds
- Services: 10 seconds
- Ingresses: 10 seconds
- Istio Resources: 10 seconds
- Namespaces: 10 seconds
- Contexts: 30 seconds

### Smart Caching
- React Query with automatic background refetching
- Efficient state management with Zustand
- Persistent settings across sessions

## 🎨 UI/UX Features

### Visual Design
- Clean, modern interface
- Dark/light theme support
- Color-coded status indicators
- Icon-based navigation
- Responsive layout

### User Experience
- Instant namespace switching
- Smooth transitions
- Loading states
- Error handling
- Empty state messages

## 🔧 Technical Stack

### Frontend
- React 19
- TypeScript
- TanStack Query (React Query)
- Zustand (State Management)
- Tailwind CSS
- shadcn/ui-inspired components
- Lucide React (Icons)

### Backend
- Rust
- Tauri 2.0
- kube-rs (Kubernetes client)
- tokio (Async runtime)
- serde (Serialization)

## 🛠️ Development

### Running the App
```bash
pnpm install
pnpm run tauri dev
```

### Building
```bash
pnpm run build
pnpm run tauri build
```

## 📝 Supported Kubernetes Versions
- Works with any Kubernetes 1.19+
- Supports multiple kubeconfig contexts
- Compatible with major cloud providers (GKE, EKS, AKS)
- Works with local clusters (minikube, kind, k3s)

## 🎯 Future Enhancements

### Planned Features
- [ ] Command Palette (⌘K)
- [ ] Pod shell/exec with xterm.js
- [ ] Resource metrics (CPU/Memory charts)
- [ ] YAML editor for resource editing
- [ ] Port forwarding UI
- [ ] Multi-pod log aggregation
- [ ] Event timeline viewer
- [ ] Resource relationship graphs
- [ ] Custom saved views
- [ ] ConfigMaps & Secrets viewer
- [ ] StatefulSets & DaemonSets
- [ ] Jobs & CronJobs
- [ ] Network Policies
- [ ] Service Mesh metrics
- [ ] Grafana/Prometheus integration

## 🌟 Highlights for Service Mesh Users

### Istio Users
- View all VirtualServices and their routing rules
- Monitor Gateway configurations
- See which services are exposed via Istio
- Track host mappings across the mesh
- Identify gateway to VirtualService relationships

### Multiple Ingress Controllers
- Supports multiple ingress classes in the same cluster
- Distinguishes between nginx, istio, traefik visually
- Shows ingress-specific configurations
- TLS termination visibility

## 🔒 Security
- Uses kubeconfig authentication
- No credentials stored in app
- Respects RBAC permissions
- Read-only by default (except delete/scale actions)
- Secure Rust backend

## 📦 Distribution
- Single binary distribution
- No runtime dependencies
- Native installers for macOS, Linux, Windows
- Auto-update capability (via Tauri)

---

Built with ❤️ using Tauri 2.0
