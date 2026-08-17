#
# Copyright (C) 2026 permails <logo@permails.com>
#
# This is free software, licensed under the GNU General Public License v2.

include $(TOPDIR)/rules.mk

PKG_NAME:=luci-app-outlierox
PKG_VERSION:=1.26.8
PKG_RELEASE:=1
PKG_MAINTAINER:=permails <logo@permails.com>
PKG_LICENSE:=GPL-2.0

LUCI_TITLE:=LuCI support for Outlierox (Zero-Config Mesh Network)
LUCI_DEPENDS:=+luci-base +tailscale

include $(TOPDIR)/feeds/luci/luci.mk

# call BuildPackage - OpenWrt buildroot signature