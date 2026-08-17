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
		push(out, line);
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

		return result;
	}
};

methods.get_settings = {
	call: function() {
		let settings = {};
		try {
			let u = uci.cursor();
			u.load('tailscale');
			let all = u.get_all('tailscale', 'settings');
			if (all != null) {
				settings = all;
			}
		} catch (e) { /* ignore */ }
		return settings;
	}
};

methods.set_settings = {
	args: { form_data: {} },
	call: function(request) {
		const form_data = request.args.form_data;
		if (form_data == null || length(form_data) == 0) {
			return { error: 'Missing or invalid form_data parameter.' };
		}

		let u = uci.cursor();
		u.load('tailscale');
		for (let key in form_data) {
			if (form_data[key] != null) {
				u.set('tailscale', 'settings', key, form_data[key]);
			}
		}
		u.save('tailscale');
		u.commit('tailscale');

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
		if (form_data.runwebclient != null) {
			push(args, '--webclient=' + (form_data.runwebclient == '1'));
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
		if (form_data.hostname != null && form_data.hostname != '') {
			push(args, '--hostname=' + shell_quote(form_data.hostname));
		}

		let cmd = '/usr/sbin/tailscale ' + join(' ', args);
		let set_res = exec(cmd);

		if (form_data.enabled != null) {
			if (form_data.enabled == '1') {
				exec('/etc/init.d/tailscale enable; /etc/init.d/tailscale restart');
			} else {
				exec('/etc/init.d/tailscale disable; /etc/init.d/tailscale stop');
			}
		}

		return { success: true, cmd_code: set_res.code };
	}
};

methods.do_login = {
	args: { form_data: {} },
	call: function(request) {
		const form_data = request.args.form_data || {};
		let loginargs = ['login'];

		const loginserver = trim(form_data.loginserver || form_data.login_server || '');
		const authkey = trim(form_data.loginserver_authkey || form_data.authKey || form_data.authkey || '');

		if (loginserver != '') {
			push(loginargs, '--login-server=' + shell_quote(loginserver));
		}
		if (authkey != '') {
			push(loginargs, '--auth-key=' + shell_quote(authkey));
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
					return { success: true, message: 'Already logged in.' };
				}
			}
			sleep(interval);
		}

		return { error: 'Could not retrieve login URL from tailscale after 30 seconds.' };
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
		try {
			let result = exec('/sbin/ip -j route');
			if (result.code == 0 && length(result.stdout) > 0) {
				let routes_json = json(join('', result.stdout));
				for (let route in routes_json) {
					if (route?.dst && route.dst != 'default' && route?.scope == 'link' && index(route.dst, '.') != -1) {
						push(subnets, route.dst);
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
		let max_lines = request.args.lines || 100;
		let log_res = exec('logread -e tailscale -l ' + max_lines);
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
