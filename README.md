# luci-app-outlierox

[![License](https://img.shields.io/badge/License-GPL%202.0-blue.svg)](LICENSE)
[![OpenWrt Version](https://img.shields.io/badge/OpenWrt-23.x%20%7C%2024.x%20%7C%2025.x-success.svg)](https://openwrt.org/)

**Outlierox** is a modern, high-performance, single-page LuCI management console for zero-config Tailnet Mesh virtual private networks on OpenWrt.

---

## Features

* **Tailnet Mesh Network Topologies**: Real-time monitoring of self-node and all remote mesh peers, direct P2P connections, and DERP relay links.
* **Subnet & Exit Node Routing**: Effortless local subnet advertising, remote route acceptance, and full egress exit-node proxying with transparent Site-to-Site SNAT control.
* **Firewall4 & nftables Integration**: Non-destructive, bidirectional zone and forwarding orchestration tailored for OpenWrt 25.
* **Multi-language Support (i18n)**: Native Gettext translations (English, 简体中文, 繁體中文).
* **Headscale & Self-Hosted Coordination**: Fully compatible with custom Headscale servers and official Tailscale SaaS control planes.

---

## Requirements

* OpenWrt 23.05 / 24.10 / 25.12 or newer
* Core Packages: `tailscale`, `luci-base`, `rpcd-mod-ucode`

---

## Building from Source

### In OpenWrt Source Tree

```bash
cd package/
git clone https://github.com/permails/luci-app-outlierox.git
cd ..
./scripts/feeds update -a && ./scripts/feeds install -a
make menuconfig # LuCI -> Applications -> luci-app-outlierox
make package/luci-app-outlierox/compile V=s
```

---

## License

GPL-2.0 License. See [LICENSE](LICENSE) for details.

**Maintainer**: permails `<logo@permails.com>`
