'use strict';'require dom';'require fs';'require poll';'require request';'require rpc';'require uci';'require ui';'require view';const callGetStatus=rpc.declare({object:'tailscale',method:'get_status',expect:{'':{}}});const callGetSubroutes=rpc.declare({object:'tailscale',method:'get_subroutes',expect:{'':{}}});const callGetSettings=rpc.declare({object:'tailscale',method:'get_settings',expect:{'':{}}});const callSetSettings=rpc.declare({object:'tailscale',method:'set_settings',params:['form_data'],expect:{'':{}}});const callDoLogin=rpc.declare({object:'tailscale',method:'do_login',params:['form_data'],expect:{'':{}}});const callDoLogout=rpc.declare({object:'tailscale',method:'do_logout',expect:{'':{}}});const callSetupFirewall=rpc.declare({object:'tailscale',method:'setup_firewall',expect:{'':{}}});const callCleanupReset=rpc.declare({object:'tailscale',method:'cleanup_reset',expect:{'':{}}});const callGetLogs=rpc.declare({object:'tailscale',method:'get_logs',expect:{'':{}}});const SVG_ICONS={users:'<svg class="ts-icon" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>',settings:'<svg class="ts-icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>',route:'<svg class="ts-icon" viewBox="0 0 24 24"><circle cx="6" cy="19" r="3"></circle><path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15"></path><circle cx="18" cy="5" r="3"></circle></svg>',shield:'<svg class="ts-icon" viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>',terminal:'<svg class="ts-icon" viewBox="0 0 24 24"><polyline points="4 17 10 11 4 5"></polyline><line x1="12" y1="19" x2="20" y2="19"></line></svg>',fileText:'<svg class="ts-icon" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>',globe:'<svg class="ts-icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>',server:'<svg class="ts-icon" viewBox="0 0 24 24"><rect x="2" y="2" width="20" height="8" rx="2" ry="2"></rect><rect x="2" y="14" width="20" height="8" rx="2" ry="2"></rect><line x1="6" y1="6" x2="6.01" y2="6"></line><line x1="6" y1="18" x2="6.01" y2="18"></line></svg>',lock:'<svg class="ts-icon" viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>'};function getSvg(iconName,extraClass){const raw=SVG_ICONS[iconName]||'';if(!raw)return document.createElement('span');const div=document.createElement('div');div.innerHTML=raw.trim();const el=div.firstElementChild||div;if(extraClass)el.classList.add(extraClass);return el;}
function getAdvRoutesStr(val){if(!val)return'';if(Array.isArray(val))return val.join(',');return''+val;}
return view.extend({load:function(){return Promise.all([callGetStatus(),callGetSubroutes(),callGetSettings(),callGetLogs(),uci.load('tailscale')]);},render:function(data){const status=data[0]||{};const subroutes=data[1]?.routes||[];const settings=data[2]||{};const logs=data[3]?.logs||[];const isRunning=(status.status==='running');const isLoginNeeded=(status.status==='logout'||status.backend_state==='NeedsLogin');const statusBadgeColor=isRunning?'#10b981':(isLoginNeeded?'#d97706':'#dc2626');const statusBadgeText=isRunning?_('Running'):(isLoginNeeded?_('Needs Login'):_('Stopped'));const peers=status.peers||{};const peerKeys=Object.keys(peers);const displayIpv4=(status.ipv4&&status.ipv4!=='No IP assigned'&&status.ipv4!=='No IP')?status.ipv4:_('No IP assigned');let directCount=0;let derpCount=0;peerKeys.forEach(k=>{if(peers[k].cur_addr&&peers[k].cur_addr!=='')directCount++;else derpCount++;});const styleTag=E('style',{},`
   
   /* Flat Modern Styling - Remove fuzzy legacy LuCI shadows */
   .ts-view-wrapper *,
   .ts-view-wrapper .zonebadge,
   .ts-view-wrapper .ts-ow-btn-copy,
   .ts-view-wrapper .btn,
   .ts-view-wrapper .cbi-button {
    text-shadow: none !important;
    box-shadow: none !important;
   }
   .ts-view-wrapper .btn:hover,
   .ts-view-wrapper .cbi-button:hover,
   .ts-view-wrapper .btn:focus,
   .ts-view-wrapper .cbi-button:focus {
    box-shadow: none !important;
    text-shadow: none !important;
   }

   .ts-view-wrapper {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    margin-bottom: 2rem;
    max-width: 100%;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
    text-rendering: optimizeLegibility;
   }

   
   .ts-ow-btn-copy {
    color: #059669 !important;
    border: 1px solid #059669 !important;
    background-color: transparent !important;
    background: transparent !important;
    font-weight: 600 !important;
    border-radius: 4px;
    transition: all 0.15s ease-in-out;
   }
   .ts-ow-btn-copy:hover {
    color: #047857 !important;
    background-color: #ecfdf5 !important;
    background: #ecfdf5 !important;
    border-color: #047857 !important;
   }

   .ts-ow-mono {
    font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
   }

   /* Crisp Vector Icons for Titles/Tabs */
   .ts-icon {
    width: 15px;
    height: 15px;
    stroke-width: 2;
    stroke: currentColor;
    fill: none;
    stroke-linecap: round;
    stroke-linejoin: round;
    vertical-align: -2px;
    display: inline-block;
    margin-right: 0.35rem;
    flex-shrink: 0;
   }

   /* Hero Status Card */
   .ts-ow-hero {
    background-color: var(--background-color-high, #ffffff);
    border: 1px solid var(--border-color-medium, #e2e8f0);
    border-radius: 4px;
    padding: 1rem 1.25rem;
    display: grid;
    grid-template-columns: 1.3fr 1fr 1fr 1fr;
    gap: 1rem;
   }
   .ts-ow-status-main {
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 0.25rem;
   }
   .ts-ow-status-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.2rem 0.55rem;
    border-radius: 12px;
    font-size: 0.75rem;
    font-weight: 700;
    width: fit-content;
    background-color: var(--background-color-medium, #f1f5f9);
    border: 1px solid var(--border-color-medium, #cbd5e1);
   }
   .ts-ow-status-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    display: inline-block;
   }
   .ts-ow-node-title {
    font-size: 1.15rem;
    font-weight: 700;
    color: var(--text-color-highest, #0f172a);
    display: flex;
    align-items: center;
    gap: 0.4rem;
   }
   .ts-ow-node-sub {
    color: var(--text-color-medium, #64748b);
    font-size: 0.8rem;
   }

   /* Metric Boxes */
   .ts-ow-metric {
    background-color: var(--background-color-medium, #f8fafc);
    border: 1px solid var(--border-color-low, #e2e8f0);
    border-radius: 4px;
    padding: 0.65rem 0.85rem;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
   }
   .ts-ow-metric-label {
    font-size: 0.7rem;
    font-weight: 700;
    text-transform: uppercase;
    color: var(--text-color-medium, #64748b);
    display: flex;
    align-items: center;
    justify-content: space-between;
   }
   .ts-ow-metric-value {
    font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
    font-size: 1.05rem;
    font-weight: 700;
    color: var(--text-color-highest, #0f172a);
    margin-top: 0.2rem;
    text-rendering: optimizeLegibility;
   }
   .ts-ow-metric-sub {
    font-size: 0.725rem;
    color: var(--text-color-medium, #64748b);
    margin-top: 0.2rem;
   }

   /* Tab Bar (Crisp, zero transitions) */
   .ts-ow-tab-bar {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem;
    border-bottom: 2px solid var(--border-color-medium, #e2e8f0);
    padding-bottom: 0;
    margin-top: 0.25rem;
   }
   .ts-ow-tab-btn {
    background: transparent;
    border: 1px solid transparent;
    border-bottom: none;
    color: var(--text-color-medium, #64748b);
    font-size: 0.875rem;
    font-weight: 600;
    padding: 0.55rem 0.95rem;
    border-radius: 4px 4px 0 0;
    cursor: pointer;
    display: flex;
    align-items: center;
    position: relative;
    white-space: nowrap;
   }
   .ts-ow-tab-btn:hover {
    color: var(--text-color-highest, #0f172a);
    background-color: var(--background-color-medium, #f1f5f9);
   }
   .ts-ow-tab-btn.active {
    color: var(--primary-color-medium, #0069d6);
    background-color: var(--background-color-high, #ffffff);
    border-color: var(--border-color-medium, #e2e8f0);
    border-bottom: 2px solid var(--background-color-high, #ffffff);
    margin-bottom: -2px;
    font-weight: 700;
   }

   /* Tab Panels */
   .ts-ow-panel {
    display: none;
   }
   .ts-ow-panel.active {
    display: block;
   }

   /* 2-Column Grid Cards */
   .ts-ow-grid-2col {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
   }
   .ts-ow-card {
    background-color: var(--background-color-high, #ffffff);
    border: 1px solid var(--border-color-medium, #e2e8f0);
    border-radius: 4px;
    padding: 1.15rem 1.25rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
   }
   .ts-ow-card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid var(--border-color-medium, #e2e8f0);
    padding-bottom: 0.65rem;
   }
   .ts-ow-card-title {
    font-size: 0.95rem;
    font-weight: 700;
    color: var(--text-color-highest, #0f172a);
    display: flex;
    align-items: center;
   }
   .ts-ow-card-desc {
    font-size: 0.775rem;
    color: var(--text-color-medium, #64748b);
    margin-top: 0.15rem;
   }

   /* Compact Table */
   .ts-table-wrapper {
    width: 100%;
    overflow-x: auto;
   }
   .table.cbi-section-table {
    width: 100% !important;
    margin: 0;
   }
   .table.cbi-section-table .th, .table.cbi-section-table .td {
    padding: 0.65rem 0.75rem;
    font-size: 0.85rem;
    vertical-align: middle;
   }

   /* Form Rows */
   .ts-ow-form-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 1rem;
    padding: 0.45rem 0;
    border-bottom: 1px dashed var(--border-color-low, #e2e8f0);
   }
   .ts-ow-form-row:last-child {
    border-bottom: none;
   }
   .ts-ow-form-group {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
   }
   .ts-ow-label {
    font-size: 0.825rem;
    font-weight: 600;
    color: var(--text-color-highest, #0f172a);
   }
   .ts-ow-hint {
    font-size: 0.725rem;
    color: var(--text-color-medium, #64748b);
    line-height: 1.35;
   }

   /* Subnet Pills */
   .ts-ow-pills {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
    margin-top: 0.2rem;
   }
   .ts-ow-pill {
    display: inline-flex;
    align-items: center;
    padding: 0.2rem 0.55rem;
    border: 1px solid var(--border-color-medium, #cbd5e1);
    border-radius: 4px;
    font-size: 0.75rem;
    background-color: var(--background-color-medium, #f8fafc);
    color: var(--text-color-high, #334155);
    cursor: pointer;
    user-select: none;
   }
   .ts-ow-pill:hover, .ts-ow-pill.active {
    background-color: var(--primary-color-medium, #0069d6);
    color: #fff;
    border-color: var(--primary-color-medium, #0069d6);
   }

   /* Logs Textarea */
   .ts-ow-terminal {
    width: 100%;
    height: 420px;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
    font-size: 0.8rem;
    line-height: 1.45;
    background-color: #f8fafc;
    color: #0f172a;
    border: 1px solid #cbd5e1;
    border-radius: 6px;
    padding: 0.75rem 1rem;
    box-sizing: border-box;
    white-space: pre-wrap;
    word-break: break-all;
    overflow-y: auto;
   }

   @media (prefers-color-scheme: dark) {
    .ts-ow-terminal {
     background-color: #0f172a;
     color: #f8fafc;
     border-color: #334155;
    }
   }

   @media (max-width: 900px) {
    .ts-ow-hero { grid-template-columns: 1fr; }
    .ts-ow-grid-2col { grid-template-columns: 1fr; }
   }
  `);

	function handleDirectJoin() {
		const srv = settings.login_server || settings.loginserver || '';
		const key = settings.authKey || settings.auth_key || settings.authkey || '';
		const host = settings.hostname || '';

		if (key) {
			ui.showModal(_('正在接入网络...'), [
				E('p', { 'class': 'spinning' }, _('正在使用当前配置的预授权密钥连接网络...'))
			]);
			callDoLogin({ login_server: srv, auth_key: key, hostname: host, loginserver: srv, loginserver_authkey: key, authKey: key }).then(function(res) {
				if (res && res.error) {
					ui.showModal(_('加入网络失败'), [
						E('p', {}, res.error),
						E('div', { 'style': 'display:flex; justify-content:flex-end; margin-top:1rem;' }, [
							E('button', { 'class': 'btn cbi-button', 'click': ui.hideModal }, _('关闭'))
						])
					]);
				} else {
					window.location.reload();
				}
			}).catch(function(err) {
				ui.showModal(_('错误'), [
					E('p', {}, err.message || err),
					E('div', { 'style': 'display:flex; justify-content:flex-end; margin-top:1rem;' }, [
						E('button', { 'class': 'btn cbi-button', 'click': ui.hideModal }, _('关闭'))
					])
				]);
			});
		} else {
			ui.showModal(_('正在获取授权链接...'), [
				E('p', { 'class': 'spinning' }, _('正在联系协调服务器生成网页登录链接...'))
			]);
			callDoLogin({ login_server: srv, auth_key: '', hostname: host, loginserver: srv, loginserver_authkey: '' }).then(function(res) {
				if (res && res.url) {
					ui.showModal(_('完成网页授权登录'), [
						E('p', { 'style': 'margin-bottom:0.5rem;' }, _('已生成授权链接，请在浏览器中打开完成登录：')),
						E('div', { 'style': 'margin:0.75rem 0; word-break:break-all; background:var(--background-color-medium,#f1f5f9); padding:0.75rem; border-radius:4px; font-family:monospace; font-size:0.85rem; border:1px solid var(--border-color-medium,#cbd5e1);' }, [
							E('a', { 'href': res.url, 'target': '_blank', 'style': 'color:#0284c7; text-decoration:underline; font-weight:bold;' }, res.url)
						]),
						E('div', { 'style': 'display:flex; gap:0.5rem; justify-content:flex-end; margin-top:1rem; flex-wrap:wrap;' }, [
							E('button', { 'class': 'btn cbi-button', 'click': function() {
								navigator.clipboard.writeText(res.url);
								const orig = this.textContent;
								this.textContent = _('已复制');
								const self = this;
								setTimeout(function() { self.textContent = orig; }, 1500);
							} }, _('复制链接')),
							E('a', { 'class': 'btn cbi-button cbi-button-apply important', 'href': res.url, 'target': '_blank' }, _('打开授权页面 ↗')),
							E('button', { 'class': 'btn cbi-button cbi-button-positive', 'click': function() { ui.hideModal(); window.location.reload(); } }, _('我已完成授权 (刷新)'))
						])
					]);
				} else {
					window.location.reload();
				}
			}).catch(function(err) {
				ui.showModal(_('错误'), [
					E('p', {}, err.message || err),
					E('div', { 'style': 'display:flex; justify-content:flex-end; margin-top:1rem;' }, [
						E('button', { 'class': 'btn cbi-button', 'click': ui.hideModal }, _('关闭'))
					])
				]);
			});
		}
	}

	const container = E('div', { 'class': 'ts-view-wrapper cbi-map' }, [
		styleTag,
		E('div', { 'style': 'display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.75rem;' }, [
			E('div', {}, [
				E('h2', { 'style': 'margin:0;' }, [E('a', { 'name': 'content' }, _('Mesh Network'))]),
				E('div', { 'class': 'cbi-map-descr', 'style': 'margin:0.2rem 0 0 0;' }, _('Zero-config Mesh virtual private network based on Tailscale / Headscale engine.'))
			])
		]),
		E('section', { 'class': 'ts-ow-hero' }, [
			E('div', { 'class': 'ts-ow-status-main' }, [
				E('div', { 'class': 'ts-ow-status-badge', 'style': 'color:' + statusBadgeColor + ';' }, [
					E('span', { 'class': 'ts-ow-status-dot', 'style': 'background-color:' + statusBadgeColor }),
					statusBadgeText
				]),
				E('div', { 'class': 'ts-ow-node-title', 'style': 'margin-top:0.25rem;' }, [
					E('span', {}, status.hostname || 'OpenWrt-Router'),
					E('span', { 'class': 'zonebadge', 'style': 'background-color:#0284c7; color:#fff; font-size:0.7rem; padding:1px 5px;' }, _('Current Device'))
				]),
				E('div', { 'class': 'ts-ow-node-sub' }, [
					_('Network:') + ' ',
					E('strong', { 'style': 'color:var(--text-color-highest);' }, status.domain_name || _('Tailnet Mesh'))
				])
			]),
			E('div', { 'class': 'ts-ow-metric' }, [
				E('div', { 'class': 'ts-ow-metric-label' }, [
					_('Tailscale IP'),
					E('button', { 'class': 'btn cbi-button ts-ow-btn-copy', 'click': function(ev) {
						ev.preventDefault();
						navigator.clipboard.writeText(status.ipv4 || '');
						const orig = this.textContent;
						this.textContent = _('已复制');
						const self = this;
						setTimeout(function() { self.textContent = orig; }, 1500);
					} }, _('Copy'))
				]),
				E('div', { 'class': 'ts-ow-metric-value', 'style': 'color:#0284c7;' }, displayIpv4),
				E('div', { 'class': 'ts-ow-metric-sub' }, _('IPv6:') + ' ' + (status.ipv6 ? status.ipv6.substring(0, 16) + '...' : _('None')))
			]),
			E('div', { 'class': 'ts-ow-metric' }, [
				E('div', { 'class': 'ts-ow-metric-label' }, [
					_('Firewall Mode'),
					E('span', { 'class': 'zonebadge', 'style': 'background-color:#059669; color:#fff; font-size:0.65rem; padding:0 3px;' }, 'NFTABLES')
				]),
				E('div', { 'class': 'ts-ow-metric-value', 'style': 'color:#059669;' }, 'Firewall4'),
				E('div', { 'class': 'ts-ow-metric-sub' }, _('Interface: tailscale0 (MTU 1280)'))
			]),
			E('div', { 'class': 'ts-ow-metric' }, [
				E('div', { 'class': 'ts-ow-metric-label' }, _('MESH Topology')),
				E('div', { 'class': 'ts-ow-metric-value' }, peerKeys.length + ' ' + _('Online Nodes')),
				E('div', { 'class': 'ts-ow-metric-sub' }, _('Direct') + ': ' + directCount + ' · ' + _('Relay') + ': ' + derpCount)
			])
		]),
		E('nav', { 'class': 'ts-ow-tab-bar' }, [
			E('button', { 'class': 'ts-ow-tab-btn active', 'data-tab': 'overview' }, [getSvg('users'), _('Mesh Nodes')]),
			E('button', { 'class': 'ts-ow-tab-btn', 'data-tab': 'settings' }, [getSvg('settings'), _('General Settings')]),
			E('button', { 'class': 'ts-ow-tab-btn', 'data-tab': 'routing' }, [getSvg('route'), _('Routing & Subnets')]),
			E('button', { 'class': 'ts-ow-tab-btn', 'data-tab': 'security' }, [getSvg('shield'), _('Firewall & Security')]),
			E('button', { 'class': 'ts-ow-tab-btn', 'data-tab': 'extra' }, [getSvg('terminal'), _('Advanced Flags')]),
			E('button', { 'class': 'ts-ow-tab-btn', 'data-tab': 'logs' }, [getSvg('fileText'), _('Logs')])
		]),
		E('div', { 'class': 'ts-ow-panel active', 'id': 'ts-ow-panel-overview' }, [
			E('div', { 'class': 'ts-ow-card' }, [
				E('div', { 'class': 'ts-ow-card-header' }, [
					E('div', {}, [
						E('div', { 'class': 'ts-ow-card-title' }, [getSvg('globe'), _('Mesh Peers')]),
						E('div', { 'class': 'ts-ow-card-desc' }, _('Real-time status, IP, and relay link topology for all connected mesh nodes.'))
					]),
					E('div', { 'style': 'display:flex; gap:0.4rem;' }, [
						E('button', { 'class': 'btn cbi-button cbi-button-action', 'click': function(ev) { ev.preventDefault(); window.location.reload(); } }, '刷新节点'),
						isRunning ? E('button', { 'class': 'btn cbi-button cbi-button-remove', 'click': function(ev) { ev.preventDefault(); if (confirm(_('Are you sure you want to logout and unbind this node?'))) { ui.showModal(_('Logging out...'), E('em', {}, _('Please wait...'))); callDoLogout().then(function() { ui.hideModal(); window.location.reload(); }); } } }, _('Logout & Unbind')) : E('button', { 'class': 'btn cbi-button cbi-button-apply', 'click': function(ev) { ev.preventDefault(); handleDirectJoin(); } }, _('Authorize Login'))
					])
				]),
				E('div', { 'class': 'ts-table-wrapper' }, [
					E('table', { 'class': 'table cbi-section-table' }, [
						E('thead', {}, [
							E('tr', { 'class': 'tr cbi-section-table-titles' }, [
								E('th', { 'class': 'th' }, _('Status / Device')),
								E('th', { 'class': 'th' }, _('Tailscale IP')),
								E('th', { 'class': 'th' }, _('OS')),
								E('th', { 'class': 'th' }, _('Features / Subnets')),
								E('th', { 'class': 'th' }, _('Link Mode')),
								E('th', { 'class': 'th', 'style': 'text-align:right;' }, _('Action'))
							])
						]),
						E('tbody', {}, [
							E('tr', { 'class': 'tr' }, [
								E('td', { 'class': 'td' }, [
									E('span', { 'class': 'ts-ow-status-dot', 'style': 'margin-right:5px; background-color:' + (isRunning ? '#10b981' : '#94a3b8') }),
									E('strong', {}, status.hostname || 'OpenWrt-Router'),
									' (' + _('Self') + ')'
								]),
								E('td', { 'class': 'td', 'style': 'font-family:ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;' }, displayIpv4),
								E('td', { 'class': 'td' }, 'OpenWrt'),
								E('td', { 'class': 'td' }, [
									E('span', { 'class': 'zonebadge', 'style': 'background-color:#0284c7; color:#fff; font-size:0.7rem;' }, 'Self'),
									' ',
									E('span', { 'class': 'zonebadge', 'style': 'background-color:#2563eb; color:#fff; font-size:0.7rem;' }, (getAdvRoutesStr(settings.advertise_routes) || '192.168.1.0/24'))
								]),
								E('td', { 'class': 'td' }, _('Local Interface (tailscale0)')),
								E('td', { 'class': 'td', 'style': 'text-align:right;' }, [
									E('button', { 'class': 'btn cbi-button ts-ow-btn-copy', 'click': function(ev) {
										ev.preventDefault();
										navigator.clipboard.writeText(status.ipv4 || '');
										const orig = this.textContent;
										this.textContent = _('已复制');
										const self = this;
										setTimeout(function() { self.textContent = orig; }, 1500);
									} }, _('Copy'))
								])
							]),
							...peerKeys.map(function(k) {
								const p = peers[k];
								const isDirect = (p.cur_addr && p.cur_addr !== '');
								const ipStr = p.ipv4 || p.ip || '-';
								return E('tr', { 'class': 'tr' }, [
									E('td', { 'class': 'td' }, [
										E('span', { 'class': 'ts-ow-status-dot', 'style': 'margin-right:5px; background-color:' + (p.online ? '#10b981' : '#94a3b8') }),
										E('strong', {}, p.hostname)
									]),
									E('td', { 'class': 'td', 'style': 'font-family:ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;' }, ipStr),
									E('td', { 'class': 'td' }, p.os || 'Linux'),
									E('td', { 'class': 'td' }, [
										p.exit_node ? E('span', { 'class': 'zonebadge', 'style': 'background-color:#d97706; color:#fff; font-size:0.7rem;' }, _('Exit Node')) : '',
										(p.primary_routes && p.primary_routes.length > 0) ? E('span', { 'class': 'zonebadge', 'style': 'background-color:#2563eb; color:#fff; font-size:0.7rem; margin-left:3px;' }, p.primary_routes.join(',')) : ''
									]),
									E('td', { 'class': 'td' }, isDirect ? E('span', { 'style': 'color:#059669; font-weight:bold;' }, _('Direct')) : E('span', { 'style': 'color:#d97706;' }, _('Relay') + ' ' + (p.relay ? '(' + p.relay + ')' : ''))),
									E('td', { 'class': 'td', 'style': 'text-align:right;' }, [
										E('button', { 'class': 'btn cbi-button ts-ow-btn-copy', 'click': function(ev) {
											ev.preventDefault();
											navigator.clipboard.writeText(ipStr);
											const orig = this.textContent;
											this.textContent = _('已复制');
											const self = this;
											setTimeout(function() { self.textContent = orig; }, 1500);
										} }, _('Copy'))
									])
								]);
							})
						])
					])
				])
			])
		]),
		E('div', { 'class': 'ts-ow-panel', 'id': 'ts-ow-panel-settings' }, [
			E('div', { 'class': 'ts-ow-grid-2col' }, [
				E('div', { 'class': 'ts-ow-card' }, [
					E('div', { 'class': 'ts-ow-card-header' }, [
						E('div', {}, [
							E('div', { 'class': 'ts-ow-card-title' }, [getSvg('server'), _('Core Service Management')]),
							E('div', { 'class': 'ts-ow-card-desc' }, _('Core parameters mapped to UCI /etc/config/tailscale'))
						])
					]),
					E('div', { 'class': 'ts-ow-form-row' }, [
						E('div', {}, [
							E('div', { 'class': 'ts-ow-label' }, _('Enable Outlierox Service')),
							E('div', { 'class': 'ts-ow-hint' }, _('Start tailscaled daemon automatically on system boot'))
						]),
						E('input', { 'type': 'checkbox', 'class': 'cbi-input-checkbox', 'id': 'ts_enabled', 'checked': (settings.enabled !== '0' ? '' : null) })
					]),
					E('div', { 'class': 'ts-ow-form-group' }, [
						E('label', { 'class': 'ts-ow-label' }, _('Listen Port')),
						E('input', { 'type': 'number', 'class': 'cbi-input-text', 'id': 'ts_port', 'value': settings.port || '41641', 'placeholder': '41641' }),
						E('span', { 'class': 'ts-ow-hint' }, _('Tailscale WireGuard UDP listen port (default: 41641)'))
					]),
					E('div', { 'class': 'ts-ow-form-group' }, [
						E('label', { 'class': 'ts-ow-label' }, _('State Directory')),
						E('input', { 'type': 'text', 'class': 'cbi-input-text', 'id': 'ts_config_path', 'value': settings.config_path || settings.state_dir || '/etc/tailscale' }),
						E('span', { 'class': 'ts-ow-hint' }, _('Directory for persistent node state and keys'))
					]),
					E('div', { 'class': 'ts-ow-form-row' }, [
						E('div', { 'class': 'ts-ow-label' }, _('Firewall Backend Mode')),
						E('div', { 'style': 'font-size:0.875rem; font-weight:700; color:#059669; white-space:nowrap; flex-shrink:0;' }, (status.fw_name || 'Firewall4') + ' (' + (status.fw_driver || 'nftables') + ')')
					]),
					E('div', { 'class': 'ts-ow-form-row' }, [
						E('div', {}, [
							E('div', { 'class': 'ts-ow-label' }, _('Standard Output Log')),
							E('div', { 'class': 'ts-ow-hint' }, _('Log runtime and connection events to syslog'))
						]),
						E('input', { 'type': 'checkbox', 'class': 'cbi-input-checkbox', 'id': 'ts_log_stdout', 'checked': (settings.log_stdout !== '0' ? '' : null) })
					]),
					E('div', { 'class': 'ts-ow-form-row' }, [
						E('div', {}, [
							E('div', { 'class': 'ts-ow-label' }, _('Error Log')),
							E('div', { 'class': 'ts-ow-hint' }, _('Log runtime errors and stack traces'))
						]),
						E('input', { 'type': 'checkbox', 'class': 'cbi-input-checkbox', 'id': 'ts_log_stderr', 'checked': (settings.log_stderr !== '0' ? '' : null) })
					])
				]),
				E('div', { 'class': 'ts-ow-card' }, [
					E('div', { 'class': 'ts-ow-card-header' }, [
						E('div', {}, [
							E('div', { 'class': 'ts-ow-card-title' }, [getSvg('lock'), _('Private Node & Headscale Integration')]),
							E('div', { 'class': 'ts-ow-card-desc' }, _('Connect to self-hosted Headscale control server'))
						])
					]),
					E('div', { 'class': 'ts-ow-form-group' }, [
						E('label', { 'class': 'ts-ow-label' }, _('Login Server URL')),
						E('input', { 'type': 'text', 'class': 'cbi-input-text', 'id': 'ts_login_server', 'value': settings.login_server || settings.loginserver || '', 'placeholder': 'https://headscale.example.com' }),
						E('span', { 'class': 'ts-ow-hint' }, _('Leave empty to use official Tailscale SaaS coordination server'))
					]),
					E('div', { 'class': 'ts-ow-form-group' }, [
						E('label', { 'class': 'ts-ow-label' }, _('Pre-Auth Key')),
						E('input', { 'type': 'password', 'class': 'cbi-input-text', 'id': 'ts_authKey', 'value': settings.authKey || settings.auth_key || settings.authkey || '', 'placeholder': 'tskey-auth-xxxxxxxxxxxx' }),
						E('span', { 'class': 'ts-ow-hint' }, _('Auth key for headless non-interactive node joining'))
					]),
					E('div', { 'class': 'ts-ow-form-group' }, [
						E('label', { 'class': 'ts-ow-label' }, _('Custom Hostname')),
						E('input', { 'type': 'text', 'class': 'cbi-input-text', 'id': 'ts_hostname', 'value': settings.hostname || '', 'placeholder': 'OpenWrt-Router' }),
						E('span', { 'class': 'ts-ow-hint' }, _('Friendly name in the Tailnet mesh'))
					]),
					E('div', { 'style': 'background-color:var(--background-color-medium); border:1px solid var(--border-color-low); border-radius:4px; padding:0.75rem; display:flex; justify-content:space-between; align-items:center; margin-top:0.5rem;' }, [
						E('div', { 'style': 'font-size:0.75rem; color:var(--text-color-medium);' }, _('快捷工具：修复虚拟接口与防火墙规则')),
						E('button', { 'class': 'btn cbi-button cbi-button-action', 'click': function(ev) {
							ev.preventDefault();
							ui.showModal(_('正在修复防火墙...'), [
								E('p', { 'class': 'spinning' }, _('正在配置接口与防火墙规则...'))
							]);
							callSetupFirewall().then(function() {
								setTimeout(function() { window.location.reload(); }, 600);
							}).catch(function(err) {
								ui.showModal(_('错误'), [
									E('p', {}, err.message || err),
									E('div', { 'style': 'display:flex; justify-content:flex-end; margin-top:1rem;' }, [
										E('button', { 'class': 'btn cbi-button', 'click': ui.hideModal }, _('关闭'))
									])
								]);
							});
						} }, _('修复防火墙'))
					])
				])
			])
		]),
		E('div', { 'class': 'ts-ow-panel', 'id': 'ts-ow-panel-routing' }, [
			E('div', { 'class': 'ts-ow-grid-2col' }, [
				E('div', { 'class': 'ts-ow-card' }, [
					E('div', { 'class': 'ts-ow-card-header' }, [
						E('div', {}, [
							E('div', { 'class': 'ts-ow-card-title' }, [getSvg('route'), _('Advertise LAN Subnets')]),
							E('div', { 'class': 'ts-ow-card-desc' }, _('Publish local subnets for access by other mesh nodes'))
						])
					]),
					E('div', { 'class': 'ts-ow-form-group' }, [
						E('label', { 'class': 'ts-ow-label' }, _('Auto-detected Subnets (Click to toggle)')),
						subroutes.length > 0 ? E('div', { 'class': 'ts-ow-pills' }, subroutes.map(function(sub) {
							const advList = (getAdvRoutesStr(settings.advertise_routes) || '').split(/[\s,]+/).filter(Boolean);
							const isAct = advList.includes(sub);
							return E('span', { 'class': 'ts-ow-pill' + (isAct ? ' active' : ''), 'click': function() {
								const input = document.getElementById('ts_advertise_routes');
								let cur = input.value.trim().split(/[\s,]+/).filter(Boolean);
								if (cur.includes(sub)) {
									cur = cur.filter(x => x !== sub);
									this.classList.remove('active');
								} else {
									cur.push(sub);
									this.classList.add('active');
								}
								input.value = cur.join(',');
							} }, sub);
						})) : E('div', { 'class': 'ts-ow-hint', 'style': 'color:var(--text-color-medium);' }, _('未检测到有效的本机局域网子网'))
					]),
					E('div', { 'class': 'ts-ow-form-group' }, [
						E('label', { 'class': 'ts-ow-label' }, _('Advertised Subnets')),
						E('input', { 'type': 'text', 'class': 'cbi-input-text', 'id': 'ts_advertise_routes', 'value': getAdvRoutesStr(settings.advertise_routes), 'placeholder': '192.168.1.0/24' }),
						E('span', { 'class': 'ts-ow-hint' }, _('多个子网用逗号隔开，支持任意自定义网段，例如：192.168.1.0/24,10.0.0.0/24'))
					]),
					E('div', { 'class': 'ts-ow-form-row' }, [
						E('div', {}, [
							E('div', { 'class': 'ts-ow-label' }, _('Advertise as Exit Node')),
							E('div', { 'class': 'ts-ow-hint' }, _('Allow other mesh nodes to route internet traffic through this router'))
						]),
						E('input', { 'type': 'checkbox', 'class': 'cbi-input-checkbox', 'id': 'ts_advertise_exit_node', 'checked': (settings.advertise_exit_node === '1' ? '' : null) })
					])
				]),
				E('div', { 'class': 'ts-ow-card' }, [
					E('div', { 'class': 'ts-ow-card-header' }, [
						E('div', {}, [
							E('div', { 'class': 'ts-ow-card-title' }, [getSvg('globe'), _('Subnet Acceptance & Exit Nodes')]),
							E('div', { 'class': 'ts-ow-card-desc' }, _('Access remote subnets or use remote mesh exit nodes'))
						])
					]),
					E('div', { 'class': 'ts-ow-form-row' }, [
						E('div', {}, [
							E('div', { 'class': 'ts-ow-label' }, _('Accept Remote Subnet Routes')),
							E('div', { 'class': 'ts-ow-hint' }, _('Automatically inject published remote subnets into local routing table'))
						]),
						E('input', { 'type': 'checkbox', 'class': 'cbi-input-checkbox', 'id': 'ts_accept_routes', 'checked': (settings.accept_routes !== '0' ? '' : null) })
					]),
					E('div', { 'class': 'ts-ow-form-row' }, [
						E('div', {}, [
							E('div', { 'class': 'ts-ow-label' }, _('Site-to-Site Transparent SNAT')),
							E('div', { 'class': 'ts-ow-hint' }, _('Disable subnet SNAT to preserve original IP addresses'))
						]),
						E('input', { 'type': 'checkbox', 'class': 'cbi-input-checkbox', 'id': 'ts_disable_snat_subnet_routes', 'checked': (settings.disable_snat_subnet_routes === '1' ? '' : null) })
					]),
					E('div', { 'class': 'ts-ow-form-group' }, [
						E('label', { 'class': 'ts-ow-label' }, _('Use Remote Exit Node')),
						E('select', { 'class': 'cbi-input-select', 'id': 'ts_exit_node' }, [
							E('option', { 'value': '', 'selected': !settings.exit_node }, _('Do not use exit node (Direct)')),
							...peerKeys.filter(k => peers[k].exit_node_option).map(k => {
								const p = peers[k];
								const ip = p.ipv4 || p.ip.split('<br>')[0];
								return E('option', { 'value': ip, 'selected': (settings.exit_node === ip) }, p.hostname + ' (' + ip + ')');
							})
						])
					]),
					E('div', { 'class': 'ts-ow-form-row' }, [
						E('div', {}, [
							E('div', { 'class': 'ts-ow-label' }, _('Allow LAN Access from Exit Node')),
							E('div', { 'class': 'ts-ow-hint' }, _('Allow direct access to local LAN when using an exit node'))
						]),
						E('input', { 'type': 'checkbox', 'class': 'cbi-input-checkbox', 'id': 'ts_exit_node_allow_lan_access', 'checked': (settings.exit_node_allow_lan_access !== '0' ? '' : null) })
					])
				])
			])
		]),
		E('div', { 'class': 'ts-ow-panel', 'id': 'ts-ow-panel-security' }, [
			E('div', { 'class': 'ts-ow-grid-2col' }, [
				E('div', { 'class': 'ts-ow-card' }, [
					E('div', { 'class': 'ts-ow-card-header' }, [
						E('div', {}, [
							E('div', { 'class': 'ts-ow-card-title' }, [getSvg('shield'), _('Firewall4 Zone Policies')]),
							E('div', { 'class': 'ts-ow-card-desc' }, _('Manage OpenWrt Firewall4 zone rules safely and non-destructively'))
						]),
						E('button', { 'class': 'btn cbi-button cbi-button-action', 'click': function(ev) {
							ev.preventDefault();
							ui.showModal(_('正在修复防火墙...'), [
								E('p', { 'class': 'spinning' }, _('正在配置接口与防火墙规则...'))
							]);
							callSetupFirewall().then(function() {
								setTimeout(function() { window.location.reload(); }, 600);
							}).catch(function(err) {
								ui.showModal(_('错误'), [
									E('p', {}, err.message || err),
									E('div', { 'style': 'display:flex; justify-content:flex-end; margin-top:1rem;' }, [
										E('button', { 'class': 'btn cbi-button', 'click': ui.hideModal }, _('关闭'))
									])
								]);
							});
						} }, _('Repair Rules'))
					]),
					E('div', { 'class': 'ts-ow-form-row' }, [
						E('div', {}, [
							E('div', { 'class': 'ts-ow-label' }, _('Tailscale to LAN Access')),
							E('div', { 'class': 'ts-ow-hint' }, _('Allow remote Tailscale clients to access router LAN'))
						]),
						E('input', { 'type': 'checkbox', 'class': 'cbi-input-checkbox', 'id': 'ts_ac_lan', 'checked': '' })
					]),
					E('div', { 'class': 'ts-ow-form-row' }, [
						E('div', {}, [
							E('div', { 'class': 'ts-ow-label' }, _('LAN to Tailscale Access')),
							E('div', { 'class': 'ts-ow-hint' }, _('Allow LAN clients to connect to remote Tailscale devices'))
						]),
						E('input', { 'type': 'checkbox', 'class': 'cbi-input-checkbox', 'id': 'ts_lan_ts', 'checked': '' })
					]),
					E('div', { 'class': 'ts-ow-form-row' }, [
						E('div', {}, [
							E('div', { 'class': 'ts-ow-label' }, _('Tailscale to WAN Access')),
							E('div', { 'class': 'ts-ow-hint' }, _('Allow exit node traffic forwarding to public WAN'))
						]),
						E('input', { 'type': 'checkbox', 'class': 'cbi-input-checkbox', 'id': 'ts_ac_wan', 'checked': '' })
					])
				]),
				E('div', { 'class': 'ts-ow-card' }, [
					E('div', { 'class': 'ts-ow-card-header' }, [
						E('div', {}, [
							E('div', { 'class': 'ts-ow-card-title' }, [getSvg('lock'), _('DNS & Security Features')]),
							E('div', { 'class': 'ts-ow-card-desc' }, _('Configure MagicDNS resolution and inbound connection shields'))
						])
					]),
					E('div', { 'class': 'ts-ow-form-row' }, [
						E('div', {}, [
							E('div', { 'class': 'ts-ow-label' }, _('Enable MagicDNS')),
							E('div', { 'class': 'ts-ow-hint' }, _('Route *.ts.net queries to 100.100.100.100'))
						]),
						E('input', { 'type': 'checkbox', 'class': 'cbi-input-checkbox', 'id': 'ts_accept_dns', 'checked': (settings.accept_dns !== '0' ? '' : null) })
					]),
					E('div', { 'class': 'ts-ow-form-row' }, [
						E('div', {}, [
							E('div', { 'class': 'ts-ow-label' }, _('Enable Shields Up')),
							E('div', { 'class': 'ts-ow-hint' }, _('Block all inbound connections from other mesh peers'))
						]),
						E('input', { 'type': 'checkbox', 'class': 'cbi-input-checkbox', 'id': 'ts_shields_up', 'checked': (settings.shields_up === '1' ? '' : null) })
					]),
					E('div', { 'class': 'ts-ow-form-row' }, [
						E('div', {}, [
							E('div', { 'class': 'ts-ow-label' }, _('Enable Outlierox SSH')),
							E('div', { 'class': 'ts-ow-hint' }, _('Secure Tailscale-authenticated SSH access'))
						]),
						E('input', { 'type': 'checkbox', 'class': 'cbi-input-checkbox', 'id': 'ts_ssh', 'checked': (settings.ssh === '1' ? '' : null) })
					])
				])
			])
		]),
		E('div', { 'class': 'ts-ow-panel', 'id': 'ts-ow-panel-extra' }, [
			E('div', { 'class': 'ts-ow-card' }, [
				E('div', { 'class': 'ts-ow-card-header' }, [
					E('div', {}, [
						E('div', { 'class': 'ts-ow-card-title' }, [getSvg('terminal'), _('Advanced Flags & Parameters')]),
						E('div', { 'class': 'ts-ow-card-desc' }, _('Extra arguments passed to tailscale up/set on daemon startup'))
					])
				]),
				E('div', { 'class': 'ts-ow-form-group' }, [
					E('label', { 'class': 'ts-ow-label' }, _('Custom Startup Flags')),
					E('textarea', { 'class': 'cbi-input-textarea', 'id': 'ts_flags', 'rows': 3, 'placeholder': '--netfilter-mode=nodivert --operator=root', 'style': 'width:100%; font-family:ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;' }, settings.flags || ''),
					E('span', { 'class': 'ts-ow-hint' }, _('Supports all official Tailscale CLI flags'))
				]),
				E('div', { 'class': 'ts-ow-grid-2col' }, [
					E('div', { 'class': 'ts-ow-form-group' }, [
						E('label', { 'class': 'ts-ow-label' }, _('Virtual Interface MTU')),
						E('input', { 'type': 'number', 'class': 'cbi-input-text', 'id': 'ts_daemon_mtu', 'value': settings.daemon_mtu || '1280' }),
						E('span', { 'class': 'ts-ow-hint' }, _('Virtual tunnel MTU (Default: 1280)'))
					]),
					E('div', { 'class': 'ts-ow-form-group' }, [
						E('label', { 'class': 'ts-ow-label' }, _('Memory Optimization Mode')),
						E('select', { 'class': 'cbi-input-select', 'id': 'ts_reduce_memory' }, [
							E('option', { 'value': '0', 'selected': (settings.reduce_memory !== '1') }, _('Disabled (Standard Performance)')),
							E('option', { 'value': '1', 'selected': (settings.reduce_memory === '1') }, _('Enabled (Reduced GC Frequency)'))
						])
					])
				])
			]),
			E('div', { 'class': 'ts-ow-card', 'style': 'margin-top:1rem; border-color:#fca5a5;' }, [
				E('div', { 'class': 'ts-ow-card-header' }, [
					E('div', {}, [
						E('div', { 'class': 'ts-ow-card-title', 'style': 'color:#dc2626;' }, [getSvg('shield'), '服务重置与缓存清理']),
						E('div', { 'class': 'ts-ow-card-desc' }, '清空 Tailscale 运行时节点状态与认证缓存并重启后台服务')
					]),
					E('button', { 'class': 'btn cbi-button cbi-button-remove', 'click': function(ev) {
						ev.preventDefault();
						if (confirm(_('Are you sure you want to clean runtime cache and restart service?'))) {
							ui.showModal(_('Resetting...'), [
								E('p', { 'class': 'spinning' }, _('Please wait...'))
							]);
							callCleanupReset().then(function() {
								setTimeout(function() { window.location.reload(); }, 1200);
							});
						}
					} }, '清理并重启服务')
				])
			])
		]),
		E('div', { 'class': 'ts-ow-panel', 'id': 'ts-ow-panel-logs' }, [
			E('div', { 'class': 'ts-ow-card' }, [
				E('div', { 'class': 'ts-ow-card-header' }, [
					E('div', {}, [
						E('div', { 'class': 'ts-ow-card-title' }, [getSvg('fileText'), _('Real-time Logs')]),
						E('div', { 'class': 'ts-ow-card-desc' }, _('Live syslog events captured from logread'))
					]),
					E('div', { 'style': 'display:flex; gap:0.4rem;' }, [
						E('button', { 'class': 'btn cbi-button cbi-button-action', 'click': function(ev) {
							ev.preventDefault();
							callGetLogs().then(function(res) {
								const body = document.getElementById('ts_log_body');
								if (body && res?.logs) {
									const cleaned = res.logs.map(l => ('' + l).trim()).filter(Boolean);
									body.value = cleaned.length > 0 ? cleaned.join('\n') : _('No logs recorded.');
								}
							});
						} }, _('Refresh')),
						E('button', { 'class': 'btn cbi-button ts-ow-btn-copy', 'click': function(ev) {
							ev.preventDefault();
							const body = document.getElementById('ts_log_body');
							if (body) {
								navigator.clipboard.writeText(body.value);
								const orig = this.textContent;
								this.textContent = _('已复制');
								const self = this;
								setTimeout(function() { self.textContent = orig; }, 1500);
							}
						} }, _('Copy'))
					])
				]),
				E('textarea', { 'class': 'ts-ow-terminal', 'id': 'ts_log_body', 'readonly': 'readonly' }, (function() {
					const cleaned = (logs || []).map(l => ('' + l).trim()).filter(Boolean);
					return cleaned.length > 0 ? cleaned.join('\n') : _('No logs recorded.');
				})())
			])
		])
	]);

	setTimeout(function() {
		const tabs = container.querySelectorAll('.ts-ow-tab-bar > .ts-ow-tab-btn');
		const panels = container.querySelectorAll('.ts-ow-panel');

		function switchTab(tabName) {
			const targetBtn = container.querySelector('.ts-ow-tab-btn[data-tab="' + tabName + '"]');
			const targetPanel = container.querySelector('#ts-ow-panel-' + tabName);
			if (targetBtn && targetPanel) {
				tabs.forEach(t => t.classList.remove('active'));
				panels.forEach(p => p.classList.remove('active'));
				targetBtn.classList.add('active');
				targetPanel.classList.add('active');
			}
		}

		tabs.forEach(function(btn) {
			btn.addEventListener('click', function() {
				const tabName = btn.getAttribute('data-tab');
				switchTab(tabName);
				window.sessionStorage.setItem('outlierox_active_tab', tabName);
				history.replaceState(null, '', window.location.pathname + window.location.search + '#' + tabName);
			});
		});

		const savedTab = (window.location.hash.replace(/^#/, '') || window.sessionStorage.getItem('outlierox_active_tab') || 'overview');
		if (savedTab && savedTab !== 'overview') {
			switchTab(savedTab);
		}
	}, 50);

	return container;
},

handleSaveApply: function(ev, mode) {
	const formData = collectFormData();
	ui.showModal(_('Applying Outlierox Configuration...'), [
		E('p', { 'class': 'spinning' }, _('Saving and syncing configuration to tailscaled daemon...'))
	]);
	return callSetSettings(formData)
		.then(function() {
			if (L.env && L.env.sessionid && L.env.token) {
				return request.request(L.url('admin/uci/revert'), {
					method: 'post',
					query: { sid: L.env.sessionid, token: L.env.token }
				});
			}
		})
		.then(function() {
			return uci.unload('tailscale');
		})
		.then(L.bind(ui.changes.init, ui.changes))
		.then(function() {
			setTimeout(function() {
				window.location.reload();
			}, 1200);
		}).catch(function(err) {
			ui.showModal(_('错误'), [
				E('p', {}, err.message || err),
				E('div', { 'style': 'display:flex; justify-content:flex-end; margin-top:1rem;' }, [
					E('button', { 'class': 'btn cbi-button', 'click': ui.hideModal }, _('关闭'))
				])
			]);
		});
},

handleSave: function(ev) {
	const formData = collectFormData();
	let sec = 'settings';
	if (uci.get('tailscale', 'settings') == null) {
		uci.sections('tailscale', 'settings', function(s) { sec = s['.name']; });
	}
	if (uci.get('tailscale', sec) == null) {
		sec = uci.add('tailscale', 'settings', 'settings');
	}
	for (let k in formData) {
		if (formData[k] != null) {
			let v = formData[k];
			if (Array.isArray(v)) {
				uci.set('tailscale', sec, k, v.length > 0 ? v : null);
			} else {
				uci.set('tailscale', sec, k, v !== '' ? ('' + v) : null);
			}
		}
	}
	if (formData.authKey != null) {
		uci.set('tailscale', sec, 'auth_key', formData.authKey !== '' ? formData.authKey : null);
		uci.set('tailscale', sec, 'authKey', formData.authKey !== '' ? formData.authKey : null);
	}
	if (formData.login_server != null) {
		uci.set('tailscale', sec, 'login_server', formData.login_server !== '' ? formData.login_server : null);
		uci.set('tailscale', sec, 'loginserver', formData.login_server !== '' ? formData.login_server : null);
	}
	return uci.save().then(L.bind(ui.changes.init, ui.changes));
},

handleReset: function(ev) {
	return ui.changes.revert();
}
});

function collectFormData() {
	const srv = document.getElementById('ts_login_server')?.value || '';
	const key = document.getElementById('ts_authKey')?.value || '';
	const host = document.getElementById('ts_hostname')?.value || '';
	return {
		enabled: document.getElementById('ts_enabled')?.checked ? '1' : '0',
		port: document.getElementById('ts_port')?.value || '41641',
		config_path: document.getElementById('ts_config_path')?.value || '/etc/tailscale',
		state_dir: document.getElementById('ts_config_path')?.value || '/etc/tailscale',
		log_stdout: document.getElementById('ts_log_stdout')?.checked ? '1' : '0',
		log_stderr: document.getElementById('ts_log_stderr')?.checked ? '1' : '0',
		login_server: srv,
		loginserver: srv,
		authKey: key,
		auth_key: key,
		hostname: host,
		advertise_routes: document.getElementById('ts_advertise_routes')?.value ? document.getElementById('ts_advertise_routes').value.split(/[\s,]+/).filter(Boolean) : [],
		advertise_exit_node: document.getElementById('ts_advertise_exit_node')?.checked ? '1' : '0',
		accept_routes: document.getElementById('ts_accept_routes')?.checked ? '1' : '0',
		disable_snat_subnet_routes: document.getElementById('ts_disable_snat_subnet_routes')?.checked ? '1' : '0',
		exit_node: document.getElementById('ts_exit_node')?.value || '',
		exit_node_allow_lan_access: document.getElementById('ts_exit_node_allow_lan_access')?.checked ? '1' : '0',
		accept_dns: document.getElementById('ts_accept_dns')?.checked ? '1' : '0',
		shields_up: document.getElementById('ts_shields_up')?.checked ? '1' : '0',
		ssh: document.getElementById('ts_ssh')?.checked ? '1' : '0',
		flags: document.getElementById('ts_flags')?.value || '',
		daemon_mtu: document.getElementById('ts_daemon_mtu')?.value || '1280',
		reduce_memory: document.getElementById('ts_reduce_memory')?.value || '0'
	};
}