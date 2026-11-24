#
# Copyright (C) 2026 permails <logo@permails.com>
#
# This is free software, licensed under the GNU General Public License v2.
#

include $(TOPDIR)/rules.mk

PKG_VERSION:=0.26.11
PKG_RELEASE:=1

LUCI_TITLE:=LuCI support for Outlierox (Zero-Config Mesh Network)
LUCI_DEPENDS:=+luci-base +tailscale
LUCI_PKGARCH:=all

PKG_LICENSE:=GPL-2.0
PKG_MAINTAINER:=permails <logo@permails.com>

include $(TOPDIR)/feeds/luci/luci.mk

# call BuildPackage - OpenWrt buildroot signature