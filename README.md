# luci-app-outlierox

Next-Generation Zero-Configuration Mesh Virtual Private Network Management Console for OpenWrt (Tailscale / Headscale Engine, LuCI Pure JavaScript SPA Architecture).

---

## ✨ Features

* **Real-Time Mesh Topology Dashboard**: Live monitoring of self-node status, virtual IP assignments, P2P direct links, and DERP relay paths for all connected nodes across your Tailnet mesh.
* **Subnet Routing & Egress Exit Nodes**: Effortlessly publish local router subnets, discover connected subnets automatically, accept remote routes, and configure egress exit nodes with transparent Site-to-Site SNAT control.
* **Native Firewall4 & nftables Integration**: Safe, non-destructive zone and forwarding rule orchestration tailored for OpenWrt 25, including automatic interface binding and MTU/MSS clamping.
* **Private & Hybrid Cloud Coordination**: Full compatibility with self-hosted Headscale control servers as well as the official Tailscale SaaS coordination plane.
* **Advanced Tailnet Security**: Integrated toggles for MagicDNS (*.ts.net) routing, Shields Up inbound isolation, native Tailscale SSH, and local web client access.
* **Modern SPA User Experience**: Fast, responsive single-page interface built with pure JavaScript, crisp vector SVG iconography, OpenWrt native design language, and instant zero-lag tab switching.
* **Full Multi-Language Support (i18n)**: Native Gettext internationalization supporting English, Simplified Chinese (简体中文), and Traditional Chinese (繁體中文).

---

## 🛠️ How to Build

### 1. Place into Source Tree
Clone this repository into your OpenWrt buildroot source directory under `package/` or custom feeds:

```bash
# Option A: Place directly into package directory
cd openwrt
git clone https://github.com/permails/luci-app-outlierox.git package/luci-app-outlierox

# Option B: Place into extra-packages directory
cd openwrt/extra-packages
git clone https://github.com/permails/luci-app-outlierox.git
```

### 2. Update and Install Feeds
```bash
./scripts/feeds update -a
./scripts/feeds install -a
make menuconfig
```
In `make menuconfig`, select:
```text
LuCI --->
  3. Applications --->
    <*> luci-app-outlierox......... LuCI support for Outlierox (Zero-Config Mesh Network)
```

### 3. Compile Package
```bash
# Compile single package with verbose output
make package/luci-app-outlierox/compile V=s

# Compiled packages (.ipk / .apk) are located in:
# bin/packages/<arch>/base/ or bin/packages/<arch>/luci/
```

---

## 📂 File Structure

```text
luci-app-outlierox/
├── Makefile                                # OpenWrt buildroot package manifest
├── README.md                               # Project documentation
├── .gitignore                              # Git ignore rules
├── LICENSE                                 # GNU General Public License v2.0
├── htdocs/                                 # Web frontend static assets
│   └── luci-static/
│       └── resources/
│           └── view/
│               └── outlierox/
│                   └── overview.js         # Main SPA view (Dashboard, Settings, Routing, Logs)
├── root/                                   # System integration files
│   ├── etc/
│   │   └── uci-defaults/
│   │       └── 40_luci-outlierox           # Post-install cache & ucitrack setup
│   └── usr/
│       └── share/
│           ├── luci/
│           │   └── menu.d/
│           │       └── luci-app-outlierox.json  # LuCI menu registration (VPN / Services)
│           └── rpcd/
│               ├── acl.d/
│               │   └── luci-app-outlierox.json  # RPCD / UCI security ACL permissions
│               └── ucode/
│                   └── tailscale.uc        # Backend ucode RPC service provider
└── po/                                     # Multi-language internationalization (i18n)
    ├── templates/
    │   └── outlierox.pot                   # Master Gettext POT template
    ├── zh_Hans/
    │   └── outlierox.po                    # Simplified Chinese translation catalog
    └── zh_Hant/
        └── outlierox.po                    # Traditional Chinese translation catalog
```

---

## 📜 License

GPL-2.0 © 2026 [permails](mailto:logo@permails.com)
