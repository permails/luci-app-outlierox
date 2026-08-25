/*
 * Copyright (C) 2026 permails <logo@permails.com>
 * Outlierox - Zero-Config Tailnet Mesh for OpenWrt
 */

import { popen, open } from 'fs';
import { connect } from 'ubus';
import * as uci from 'uci';

function shell_quote(str) {
	if (str == null) return "''";
	return "'" + replace(str, "'", "'\\''") + "'";
}

function exec(cmd) {
	let p = popen(cmd, 'r');
	let out = [];
	let line = p.read('line');
	while (line != null) {
		line = replace(line, /\r?\n$/, '');
		if (line != '') {
			push(out, line);
		}
		line = p.read('line');
	}
	let code = p.close();
	return { code: code, stdout: out };
}

let methods = {};

methods.get_status = {
	call: function() {
		let result = {
			status: 'logout',
			version: 'Unknown',
			ipv4: null,
			ipv6: null,
			domain_name: '',
			backend_state: 'Stopped',
			auth_url: '',
			peers: {},
			health: []
		};

		try {
			let tresult = exec('/usr/sbin/tailscale status --json');
			if (tresult.code == 0 && length(tresult.stdout) > 0) {
				let json_str = join('', tresult.stdout);
				let status_json = json(json_str);

				result.version = status_json?.Version || 'Unknown';
				result.backend_state = status_json?.BackendState || 'Stopped';
				result.auth_url = status_json?.AuthURL || '';

				if (status_json?.Health) {
					result.health = status_json.Health;
				}

				if (status_json?.BackendState == 'Running') {
					result.status = 'running';
				} else if (status_json?.BackendState == 'NeedsLogin') {
					result.status = 'logout';
				} else {
					result.status = 'stopped';
				}

				if (status_json?.Self) {
					let self_node = status_json.Self;
					result.hostname = self_node?.HostName || 'OpenWrt';
					result.dns_name = self_node?.DNSName || '';
					if (self_node?.TailscaleIPs && length(self_node.TailscaleIPs) > 0) {
						result.ipv4 = self_node.TailscaleIPs[0];
						if (length(self_node.TailscaleIPs) > 1) {
							result.ipv6 = self_node.TailscaleIPs[1];
						}
					}
					if (status_json?.MagicDNSSuffix) {
						result.domain_name = status_json.MagicDNSSuffix;
					}
				}

				if (status_json?.Peer) {
					for (let peer_id in status_json.Peer) {
						let peer = status_json.Peer[peer_id];
						let p_info = {
							id: peer_id,
							hostname: peer.HostName || 'Unknown',
							dns_name: peer.DNSName || '',
							os: peer.OS || 'Unknown',
							online: peer.Online || false,
							exit_node: peer.ExitNode || false,
							exit_node_option: peer.ExitNodeOption || false,
							cur_addr: peer.CurAddr || '',
							relay: peer.Relay || '',
							primary_routes: peer.PrimaryRoutes || [],
							ip: ''
						};
						if (peer.TailscaleIPs && length(peer.TailscaleIPs) > 0) {
							p_info.ip = join('<br>', peer.TailscaleIPs);
							p_info.ipv4 = peer.TailscaleIPs[0];
						}
						result.peers[peer_id] = p_info;
					}
				}
			}
		} catch (e) {
			result.error = '' + e;
		}

		let is_fw4 = (exec('test -x /sbin/fw4').code == 0);
		result.fw_mode = is_fw4 ? 'nftables' : 'iptables';
		result.fw_name = is_fw4 ? 'Firewall4' : 'Firewall3';
		result.fw_badge = is_fw4 ? 'NFTABLES' : 'IPTABLES';
		result.fw_driver = is_fw4 ? 'nftables' : 'iptables';

		return result;
	}
};

function get_tailscale_sec(u) {
	let sec_name = null;
	if (u.get_all('tailscale', 'settings') != null) return 'settings';
	u.foreach('tailscale', 'tailscale', function(s) {
		sec_name = s['.name'];
		return false;
	});
	if (sec_name != null) return sec_name;
	u.foreach('tailscale', 'settings', function(s) {
		sec_name = s['.name'];
		return false;
	});
	return sec_name;
}

methods.get_settings = {
	call: function() {
		let settings = {};
		try {
			let u = uci.cursor();
			u.load('tailscale');
			let sec = get_tailscale_sec(u);
			if (sec != null) {
				let all = u.get_all('tailscale', sec);
				if (all != null) {
					settings = all;
				}
			}
			if (settings.auth_key && !settings.authKey) settings.authKey = settings.auth_key;
			if (settings.authkey && !settings.authKey) settings.authKey = settings.authkey;
			if (settings.authKey && !settings.auth_key) settings.auth_key = settings.authKey;

			if (settings.loginserver && !settings.login_server) settings.login_server = settings.loginserver;
			if (settings.login_server && !settings.loginserver) settings.loginserver = settings.login_server;

			if (settings.state_dir && !settings.config_path) settings.config_path = settings.state_dir;
			if (settings.config_path && !settings.state_dir) settings.state_dir = settings.config_path;
		} catch (e) { /* ignore */ }
		return settings;
	}
};

methods.set_settings = {
	args: { form_data: {} },
	call: function(request) {
		let form_data = request.args.form_data || request.args || {};
		if (form_data.form_data != null) {
			form_data = form_data.form_data;
		}
		if (form_data == null || length(form_data) == 0) {
			return { error: 'Missing or invalid form_data parameter.' };
		}

		let u = uci.cursor();
		u.load('tailscale');
		let sec = get_tailscale_sec(u);
		if (sec == null) {
			sec = 'settings';
			u.set('tailscale', sec, 'settings');
		}

		for (let key in form_data) {
			if (form_data[key] != null) {
				u.set('tailscale', sec, key, form_data[key]);
			}
		}

		if (form_data.authKey != null) {
			u.set('tailscale', sec, 'auth_key', form_data.authKey);
			u.set('tailscale', sec, 'authKey', form_data.authKey);
		}
		if (form_data.login_server != null) {
			u.set('tailscale', sec, 'login_server', form_data.login_server);
			u.set('tailscale', sec, 'loginserver', form_data.login_server);
		}
		if (form_data.config_path != null) {
			u.set('tailscale', sec, 'state_dir', form_data.config_path);
			u.set('tailscale', sec, 'state_file', form_data.config_path + '/tailscaled.state');
		}

		u.save('tailscale');
		u.commit('tailscale');
		system('/bin/rm -rf /tmp/run/rpcd/uci-*/tailscale* /tmp/.uci/tailscale* 2>/dev/null');

		let auth_key = trim(form_data.authKey || form_data.auth_key || '');
		let login_server = trim(form_data.login_server || form_data.loginserver || '');
		let hostname = trim(form_data.hostname || '');

		if (form_data.enabled != null) {
			if (form_data.enabled == '1') {
				exec('/etc/init.d/tailscale enable; /etc/init.d/tailscale restart');
				sleep(1500);
			} else {
				exec('/etc/init.d/tailscale disable; /etc/init.d/tailscale stop');
				return { success: true };
			}
		}

		let args = ['set'];
		if (form_data.accept_routes != null) {
			push(args, '--accept-routes=' + (form_data.accept_routes == '1'));
		}
		if (form_data.advertise_exit_node != null) {
			push(args, '--advertise-exit-node=' + (form_data.advertise_exit_node == '1'));
		}
		if (form_data.exit_node_allow_lan_access != null) {
			push(args, '--exit-node-allow-lan-access=' + (form_data.exit_node_allow_lan_access == '1'));
		}
		if (form_data.ssh != null) {
			push(args, '--ssh=' + (form_data.ssh == '1'));
		}
		if (form_data.accept_dns != null) {
			push(args, '--accept-dns=' + (form_data.accept_dns == '1'));
		}
		if (form_data.shields_up != null) {
			push(args, '--shields-up=' + (form_data.shields_up == '1'));
		}
		if (form_data.disable_snat_subnet_routes != null) {
			push(args, '--snat-subnet-routes=' + (form_data.disable_snat_subnet_routes != '1'));
		}
		if (form_data.advertise_routes != null) {
			let r_str = type(form_data.advertise_routes) == 'array' ? join(',', form_data.advertise_routes) : ('' + form_data.advertise_routes);
			push(args, '--advertise-routes=' + shell_quote(r_str));
		}
		if (form_data.exit_node != null) {
			push(args, '--exit-node=' + shell_quote(form_data.exit_node));
		}
		if (hostname != '') {
			push(args, '--hostname=' + shell_quote(hostname));
		}

		let cmd = '/usr/sbin/tailscale ' + join(' ', args);
		let set_res = exec(cmd);

		if (auth_key != '') {
			let up_args = ['up', '--auth-key=' + shell_quote(auth_key), '--reset'];
			if (login_server != '') {
				push(up_args, '--login-server=' + shell_quote(login_server));
			}
			if (hostname != '') {
				push(up_args, '--hostname=' + shell_quote(hostname));
			}
			if (form_data.accept_routes != null) {
				push(up_args, '--accept-routes=' + (form_data.accept_routes == '1'));
			}
			if (form_data.advertise_exit_node != null) {
				push(up_args, '--advertise-exit-node=' + (form_data.advertise_exit_node == '1'));
			}
			if (form_data.exit_node_allow_lan_access != null) {
				push(up_args, '--exit-node-allow-lan-access=' + (form_data.exit_node_allow_lan_access == '1'));
			}
			if (form_data.ssh != null) {
				push(up_args, '--ssh=' + (form_data.ssh == '1'));
			}
			if (form_data.accept_dns != null) {
				push(up_args, '--accept-dns=' + (form_data.accept_dns == '1'));
			}
			if (form_data.shields_up != null) {
				push(up_args, '--shields-up=' + (form_data.shields_up == '1'));
			}
			if (form_data.disable_snat_subnet_routes != null) {
				push(up_args, '--snat-subnet-routes=' + (form_data.disable_snat_subnet_routes != '1'));
			}
			if (form_data.advertise_routes != null) {
				let r_str = type(form_data.advertise_routes) == 'array' ? join(',', form_data.advertise_routes) : ('' + form_data.advertise_routes);
				if (r_str != '') {
					push(up_args, '--advertise-routes=' + shell_quote(r_str));
				}
			}
			let up_cmd = '/usr/sbin/tailscale ' + join(' ', up_args);
			exec(up_cmd);
		}

		return { success: true, cmd_code: set_res.code };
	}
};

methods.do_login = {
	args: {
		form_data: {},
		login_server: '',
		auth_key: '',
		hostname: '',
		loginserver: '',
		loginserver_authkey: '',
		authKey: ''
	},
	call: function(request) {
		let form_data = request.args.form_data || request.args || {};
		if (form_data.form_data != null) {
			form_data = form_data.form_data;
		}
		let loginargs = ['login'];

		const loginserver = trim(form_data.loginserver || form_data.login_server || '');
		const authkey = trim(form_data.loginserver_authkey || form_data.auth_key || form_data.authKey || form_data.authkey || '');
		const hostname = trim(form_data.hostname || '');

		try {
			let u = uci.cursor();
			u.load('tailscale');
			let sec = get_tailscale_sec(u);
			if (sec == null) {
				sec = 'settings';
				u.set('tailscale', sec, 'settings');
			}
			if (loginserver != '') {
				u.set('tailscale', sec, 'login_server', loginserver);
				u.set('tailscale', sec, 'loginserver', loginserver);
			}
			if (authkey != '') {
				u.set('tailscale', sec, 'auth_key', authkey);
				u.set('tailscale', sec, 'authKey', authkey);
			}
			if (hostname != '') {
				u.set('tailscale', sec, 'hostname', hostname);
			}
			u.save('tailscale');
			u.commit('tailscale');
		} catch (e) { /* ignore */ }

		if (authkey != '') {
			system('/usr/bin/killall -9 tailscale 2>/dev/null');
			exec('/etc/init.d/tailscale restart');
			sleep(1500);
			let up_args = ['up', '--auth-key=' + shell_quote(authkey), '--reset'];
			if (loginserver != '') {
				push(up_args, '--login-server=' + shell_quote(loginserver));
			}
			if (hostname != '') {
				push(up_args, '--hostname=' + shell_quote(hostname));
			}
			let up_cmd = '/usr/sbin/tailscale ' + join(' ', up_args);
			let res = exec(up_cmd);
			if (res.code == 0) {
				return { success: true, message: '节点已成功使用预授权密钥加入网络。' };
			} else {
				let err_msg = join(' ', res.stderr || res.stdout || []);
				return { error: '加入网络失败: ' + err_msg };
			}
		}

		if (loginserver != '') {
			push(loginargs, '--login-server=' + shell_quote(loginserver));
		}
		if (hostname != '') {
			push(loginargs, '--hostname=' + shell_quote(hostname));
		}

		let login_cmd = '/usr/sbin/tailscale ' + join(' ', loginargs);
		popen('/bin/sh -c ' + shell_quote(login_cmd + ' >/dev/null 2>&1 &'), 'r');

		let max_attempts = 15;
		let interval = 2000;

		for (let i = 0; i < max_attempts; i++) {
			let tresult = exec('/usr/sbin/tailscale status --json');
			if (tresult.code == 0 && length(tresult.stdout) > 0) {
				let s = json(join('', tresult.stdout));
				if (s?.AuthURL && s.AuthURL != '') {
					return { url: s.AuthURL };
				}
				if (s?.BackendState == 'Running') {
					return { success: true, message: '节点已成功加入网络。' };
				}
			}
			sleep(interval);
		}

		return { error: '未能在30秒内获取到授权链接，请检查服务器连接或使用预授权密钥加入。' };
	}
};

methods.do_logout = {
	call: function() {
		let logout_res = exec('/usr/sbin/tailscale logout');
		return { success: logout_res.code == 0, stderr: join('', logout_res.stdout) };
	}
};

methods.get_subroutes = {
	call: function() {
		let subnets = [];
		let seen = {};
		try {
			let u = uci.cursor();
			u.load('firewall');
			let fw = u.get_all('firewall');
			let lan_nets = {};
			for (let k in fw) {
				let s = fw[k];
				if (s['.type'] == 'zone' && s.name == 'lan') {
					let nets = s.network;
					if (type(nets) == 'array') {
						for (let n in nets) lan_nets[n] = true;
					} else if (type(nets) == 'string') {
						lan_nets[nets] = true;
					}
				}
			}
			if (length(keys(lan_nets)) == 0) {
				lan_nets['lan'] = true;
			}

			function calc_subnet(ip, mask) {
				let parts = split(ip, '.');
				if (length(parts) != 4) return null;
				let o1 = +parts[0], o2 = +parts[1], o3 = +parts[2], o4 = +parts[3];
				let m = +mask;
				if (m < 0 || m > 32) return null;
				let n1 = o1, n2 = o2, n3 = o3, n4 = o4;
				if (m >= 24) {
					let m4 = 256 - (1 << (32 - m));
					n4 = o4 & m4;
				} else if (m >= 16) {
					let m3 = 256 - (1 << (24 - m));
					n3 = o3 & m3;
					n4 = 0;
				} else if (m >= 8) {
					let m2 = 256 - (1 << (16 - m));
					n2 = o2 & m2;
					n3 = 0; n4 = 0;
				} else if (m > 0) {
					let m1 = 256 - (1 << (8 - m));
					n1 = o1 & m1;
					n2 = 0; n3 = 0; n4 = 0;
				}
				return n1 + '.' + n2 + '.' + n3 + '.' + n4 + '/' + m;
			}

			let conn = connect();
			let ifaces = conn ? conn.call('network.interface', 'dump', {}) : null;
			if (ifaces && ifaces.interface) {
				for (let iface in ifaces.interface) {
					let name = iface.interface;
					// Filter out loopback, tailscale, docker, WAN interfaces
					if (name == 'loopback' || name == 'tailscale' || name == 'docker' || index(name, 'wan') == 0) {
						continue;
					}
					if (iface.device == 'docker0' || iface.device == 'tailscale0' || iface.device == 'lo') {
						continue;
					}
					if (lan_nets[name] || name == 'lan' || index(name, 'lan') == 0 || index(name, 'guest') == 0) {
						let addrs = iface['ipv4-address'];
						if (addrs) {
							for (let addr in addrs) {
								if (addr.address && addr.mask) {
									let cidr = calc_subnet(addr.address, addr.mask);
									if (cidr && !seen[cidr]) {
										seen[cidr] = true;
										push(subnets, cidr);
									}
								}
							}
						}
					}
				}
			}
		} catch (e) { /* ignore */ }
		return { routes: subnets };
	}
};

methods.setup_firewall = {
	call: function() {
		try {
			let u = uci.cursor();
			u.load('network');
			u.load('firewall');

			let changed_network = false;
			let changed_firewall = false;

			// 1. config Network Interface
			let net_ts = u.get('network', 'tailscale');
			if (net_ts == null) {
				u.set('network', 'tailscale', 'interface');
				u.set('network', 'tailscale', 'proto', 'none');
				u.set('network', 'tailscale', 'device', 'tailscale0');
				changed_network = true;
			} else {
				let current_dev = u.get('network', 'tailscale', 'device');
				if (current_dev != 'tailscale0') {
					u.set('network', 'tailscale', 'device', 'tailscale0');
					changed_network = true;
				}
			}

			// 2. config Firewall Zone
			let fw_all = u.get_all('firewall');
			let ts_zone_section = null;
			let fwd_lan_to_ts = false;
			let fwd_ts_to_lan = false;

			for (let sec_key in fw_all) {
				let s = fw_all[sec_key];
				if (s['.type'] == 'zone' && s['name'] == 'tailscale') {
					ts_zone_section = sec_key;
				}
				if (s['.type'] == 'forwarding') {
					if (s.src == 'lan' && s.dest == 'tailscale') fwd_lan_to_ts = true;
					if (s.src == 'tailscale' && s.dest == 'lan') fwd_ts_to_lan = true;
				}
			}

			if (ts_zone_section == null) {
				let zid = u.add('firewall', 'zone');
				u.set('firewall', zid, 'name', 'tailscale');
				u.set('firewall', zid, 'input', 'ACCEPT');
				u.set('firewall', zid, 'output', 'ACCEPT');
				u.set('firewall', zid, 'forward', 'ACCEPT');
				u.set('firewall', zid, 'masq', '1');
				u.set('firewall', zid, 'mtu_fix', '1');
				u.set('firewall', zid, 'network', ['tailscale']);
				changed_firewall = true;
			} else {
				let nets = u.get('firewall', ts_zone_section, 'network');
				let has_ts_net = false;

				if (type(nets) == 'array') {
					for (let i = 0; i < length(nets); i++) {
						if (nets[i] == 'tailscale') {
							has_ts_net = true;
							break;
						}
					}
				} else if (type(nets) == 'string' && nets == 'tailscale') {
					has_ts_net = true;
				}

				if (!has_ts_net) {
					let net_list = (type(nets) == 'array') ? nets : (nets ? [nets] : []);
					push(net_list, 'tailscale');
					u.set('firewall', ts_zone_section, 'network', net_list);
					changed_firewall = true;
				} else {
					u.set('firewall', ts_zone_section, 'network', ['tailscale']);
				}
			}

			// 3. config Forwarding
			if (!fwd_lan_to_ts) {
				let fid = u.add('firewall', 'forwarding');
				u.set('firewall', fid, 'src', 'lan');
				u.set('firewall', fid, 'dest', 'tailscale');
				changed_firewall = true;
			}

			if (!fwd_ts_to_lan) {
				let fid = u.add('firewall', 'forwarding');
				u.set('firewall', fid, 'src', 'tailscale');
				u.set('firewall', fid, 'dest', 'lan');
				changed_firewall = true;
			}

			// 4. save
			if (changed_network) {
				u.save('network');
				u.commit('network');
				exec('/etc/init.d/network reload');
			}

			if (changed_firewall) {
				u.save('firewall');
				u.commit('firewall');
				exec('/etc/init.d/firewall reload');
			}

			return {
				success: true,
				changed_network: changed_network,
				changed_firewall: changed_firewall,
				message: (changed_network || changed_firewall) ? 'Tailscale firewall/interface configuration applied.' : 'Tailscale firewall/interface already configured.'
			};
		} catch (e) {
			return { error: 'Exception in setup_firewall: ' + e };
		}
	}
};

methods.get_logs = {
	args: { lines: 100 },
	call: function(request) {
		let max_lines = 100;
		if (request?.args?.lines != null) {
			if (type(request.args.lines) == 'object' && request.args.lines.lines != null) {
				max_lines = int(request.args.lines.lines) || 100;
			} else {
				max_lines = int(request.args.lines) || 100;
			}
		}
		let log_res = exec("logread | grep -iE 'tailscale|tailscaled' | tail -n " + max_lines);
		return { logs: log_res.stdout };
	}
};

methods.cleanup_reset = {
	call: function() {
		let r = exec('/usr/sbin/tailscaled --cleanup; /etc/init.d/tailscale restart');
		return { success: r.code == 0 };
	}
};

return { 'tailscale': methods, 'outlierox': methods };
