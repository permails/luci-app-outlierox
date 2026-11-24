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
	let p = popen(cmd + ' 2>&1', 'r');
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

function exec_raw(cmd) {
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

function emit_event(event_name, level, message, data) {
	try {
		let lvl = (level == 'err' || level == 'warn') ? level : 'notice';
		let log_msg = '[' + event_name + '] ' + (message || '');
		system('/usr/bin/logger -t outlierox -p daemon.' + lvl + ' ' + shell_quote(log_msg));

		let payload = {
			event: event_name,
			level: lvl,
			message: message || ''
		};
		if (type(data) == 'object') {
			for (let k in data) {
				payload[k] = data[k];
			}
		}
		system('/bin/ubus send outlierox.event ' + shell_quote(sprintf('%J', payload)) + ' >/dev/null 2>&1');
	} catch (e) { /* ignore */ }
}

let sync_firewall;
let sync_magicdns;
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
			let tresult = exec_raw('/usr/sbin/tailscale status --json');
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

		if (result.status == 'running') {
			try {
				let u = uci.cursor();
				u.load('tailscale');
				let sec = get_tailscale_sec(u);
				let ts = sec ? (u.get_all('tailscale', sec) || {}) : {};
				if (('' + (ts.accept_dns || '0')) == '1') {
					sync_magicdns(true, result.domain_name, result.peers, result.ipv4, result.hostname);
				}
			} catch (e) {}
		}

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
		let prev = {};
		if (sec == null) {
			sec = 'settings';
			u.set('tailscale', sec, 'settings');
		} else {
			prev = u.get_all('tailscale', sec) || {};
		}

		let prev_enabled = (prev.enabled != null) ? ('' + prev.enabled) : '1';
		let prev_port = '' + (prev.port || '41641');
		let prev_state_dir = '' + (prev.config_path || prev.state_dir || '/etc/tailscale');
		let prev_stdout = (prev.log_stdout != null) ? ('' + prev.log_stdout) : '1';
		let prev_stderr = (prev.log_stderr != null) ? ('' + prev.log_stderr) : '1';
		let prev_reduce_mem = '' + (prev.reduce_memory || '0');
		let prev_fw_mode = '' + (prev.fw_mode || 'nftables');
		let prev_ac_lan = (prev.ac_lan != null) ? ('' + prev.ac_lan) : '1';
		let prev_lan_ts = (prev.lan_ts != null) ? ('' + prev.lan_ts) : '1';
		let prev_ac_wan = (prev.ac_wan != null) ? ('' + prev.ac_wan) : '0';
		let prev_allow_wan_udp = (prev.allow_wan_udp != null) ? ('' + prev.allow_wan_udp) : '1';
		let prev_auth_key = trim(prev.authKey || prev.auth_key || prev.authkey || '');
		let prev_login_srv = trim(prev.login_server || prev.loginserver || '');

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

		let new_enabled = (form_data.enabled != null) ? ('' + form_data.enabled) : prev_enabled;
		let new_port = '' + (form_data.port || prev_port);
		let new_state_dir = '' + (form_data.config_path || form_data.state_dir || prev_state_dir);
		let new_stdout = (form_data.log_stdout != null) ? ('' + form_data.log_stdout) : prev_stdout;
		let new_stderr = (form_data.log_stderr != null) ? ('' + form_data.log_stderr) : prev_stderr;
		let new_reduce_mem = (form_data.reduce_memory != null) ? ('' + form_data.reduce_memory) : prev_reduce_mem;
		let new_fw_mode = (form_data.fw_mode != null) ? ('' + form_data.fw_mode) : prev_fw_mode;
		let new_ac_lan = (form_data.ac_lan != null) ? ('' + form_data.ac_lan) : prev_ac_lan;
		let new_lan_ts = (form_data.lan_ts != null) ? ('' + form_data.lan_ts) : prev_lan_ts;
		let new_ac_wan = (form_data.ac_wan != null) ? ('' + form_data.ac_wan) : prev_ac_wan;
		let new_allow_wan_udp = (form_data.allow_wan_udp != null) ? ('' + form_data.allow_wan_udp) : prev_allow_wan_udp;

		let auth_key = trim(form_data.authKey || form_data.auth_key || '');
		let login_server = trim(form_data.login_server || form_data.loginserver || '');
		let hostname = trim(form_data.hostname || '');
		let extra_flags = trim(form_data.flags || '');

		if (new_enabled == '0') {
			exec('/etc/init.d/tailscale disable; /etc/init.d/tailscale stop');
			sync_magicdns(false, '');
			sync_firewall({
				ac_lan: new_ac_lan,
				lan_ts: new_lan_ts,
				ac_wan: new_ac_wan,
				allow_wan_udp: '0',
				port: new_port
			});
			emit_event('service_stopped', 'notice', 'service disabled and stopped', { enabled: '0' });
			return { success: true };
		}

		let fw_changed = (prev_enabled != new_enabled) ||
			(prev_port != new_port) ||
			(prev_ac_lan != new_ac_lan) ||
			(prev_lan_ts != new_lan_ts) ||
			(prev_ac_wan != new_ac_wan) ||
			(prev_allow_wan_udp != new_allow_wan_udp);
		if (fw_changed) {
			sync_firewall({
				ac_lan: new_ac_lan,
				lan_ts: new_lan_ts,
				ac_wan: new_ac_wan,
				allow_wan_udp: new_allow_wan_udp,
				port: new_port
			});
		}

		let daemon_running = (exec_raw('pgrep tailscaled').code == 0);
		let need_restart = (!daemon_running) ||
			(prev_enabled != new_enabled) ||
			(prev_port != new_port) ||
			(prev_state_dir != new_state_dir) ||
			(prev_stdout != new_stdout) ||
			(prev_stderr != new_stderr) ||
			(prev_reduce_mem != new_reduce_mem) ||
			(prev_fw_mode != new_fw_mode);

		if (need_restart) {
			exec('/etc/init.d/tailscale enable; /etc/init.d/tailscale restart');
			for (let w = 0; w < 8; w++) {
				sleep(400);
				if (exec_raw('/usr/sbin/tailscale status --json').code == 0) {
					break;
				}
			}
		}

		let cur_state = '';
		let st_res = exec_raw('/usr/sbin/tailscale status --json');
		if (st_res.code == 0 && length(st_res.stdout) > 0) {
			try {
				let sj = json(join('', st_res.stdout));
				cur_state = sj?.BackendState || '';
			} catch (e) {}
		}

		let args = ['set'];
		if (form_data.accept_routes != null) {
			push(args, '--accept-routes=' + (form_data.accept_routes == '1'));
		}
		if (form_data.advertise_exit_node != null) {
			push(args, '--advertise-exit-node=' + (form_data.advertise_exit_node == '1'));
		}
		let exit_node_val = trim('' + (form_data.exit_node || ''));
		if (form_data.exit_node_allow_lan_access != null && exit_node_val != '') {
			push(args, '--exit-node-allow-lan-access=' + (form_data.exit_node_allow_lan_access == '1'));
		}
		if (form_data.ssh != null) {
			push(args, '--ssh=' + (form_data.ssh == '1'));
		}
		if (form_data.accept_dns != null) {
			push(args, '--accept-dns=false');
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

		let need_up = (auth_key != '') && (
			(auth_key != prev_auth_key) ||
			(login_server != prev_login_srv) ||
			(cur_state == 'NeedsLogin' || cur_state == 'NoState' || cur_state == 'Stopped' || cur_state == '')
		);

		if (need_up || (extra_flags != '' && cur_state == 'Running')) {
			let up_args = ['up'];
			if (need_up) {
				push(up_args, '--auth-key=' + shell_quote(auth_key));
				push(up_args, '--reset');
			}
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
			if (form_data.exit_node_allow_lan_access != null && exit_node_val != '') {
				push(up_args, '--exit-node-allow-lan-access=' + (form_data.exit_node_allow_lan_access == '1'));
			}
			if (form_data.ssh != null) {
				push(up_args, '--ssh=' + (form_data.ssh == '1'));
			}
			if (form_data.accept_dns != null) {
				push(up_args, '--accept-dns=false');
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
			if (extra_flags != '') {
				let flag_parts = split(replace(extra_flags, /\s+/g, ' '), ' ');
				for (let fp in flag_parts) {
					if (fp != '') push(up_args, shell_quote(fp));
				}
			}
			let up_cmd = '/usr/sbin/tailscale ' + join(' ', up_args);
			let up_res = exec(up_cmd);
			if (up_res.code != 0) {
				let uerr = join(' ', up_res.stdout || []) || 'tailscale up failed';
				emit_event('action_error', 'err', uerr, { action: 'set_settings' });
				return { error: uerr };
			}
		}

		let mtu = int(form_data.daemon_mtu || prev.daemon_mtu || 0);
		if (mtu >= 576 && mtu <= 9000) {
			exec('ip link set dev tailscale0 mtu ' + mtu);
		}

		if (set_res.code != 0 && !need_up) {
			let serr = join(' ', set_res.stdout || []) || 'tailscale set failed';
			emit_event('action_error', 'err', serr, { action: 'set_settings' });
			return { error: serr, cmd_code: set_res.code };
		}

		let magic_domain = '';
		let st_peers = {};
		let self_ip = '';
		let self_host = '';
		let st_after = exec_raw('/usr/sbin/tailscale status --json');
		if (st_after.code == 0 && length(st_after.stdout) > 0) {
			try {
				let sj2 = json(join('', st_after.stdout));
				magic_domain = trim(sj2?.MagicDNSSuffix || '');
				self_host = sj2?.Self?.HostName || '';
				if (sj2?.Self?.TailscaleIPs && length(sj2.Self.TailscaleIPs) > 0) {
					self_ip = sj2.Self.TailscaleIPs[0];
				}
				if (sj2?.Peer) {
					for (let pid in sj2.Peer) {
						let pr = sj2.Peer[pid];
						if (pr?.HostName && pr?.TailscaleIPs && length(pr.TailscaleIPs) > 0) {
							st_peers[pid] = { hostname: pr.HostName, ipv4: pr.TailscaleIPs[0] };
						}
					}
				}
			} catch (e) {}
		}
		let want_dns = ((form_data.accept_dns != null ? ('' + form_data.accept_dns) : ('' + (prev.accept_dns || '0'))) == '1');
		sync_magicdns(want_dns, magic_domain, st_peers, self_ip, self_host);

		if (prev_enabled != new_enabled && new_enabled == '1') {
			emit_event('service_enabled', 'notice', 'service enabled on port ' + new_port, { enabled: '1', port: new_port });
		}
		emit_event('settings_applied', 'notice', 'settings applied (restarted=' + need_restart + ', mtu=' + mtu + ')', { restarted: need_restart, mtu: mtu });

		return { success: true, cmd_code: set_res.code, restarted: need_restart };
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
				emit_event('node_online', 'notice', 'node joined tailnet via auth key', { method: 'authkey', login_server: loginserver });
				return { success: true, message: 'Node joined the network using pre-auth key.' };
			} else {
				let err_msg = join(' ', res.stderr || res.stdout || []);
				emit_event('action_error', 'err', err_msg, { action: 'do_login' });
				return { error: 'Failed to join network: ' + err_msg };
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
			let tresult = exec_raw('/usr/sbin/tailscale status --json');
			if (tresult.code == 0 && length(tresult.stdout) > 0) {
				let s = json(join('', tresult.stdout));
				if (s?.AuthURL && s.AuthURL != '') {
					return { url: s.AuthURL };
				}
				if (s?.BackendState == 'Running') {
					return { success: true, message: 'Node joined the network.' };
				}
			}
			sleep(interval);
		}

		return { error: 'Timed out waiting for auth URL after 30s. Please check server connectivity or use a pre-auth key.' };
	}
};

methods.do_logout = {
	call: function() {
		let logout_res = exec('/usr/sbin/tailscale logout');
		emit_event('node_logout', 'notice', 'node logged out and unbound', { success: logout_res.code == 0 });
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

sync_magicdns = function(enable, domain, peers_map, self_ip, self_host) {
	try {
		// Fallback: restore /etc/resolv.conf if it still has a stale tailscale overwrite
		let r_res = exec_raw('grep -q "tailscale.com/s/resolvconf-overwrite" /etc/resolv.conf 2>/dev/null');
		if (r_res.code == 0) {
			exec('printf "search lan\\nnameserver 127.0.0.1\\nnameserver ::1\\n" > /etc/resolv.conf');
		}

		let conf_dir = '/tmp/dnsmasq.d';
		let cd_res = exec_raw("grep -h '^conf-dir=' /var/etc/dnsmasq.conf* 2>/dev/null | head -n 1");
		if (cd_res.code == 0 && length(cd_res.stdout) > 0) {
			let d = trim(replace(cd_res.stdout[0], /^conf-dir=/, ''));
			d = split(d, ',')[0];
			if (d != '') conf_dir = d;
		}

		let conf_path = conf_dir + '/outlierox.conf';
		let hosts_path = '/tmp/hosts/outlierox';
		let desired = '';
		let desired_hosts = '';

		if (enable) {
			let lines = [
				'server=/ts.net/100.100.100.100',
				'rebind-domain-ok=/ts.net/'
			];
			if (domain && domain != '' && domain != 'ts.net') {
				push(lines, 'server=/' + domain + '/100.100.100.100');
				push(lines, 'rebind-domain-ok=/' + domain + '/');
			}
			desired = join('\n', lines) + '\n';

			let hlines = [];
			if (self_ip && self_host) {
				let sh = replace(trim(self_host), /[^A-Za-z0-9._-]/g, '');
				if (sh != '') push(hlines, self_ip + ' ' + sh);
			}
			if (peers_map) {
				for (let k in peers_map) {
					let p = peers_map[k];
					if (p?.ipv4 && p?.hostname) {
						let ph = replace(trim(p.hostname), /[^A-Za-z0-9._-]/g, '');
						if (ph != '') push(hlines, p.ipv4 + ' ' + ph);
					}
				}
			}
			if (length(hlines) > 0) {
				sort(hlines);
				desired_hosts = join('\n', hlines) + '\n';
			}
		}

		let current = '';
		let f = open(conf_path, 'r');
		if (f) {
			current = f.read('all') || '';
			f.close();
		}

		let current_hosts = '';
		let hf = open(hosts_path, 'r');
		if (hf) {
			current_hosts = hf.read('all') || '';
			hf.close();
		}

		if (enable) {
			let need_restart = false;
			if (current != desired) {
				exec('mkdir -p ' + shell_quote(conf_dir));
				let wf = open(conf_path, 'w');
				if (wf) {
					wf.write(desired);
					wf.close();
					exec('chmod 644 ' + shell_quote(conf_path));
					need_restart = true;
				}
			}
			let hosts_changed = false;
			if (desired_hosts != '' && current_hosts != desired_hosts) {
				exec('mkdir -p /tmp/hosts');
				let hwf = open(hosts_path, 'w');
				if (hwf) {
					hwf.write(desired_hosts);
					hwf.close();
					exec('chmod 644 ' + shell_quote(hosts_path));
					hosts_changed = true;
				}
			} else if (desired_hosts == '' && current_hosts != '') {
				exec('rm -f ' + hosts_path);
				hosts_changed = true;
			}
			if (need_restart) {
				exec('/etc/init.d/dnsmasq restart');
				emit_event('magicdns_synced', 'notice', 'magicdns enabled for ' + (domain || 'ts.net'), { enabled: true, domain: domain || '' });
			} else if (hosts_changed) {
				exec('killall -HUP dnsmasq 2>/dev/null');
			}
		} else {
			let rm_res = exec_raw('ls /tmp/dnsmasq*.d/outlierox.conf 2>/dev/null');
			if (rm_res.code == 0 && length(rm_res.stdout) > 0) {
				exec('rm -f /tmp/dnsmasq*.d/outlierox.conf /tmp/hosts/outlierox; /etc/init.d/dnsmasq restart');
				emit_event('magicdns_synced', 'notice', 'magicdns disabled and cleaned', { enabled: false, domain: '' });
			} else if (hf != null || current_hosts != '') {
				exec('rm -f /tmp/hosts/outlierox; killall -HUP dnsmasq 2>/dev/null');
			}
		}
	} catch (e) { /* ignore */ }
};

sync_firewall = function(opts) {
	try {
		let u = uci.cursor();
		u.load('tailscale');
		let ts_sec = get_tailscale_sec(u);
		let ts = ts_sec ? (u.get_all('tailscale', ts_sec) || {}) : {};

		let ac_lan = ((opts && opts.ac_lan != null) ? ('' + opts.ac_lan) : ((ts.ac_lan != null) ? ('' + ts.ac_lan) : '1')) != '0';
		let lan_ts = ((opts && opts.lan_ts != null) ? ('' + opts.lan_ts) : ((ts.lan_ts != null) ? ('' + ts.lan_ts) : '1')) != '0';
		let ac_wan = ((opts && opts.ac_wan != null) ? ('' + opts.ac_wan) : ((ts.ac_wan != null) ? ('' + ts.ac_wan) : '0')) == '1';
		let allow_wan_udp = ((opts && opts.allow_wan_udp != null) ? ('' + opts.allow_wan_udp) : ((ts.allow_wan_udp != null) ? ('' + ts.allow_wan_udp) : '1')) != '0';
		let port = '' + ((opts && opts.port) || ts.port || '41641');

		u.load('network');
		u.load('firewall');

		let changed_network = false;
		let changed_firewall = false;

		// 1. Network Interface
		let net_ts = u.get('network', 'tailscale');
		if (net_ts == null) {
			u.set('network', 'tailscale', 'interface');
			u.set('network', 'tailscale', 'proto', 'none');
			u.set('network', 'tailscale', 'device', 'tailscale0');
			changed_network = true;
		} else {
			if (u.get('network', 'tailscale', 'proto') != 'none') {
				u.set('network', 'tailscale', 'proto', 'none');
				changed_network = true;
			}
			if (u.get('network', 'tailscale', 'device') != 'tailscale0') {
				u.set('network', 'tailscale', 'device', 'tailscale0');
				changed_network = true;
			}
		}

		// 2. Firewall Zone & Existing Forwardings/Rules
		let fw_all = u.get_all('firewall');
		let ts_zone_section = null;
		let fwd_lan_to_ts_sec = null;
		let fwd_ts_to_lan_sec = null;
		let fwd_ts_to_wan_sec = null;
		let wan_rule_sec = null;

		for (let sec_key in fw_all) {
			let s = fw_all[sec_key];
			if (s['.type'] == 'zone' && s['name'] == 'tailscale') {
				ts_zone_section = sec_key;
			}
			if (s['.type'] == 'forwarding') {
				if (s.src == 'lan' && s.dest == 'tailscale') fwd_lan_to_ts_sec = sec_key;
				if (s.src == 'tailscale' && s.dest == 'lan') fwd_ts_to_lan_sec = sec_key;
				if (s.src == 'tailscale' && s.dest == 'wan') fwd_ts_to_wan_sec = sec_key;
			}
			if (s['.type'] == 'rule' && s['name'] == 'Allow-Tailscale') {
				wan_rule_sec = sec_key;
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
					if (nets[i] == 'tailscale') { has_ts_net = true; break; }
				}
			} else if (type(nets) == 'string' && nets == 'tailscale') {
				has_ts_net = true;
			}
			if (!has_ts_net) {
				let net_list = (type(nets) == 'array') ? nets : (nets ? [nets] : []);
				push(net_list, 'tailscale');
				u.set('firewall', ts_zone_section, 'network', net_list);
				changed_firewall = true;
			}
		}

		// 3. Dynamic Forwardings (lan <-> tailscale, tailscale -> wan)
		if (lan_ts && fwd_lan_to_ts_sec == null) {
			let fid = u.add('firewall', 'forwarding');
			u.set('firewall', fid, 'src', 'lan');
			u.set('firewall', fid, 'dest', 'tailscale');
			changed_firewall = true;
		} else if (!lan_ts && fwd_lan_to_ts_sec != null) {
			u.delete('firewall', fwd_lan_to_ts_sec);
			changed_firewall = true;
		}

		if (ac_lan && fwd_ts_to_lan_sec == null) {
			let fid = u.add('firewall', 'forwarding');
			u.set('firewall', fid, 'src', 'tailscale');
			u.set('firewall', fid, 'dest', 'lan');
			changed_firewall = true;
		} else if (!ac_lan && fwd_ts_to_lan_sec != null) {
			u.delete('firewall', fwd_ts_to_lan_sec);
			changed_firewall = true;
		}

		if (ac_wan && fwd_ts_to_wan_sec == null) {
			let fid = u.add('firewall', 'forwarding');
			u.set('firewall', fid, 'src', 'tailscale');
			u.set('firewall', fid, 'dest', 'wan');
			changed_firewall = true;
		} else if (!ac_wan && fwd_ts_to_wan_sec != null) {
			u.delete('firewall', fwd_ts_to_wan_sec);
			changed_firewall = true;
		}

		// 4. WAN UDP Direct Punching Rule (Allow-Tailscale)
		if (allow_wan_udp) {
			if (wan_rule_sec == null) {
				let rid = u.add('firewall', 'rule');
				u.set('firewall', rid, 'name', 'Allow-Tailscale');
				u.set('firewall', rid, 'src', 'wan');
				u.set('firewall', rid, 'proto', 'udp');
				u.set('firewall', rid, 'dest_port', port);
				u.set('firewall', rid, 'target', 'ACCEPT');
				u.set('firewall', rid, 'enabled', '1');
				changed_firewall = true;
			} else {
				let r_port = '' + (u.get('firewall', wan_rule_sec, 'dest_port') || '');
				let r_en = '' + (u.get('firewall', wan_rule_sec, 'enabled') || '1');
				if (r_port != port || r_en != '1') {
					u.set('firewall', wan_rule_sec, 'src', 'wan');
					u.set('firewall', wan_rule_sec, 'proto', 'udp');
					u.set('firewall', wan_rule_sec, 'dest_port', port);
					u.set('firewall', wan_rule_sec, 'target', 'ACCEPT');
					u.set('firewall', wan_rule_sec, 'enabled', '1');
					changed_firewall = true;
				}
			}
		} else if (wan_rule_sec != null) {
			u.delete('firewall', wan_rule_sec);
			changed_firewall = true;
		}

		// 5. Commit & Reload only if changed
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
		if (changed_network || changed_firewall) {
			emit_event('firewall_synced', 'notice', sprintf('firewall synced (ac_lan=%d, lan_ts=%d, ac_wan=%d, wan_udp=%d, port=%s)', ac_lan ? 1 : 0, lan_ts ? 1 : 0, ac_wan ? 1 : 0, allow_wan_udp ? 1 : 0, port), {
				ac_lan: ac_lan,
				lan_ts: lan_ts,
				ac_wan: ac_wan,
				allow_wan_udp: allow_wan_udp,
				port: port
			});
		}

		return {
			success: true,
			changed_network: changed_network,
			changed_firewall: changed_firewall,
			message: (changed_network || changed_firewall) ? 'Tailscale firewall/interface configuration synchronized.' : 'Tailscale firewall/interface already up to date.'
		};
	} catch (e) {
		return { error: 'Exception in setup_firewall: ' + e };
	}
};

methods.setup_firewall = {
	call: function() {
		return sync_firewall(null);
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
		if (max_lines < 1) max_lines = 1;
		if (max_lines > 2000) max_lines = 2000;
		let log_res = exec("logread | grep -iE 'tailscale|tailscaled|outlierox' | tail -n " + max_lines);
		return { logs: log_res.stdout };
	}
};

methods.cleanup_reset = {
	call: function() {
		let r = exec('/usr/sbin/tailscaled --cleanup; /etc/init.d/tailscale restart');
		emit_event('cleanup_reset', 'notice', 'runtime cache cleaned and daemon restarted', { success: r.code == 0 });
		return { success: r.code == 0 };
	}
};

return { 'luci.outlierox': methods };
