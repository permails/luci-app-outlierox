'use strict';
'require dom';
'require poll';
'require request';
'require rpc';
'require uci';
'require ui';
'require view';

const callGetStatus = rpc.declare({
	object: 'luci.outlierox',
	method: 'get_status',
	expect: { '': {} }
});

const callGetSubroutes = rpc.declare({
	object: 'luci.outlierox',
	method: 'get_subroutes',
	expect: { '': {} }
});

const callGetSettings = rpc.declare({
	object: 'luci.outlierox',
	method: 'get_settings',
	expect: { '': {} }
});

const callSetSettings = rpc.declare({
	object: 'luci.outlierox',
	method: 'set_settings',
	params: ['form_data'],
	expect: { '': {} }
});

const callDoLogin = rpc.declare({
	object: 'luci.outlierox',
	method: 'do_login',
	params: ['form_data'],
	expect: { '': {} }
});

const callDoLogout = rpc.declare({
	object: 'luci.outlierox',
	method: 'do_logout',
	expect: { '': {} }
});

const callSetupFirewall = rpc.declare({
	object: 'luci.outlierox',
	method: 'setup_firewall',
	expect: { '': {} }
});

const callCleanupReset = rpc.declare({
	object: 'luci.outlierox',
	method: 'cleanup_reset',
	expect: { '': {} }
});

const callGetLogs = rpc.declare({
	object: 'luci.outlierox',
	method: 'get_logs',
	params: ['lines'],
	expect: { '': {} }
});

function getAdvRoutesStr(val) {
	if (!val) return '';
	if (Array.isArray(val)) return val.join(',');
	return '' + val;
}

function cleanRpcError(err) {
	const raw = (err && (err.message || err)) ? String(err.message || err) : _('Unknown error');
	return raw.replace(/\s*at\s+[^\n]+/g, '').replace(/handleCallReply@[^\s]+/g, '').trim() || _('Operation failed');
}

function copyToClipboard(text) {
	const str = String(text || '');
	if (!str) return Promise.resolve(false);
	if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
		return navigator.clipboard.writeText(str).then(function() {
			return true;
		}).catch(function() {
			return fallbackCopy(str);
		});
	}
	return Promise.resolve(fallbackCopy(str));
}

function fallbackCopy(str) {
	try {
		const ta = document.createElement('textarea');
		ta.value = str;
		ta.setAttribute('readonly', '');
		ta.style.position = 'fixed';
		ta.style.left = '-9999px';
		ta.style.top = '-9999px';
		document.body.appendChild(ta);
		ta.select();
		ta.setSelectionRange(0, str.length);
		const ok = document.execCommand('copy');
		document.body.removeChild(ta);
		return !!ok;
	} catch (e) {
		return false;
	}
}

function detectCredIssue(val) {
	if (!val) return null;
	const s = String(val).trim();
	if (/^export\s+/i.test(s)) return _('Contains shell "export" prefix.');
	if (/^[A-Za-z0-9_]+\s*=/.test(s)) return _('Contains "KEY=" assignment prefix.');
	if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
		return _('Contains surrounding quotes.');
	}
	return null;
}

function sanitizeCredValue(val) {
	let s = String(val || '').trim();
	s = s.replace(/^export\s+/i, '').trim();
	s = s.replace(/^[A-Za-z0-9_]+\s*=\s*/, '').trim();
	if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
		s = s.slice(1, -1).trim();
	}
	return s;
}

const STYLES = `
#maincontent .ox-view {
	max-width: 100%;
	margin-bottom: 16px;
}

#maincontent .ox-page-header {
	margin-bottom: 14px;
}

#maincontent .ox-page-header h2 {
	display: flex;
	align-items: center;
	flex-wrap: wrap;
	gap: 10px;
	margin: 0 0 4px 0;
}

#maincontent .ox-page-header .cbi-map-descr {
	margin: 0;
	color: var(--text-color-medium);
}

#ox_service_badge {
	font-size: 12px;
	padding: 3px 10px;
	line-height: 1.4;
}

/* Segmented Control Navigation */
#maincontent ul.ox-tabs {
	display: flex;
	flex-wrap: wrap;
	gap: 4px;
	padding: 4px;
	margin: 0 0 16px 0;
	list-style: none;
	border-radius: 8px;
	background: var(--background-color-medium);
	background: color-mix(in srgb, var(--background-color-low) 60%, var(--background-color-high));
	border: 1px solid var(--border-color-low);
	background-image: none;
	background-size: auto;
}

#maincontent ul.ox-tabs > li {
	height: auto !important;
	max-width: none;
	margin: 0 !important;
	border-radius: 6px;
	border: 1px solid transparent;
	background: transparent;
	background-image: none;
	color: var(--text-color-medium);
	transition: background 0.15s ease, color 0.15s ease;
}

#maincontent ul.ox-tabs > li > a {
	display: block;
	padding: 6px 14px;
	line-height: 1.4;
	font-size: 13.5px;
	font-weight: 500;
	border-radius: 6px;
	background: transparent;
	color: inherit;
	text-decoration: none;
	cursor: pointer;
	white-space: nowrap;
}

#maincontent ul.ox-tabs > li:not(.active):hover {
	background: var(--background-color-high);
	background-image: none;
	color: var(--primary-color-high);
}

#maincontent ul.ox-tabs > li.active {
	background: var(--background-color-high);
	background-image: none;
	border-color: var(--border-color-low);
	color: var(--primary-color-high);
	font-weight: 600;
	box-shadow: 0 1px 3px rgba(15, 23, 42, 0.08);
}

#maincontent .ox-tab-panel {
	display: none;
}

#maincontent .ox-tab-panel.active {
	display: block;
}

/* Outer Grey Panels (Section 3.2 & 8.2) */
#maincontent .ox-panel-shell {
	background: var(--background-color-medium);
	background: color-mix(in srgb, var(--background-color-low) 60%, var(--background-color-high));
	border: 1px solid var(--border-color-low);
	border-radius: 10px;
	padding: 16px 18px;
	margin: 0 0 16px 0;
}

/* Status Header Bar + Toolbar */
#maincontent .ox-header-bar {
	display: flex;
	align-items: center;
	justify-content: space-between;
	flex-wrap: wrap;
	gap: 10px;
	margin-bottom: 12px;
}

#maincontent .ox-header-bar h3 {
	margin: 0;
	font-size: 15px;
	font-weight: 600;
	color: var(--text-color-high);
}

#maincontent .ox-toolbar {
	display: flex;
	align-items: center;
	flex-wrap: wrap;
	gap: 8px;
}

#maincontent .ox-toolbar .cbi-button:disabled {
	opacity: 0.45;
	cursor: not-allowed;
}

/* 4-Column Summary Grid */
#maincontent .ox-summary-grid {
	display: grid;
	grid-template-columns: repeat(4, minmax(0, 1fr));
	gap: 12px;
}

#maincontent .ox-card {
	min-height: 90px;
	padding: 14px 16px;
	border-radius: 8px;
	border: 1px solid var(--border-color-medium);
	background: var(--background-color-high);
	box-shadow: 0 2px 6px rgba(15, 23, 42, 0.05);
	display: flex;
	flex-direction: column;
	justify-content: space-between;
	box-sizing: border-box;
}

#maincontent .ox-card-ok {
	background: rgba(var(--success-color-high-rgb, 16, 185, 129), 0.06);
	background: color-mix(in srgb, var(--success-color-high) 5%, var(--background-color-high));
	border-color: color-mix(in srgb, var(--success-color-high) 24%, var(--border-color-medium));
}

#maincontent .ox-card-info {
	background: rgba(var(--primary-color-high-rgb, 37, 99, 235), 0.06);
	background: color-mix(in srgb, var(--primary-color-high) 4.5%, var(--background-color-high));
	border-color: color-mix(in srgb, var(--primary-color-high) 22%, var(--border-color-medium));
}

#maincontent .ox-card-warn {
	background: rgba(var(--warn-color-high-rgb, 245, 158, 11), 0.08);
	background: color-mix(in srgb, var(--warn-color-high) 7%, var(--background-color-high));
	border-color: color-mix(in srgb, var(--warn-color-high) 28%, var(--border-color-medium));
}

#maincontent .ox-card-err {
	background: rgba(var(--error-color-high-rgb, 239, 68, 68), 0.07);
	background: color-mix(in srgb, var(--error-color-high) 5.5%, var(--background-color-high));
	border-color: color-mix(in srgb, var(--error-color-high) 24%, var(--border-color-medium));
}

#maincontent .ox-card-muted {
	background: color-mix(in srgb, var(--background-color-low) 35%, var(--background-color-high));
}

#maincontent .ox-card-head {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 8px;
}

#maincontent .ox-card-title {
	font-size: 12px;
	font-weight: 600;
	color: var(--text-color-medium);
}

#maincontent .ox-card-body {
	margin-top: 8px;
}

#maincontent .ox-card-main {
	font-size: 18px;
	font-weight: 600;
	line-height: 1.3;
	color: var(--text-color-high);
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

#maincontent .ox-card-main.ox-mono {
	font-family: var(--font-mono, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace);
}

#maincontent .ox-card-sub {
	margin-top: 4px;
	font-size: 12px;
	color: var(--text-color-medium);
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

/* Status Dot Pill */
#maincontent .ox-dot {
	display: inline-flex;
	align-items: center;
	gap: 6px;
	padding: 2px 9px;
	border-radius: 999px;
	font-size: 11.5px;
	font-weight: 600;
	white-space: nowrap;
	background: var(--background-color-medium);
	color: var(--text-color-medium);
}

#maincontent .ox-dot::before {
	content: '';
	width: 6px;
	height: 6px;
	border-radius: 50%;
	background: currentColor;
	flex-shrink: 0;
}

#maincontent .ox-dot-ok {
	color: var(--success-color-low);
	background: rgba(var(--success-color-high-rgb, 16, 185, 129), 0.12);
}

#maincontent .ox-dot-info {
	color: var(--primary-color-low);
	background: color-mix(in srgb, var(--primary-color-high) 12%, transparent);
}

#maincontent .ox-dot-warn {
	color: var(--text-color-high);
	background: color-mix(in srgb, var(--warn-color-high) 22%, transparent);
}

#maincontent .ox-dot-err {
	color: var(--error-color-low);
	background: rgba(var(--error-color-high-rgb, 239, 68, 68), 0.12);
}

#maincontent .ox-dot-muted {
	color: var(--text-color-medium);
	background: color-mix(in srgb, var(--background-color-low) 65%, transparent);
}

:root[data-darkmode="true"] #maincontent .ox-dot-ok { color: var(--success-color-high); }
:root[data-darkmode="true"] #maincontent .ox-dot-info { color: var(--primary-color-high); }
:root[data-darkmode="true"] #maincontent .ox-dot-warn { color: var(--warn-color-low); }
:root[data-darkmode="true"] #maincontent .ox-dot-err { color: var(--error-color-high); }

#maincontent .ox-mini-copy {
	padding: 2px 8px;
	font-size: 11px;
	line-height: 1.4;
	border-radius: 999px;
	min-height: 0 !important;
	border: 1px solid color-mix(in srgb, var(--primary-color-high) 30%, var(--border-color-medium));
	background: var(--background-color-high);
	color: var(--primary-color-low);
	cursor: pointer;
	font-weight: 600;
}

:root[data-darkmode="true"] #maincontent .ox-mini-copy {
	color: var(--primary-color-high);
}

#maincontent .ox-mini-copy:hover {
	background: color-mix(in srgb, var(--primary-color-high) 10%, var(--background-color-high));
}

/* Inline Semantic Note Banner */
@keyframes pb-shake {
	0%, 100% { transform: translateX(0); }
	20%, 60% { transform: translateX(-5px); }
	40%, 80% { transform: translateX(5px); }
}

#maincontent .ox-note {
	margin-top: 12px;
	padding: 10px 14px;
	border-radius: 6px;
	font-size: 12.5px;
	line-height: 1.45;
	color: var(--text-color-high);
	background: color-mix(in srgb, var(--warn-color-high) 10%, var(--background-color-high));
	border: 1px solid color-mix(in srgb, var(--warn-color-high) 28%, var(--border-color-low));
	transition: background-color 0.2s ease, border-color 0.2s ease, color 0.2s ease;
}

#maincontent .ox-note-info {
	background: color-mix(in srgb, var(--primary-color-high) 8%, var(--background-color-high));
	border-color: color-mix(in srgb, var(--primary-color-high) 26%, var(--border-color-low));
}

#maincontent .ox-note-ok {
	color: var(--success-color-low);
	background: rgba(var(--success-color-high-rgb, 16, 185, 129), 0.10);
	border-color: color-mix(in srgb, var(--success-color-high) 30%, var(--border-color-low));
}

#maincontent .ox-note-err {
	color: var(--error-color-high);
	background: rgba(var(--error-color-high-rgb, 239, 68, 68), 0.10);
	border-color: color-mix(in srgb, var(--error-color-high) 34%, var(--border-color-low));
}

:root[data-darkmode="true"] #maincontent .ox-note-ok { color: var(--success-color-high); }

#maincontent .ox-note-shake {
	animation: pb-shake 0.42s ease-in-out;
}

/* Detached Tab-Header Table (Section 4.3 & 8.1) */
#maincontent .ox-panel-head {
	display: inline-flex;
	min-width: 176px;
	height: 36px;
	box-sizing: border-box;
	align-items: center;
	justify-content: space-between;
	gap: 10px;
	margin: 0 0 8px 0 !important;
	padding: 0 14px;
	border: 1px solid color-mix(in srgb, var(--primary-color-high) 24%, var(--border-color-medium));
	border-radius: 8px;
	background: color-mix(in srgb, var(--primary-color-high) 7%, var(--background-color-high));
	font-size: 13.5px;
	font-weight: 600;
	color: var(--primary-color-low);
	box-shadow: 0 1px 3px rgba(15, 23, 42, 0.04);
}

:root[data-darkmode="true"] #maincontent .ox-panel-head {
	color: var(--primary-color-high);
}

#maincontent .ox-count-pill {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	padding: 1px 8px;
	border-radius: 999px;
	font-size: 11px;
	font-weight: 600;
	background: var(--background-color-high);
	color: var(--primary-color-low);
	border: 1px solid color-mix(in srgb, var(--primary-color-high) 20%, var(--border-color-low));
}

:root[data-darkmode="true"] #maincontent .ox-count-pill {
	color: var(--primary-color-high);
}

#maincontent .ox-panel-body {
	border-radius: 8px;
	border: 1px solid var(--border-color-medium);
	background: var(--background-color-high);
	overflow-x: auto;
	overflow-y: hidden;
	box-shadow: 0 2px 8px rgba(15, 23, 42, 0.06);
}

#maincontent .ox-panel-body > table.table {
	width: 100%;
	margin: 0;
	border: none;
	border-collapse: collapse;
}

#maincontent .ox-panel-body .tr.table-titles {
	background: color-mix(in srgb, var(--primary-color-high) 2.5%, var(--background-color-high));
	border-bottom: 1px solid color-mix(in srgb, var(--primary-color-high) 14%, var(--border-color-low));
}

#maincontent .ox-panel-body .th {
	font-size: 11.5px;
	font-weight: 600;
	letter-spacing: 0.02em;
	white-space: nowrap;
	color: var(--text-color-medium);
	padding: 10px 14px;
	box-sizing: border-box;
	background: transparent;
}

#maincontent .ox-panel-body .td {
	padding: 10px 14px;
	font-size: 13px;
	color: var(--text-color-high);
	border-top: 1px solid var(--border-color-low);
	vertical-align: middle;
	box-sizing: border-box;
}

#maincontent .ox-panel-body .tbody .tr:hover,
#maincontent .ox-panel-body tbody tr:hover {
	background: color-mix(in srgb, var(--primary-color-high) 3%, transparent);
}

#maincontent .ox-panel-body .tr.cbi-rowstyle-2 {
	background: transparent;
}

#maincontent .ox-panel-body .td.ox-nowrap {
	white-space: nowrap;
}

#maincontent .ox-panel-body .td.ox-mono {
	font-family: var(--font-mono, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace);
	font-size: 12px;
}

#maincontent .ox-panel-body .td.cbi-section-actions {
	width: 1%;
	white-space: nowrap;
	text-align: right;
}

#maincontent .ox-actions-wrap {
	display: inline-flex;
	flex-wrap: nowrap;
	gap: 6px;
	justify-content: flex-end;
}

#maincontent .ox-tags-wrap {
	display: flex;
	flex-wrap: wrap;
	gap: 6px;
}

#maincontent .ox-tag {
	display: inline-flex;
	align-items: center;
	padding: 2px 9px;
	border-radius: 999px;
	font-size: 11.5px;
	font-weight: 600;
	white-space: nowrap;
	border: 1px solid transparent;
}

#maincontent .ox-tag-info {
	color: var(--primary-color-low);
	background: color-mix(in srgb, var(--primary-color-high) 12%, transparent);
	border-color: color-mix(in srgb, var(--primary-color-high) 24%, transparent);
}

#maincontent .ox-tag-ok {
	color: var(--success-color-low);
	background: rgba(var(--success-color-high-rgb, 16, 185, 129), 0.12);
}

#maincontent .ox-tag-warn {
	color: var(--text-color-high);
	background: color-mix(in srgb, var(--warn-color-high) 22%, transparent);
}

#maincontent .ox-tag-muted {
	color: var(--text-color-medium);
	background: color-mix(in srgb, var(--background-color-low) 55%, transparent);
}

:root[data-darkmode="true"] #maincontent .ox-tag-info { color: var(--primary-color-high); }
:root[data-darkmode="true"] #maincontent .ox-tag-ok { color: var(--success-color-high); }
:root[data-darkmode="true"] #maincontent .ox-tag-warn { color: var(--warn-color-low); }

#maincontent .td.ox-muted {
	color: var(--text-color-medium);
	font-size: 12.5px;
	font-weight: 400;
}

/* Settings / Form Cards */
#maincontent .ox-form-grid {
	display: grid;
	grid-template-columns: repeat(2, minmax(0, 1fr));
	gap: 16px;
}

#maincontent .ox-form-card {
	border-radius: 8px;
	border: 1px solid var(--border-color-medium);
	background: var(--background-color-high);
	box-shadow: 0 2px 6px rgba(15, 23, 42, 0.05);
	overflow: hidden;
}

#maincontent .ox-form-card.ox-full {
	grid-column: 1 / -1;
}

#maincontent .ox-form-card-head {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 12px;
	padding: 12px 16px;
	background: color-mix(in srgb, var(--background-color-low) 40%, var(--background-color-high));
	border-bottom: 1px solid var(--border-color-low);
}

#maincontent .ox-form-card-title {
	font-size: 14px;
	font-weight: 600;
	color: var(--text-color-high);
	margin: 0;
}

#maincontent .ox-form-card-desc {
	font-size: 12px;
	color: var(--text-color-medium);
	margin-top: 2px;
}

#maincontent .ox-form-card-body {
	padding: 4px 16px 8px 16px;
}

#maincontent .ox-form-row {
	display: flex;
	align-items: flex-start;
	justify-content: space-between;
	flex-wrap: wrap;
	gap: 8px 16px;
	padding: 12px 0;
	border-bottom: 1px solid var(--border-color-low);
	transition: background-color 0.12s ease;
}

#maincontent .ox-form-row-note {
	flex: 1 1 100%;
	margin-top: 2px !important;
	padding: 8px 12px !important;
	font-size: 12px !important;
	line-height: 1.5 !important;
}

#maincontent .ox-form-row:last-child {
	border-bottom: none;
}

#maincontent .ox-form-row:hover {
	background: color-mix(in srgb, var(--primary-color-high) 1.5%, transparent);
}

#maincontent .ox-form-label-col {
	flex: 1 1 40%;
	min-width: 0;
}

#maincontent .ox-form-label {
	display: block;
	font-size: 13px;
	font-weight: 600;
	color: var(--text-color-high);
	margin-bottom: 2px;
}

#maincontent .ox-form-hint {
	font-size: 12px;
	color: var(--text-color-medium);
	line-height: 1.4;
}

#maincontent .ox-form-field-col {
	flex: 0 1 54%;
	max-width: 460px;
	display: flex;
	flex-direction: column;
	align-items: flex-end;
	gap: 6px;
}

#maincontent .ox-form-field-col:has(> input[type="checkbox"]:only-child) {
	flex: 0 0 auto;
}

#maincontent .ox-form-field-col input[type="text"],
#maincontent .ox-form-field-col input[type="password"],
#maincontent .ox-form-field-col input[type="number"],
#maincontent .ox-form-field-col select,
#maincontent .ox-form-field-col textarea {
	width: 100%;
	max-width: 460px;
	box-sizing: border-box;
	border-radius: 6px;
	border: 1px solid var(--border-color-medium);
	background: var(--background-color-high);
	color: var(--text-color-high);
	padding: 6px 10px;
	font-size: 13px;
	background-image: none !important;
	transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

#maincontent .ox-form-field-col input[type="text"],
#maincontent .ox-form-field-col input[type="password"],
#maincontent .ox-form-field-col input[type="number"],
#maincontent .ox-form-field-col select {
	min-height: 34px;
}

#maincontent .ox-form-field-col input:focus,
#maincontent .ox-form-field-col select:focus,
#maincontent .ox-form-field-col textarea:focus {
	outline: none;
	border-color: var(--primary-color-high);
	box-shadow: 0 0 0 3px color-mix(in srgb, var(--primary-color-high) 18%, transparent);
}

#maincontent .ox-form-field-col input[type="checkbox"] {
	width: 17px;
	height: 17px;
	margin: 2px 0;
	accent-color: var(--primary-color-high);
	cursor: pointer;
}

/* Credential Box with Embedded Show/Hide & Inline Warn */
#maincontent .ox-cred-wrap {
	width: 100%;
	max-width: 460px;
}

#maincontent .ox-cred-box {
	position: relative;
	width: 100%;
}

#maincontent .ox-cred-box input {
	padding-right: 62px !important;
	font-family: var(--font-mono, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace);
}

#maincontent .ox-cred-toggle {
	position: absolute;
	right: 6px;
	top: 50%;
	transform: translateY(-50%);
	padding: 3px 8px;
	font-size: 11px;
	font-weight: 600;
	border-radius: 4px;
	border: 1px solid var(--border-color-medium);
	background: var(--background-color-medium);
	color: var(--text-color-high);
	cursor: pointer;
}

#maincontent .ox-cred-warn {
	display: none;
	align-items: center;
	justify-content: space-between;
	gap: 8px;
	margin-top: 6px;
	padding: 6px 10px;
	border-radius: 6px;
	font-size: 11.5px;
	color: var(--error-color-high);
	background: rgba(var(--error-color-high-rgb, 239, 68, 68), 0.10);
	border: 1px solid color-mix(in srgb, var(--error-color-high) 30%, var(--border-color-low));
}

#maincontent .ox-cred-warn.visible {
	display: flex;
}

#maincontent .ox-cred-fix {
	padding: 2px 8px;
	font-size: 11px;
	font-weight: 600;
	border-radius: 4px;
	border: 1px solid var(--error-color-high);
	background: transparent;
	color: var(--error-color-high);
	cursor: pointer;
	white-space: nowrap;
}

/* Subnet Pills */
#maincontent .ox-pills {
	display: flex;
	flex-wrap: wrap;
	gap: 6px;
	width: 100%;
	justify-content: flex-end;
}

#maincontent .ox-pill {
	display: inline-flex;
	align-items: center;
	padding: 3px 10px;
	border-radius: 999px;
	font-size: 12px;
	font-family: var(--font-mono, monospace);
	border: 1px solid var(--border-color-medium);
	background: var(--background-color-medium);
	color: var(--text-color-high);
	cursor: pointer;
	user-select: none;
	transition: all 0.12s ease;
}

#maincontent .ox-pill.active {
	background: color-mix(in srgb, var(--primary-color-high) 14%, var(--background-color-high));
	border-color: var(--primary-color-high);
	color: var(--primary-color-low);
	font-weight: 600;
}

:root[data-darkmode="true"] #maincontent .ox-pill.active {
	color: var(--primary-color-high);
}

/* Danger Zone Card */
#maincontent .ox-danger-card {
	border-color: color-mix(in srgb, var(--error-color-high) 36%, var(--border-color-medium));
}

/* Log Viewer Card (Section 3.2 & 8.5) */
#maincontent .ox-log-panel {
	border-radius: 8px;
	border: 1px solid var(--border-color-medium);
	background: var(--background-color-high);
	box-shadow: 0 2px 8px rgba(15, 23, 42, 0.06);
	overflow: hidden;
}

#maincontent .ox-log-head {
	display: flex;
	align-items: center;
	justify-content: space-between;
	flex-wrap: wrap;
	gap: 10px;
	padding: 12px 16px;
	background: color-mix(in srgb, var(--background-color-low) 40%, var(--background-color-high));
	border-bottom: 1px solid var(--border-color-low);
}

#maincontent .ox-log-head-left {
	display: flex;
	align-items: center;
	gap: 10px;
}

#maincontent .ox-log-head-left h3 {
	margin: 0;
	font-size: 14px;
	font-weight: 600;
	color: var(--text-color-high);
}

#maincontent .ox-log-tools {
	display: flex;
	align-items: center;
	flex-wrap: wrap;
	gap: 8px;
}

#maincontent .ox-log-tools select,
#maincontent .ox-log-tools input[type="text"] {
	height: 30px;
	padding: 4px 8px;
	font-size: 12.5px;
	border-radius: 6px;
	border: 1px solid var(--border-color-medium);
	background: var(--background-color-high);
	color: var(--text-color-high);
	box-sizing: border-box;
	background-image: none !important;
}

#maincontent .ox-log-body {
	padding: 12px 16px;
}

#maincontent .ox-log-textarea {
	width: 100%;
	height: 480px;
	box-sizing: border-box;
	padding: 10px 12px;
	border-radius: 6px;
	border: 1px solid var(--border-color-low);
	background: color-mix(in srgb, var(--background-color-low) 25%, var(--background-color-high));
	color: var(--text-color-high);
	font-family: var(--font-mono, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace);
	font-size: 12px;
	line-height: 1.5;
	white-space: pre;
	overflow: auto;
	resize: vertical;
}

/* Bottom Page Actions Card (Section 8.1) */
#maincontent .ox-view ~ .cbi-page-actions {
	background: var(--background-color-high);
	border: 1px solid var(--border-color-low);
	border-radius: 10px;
	padding: 12px 18px;
	margin: 0 0 16px 0;
}

/* Modal Styling (Section 4.5) */
#modal_overlay > .modal.cbi-modal {
	border-radius: 10px;
	padding: 18px 22px 14px 22px;
	overflow: visible;
	box-shadow: 0 12px 32px rgba(15, 23, 42, 0.16);
}

#modal_overlay > .modal.cbi-modal > h4 {
	margin: -18px -22px 16px -22px;
	padding: 14px 22px;
	border-radius: 10px 10px 0 0;
	background: var(--background-color-medium);
	border-bottom: 1px solid var(--border-color-low);
	font-size: 15px;
	font-weight: 600;
}

#modal_overlay > .modal.cbi-modal > .button-row {
	margin: 14px -22px -14px -22px;
	padding: 12px 22px;
	border-radius: 0 0 10px 10px;
	background: var(--background-color-medium);
	border-top: 1px solid var(--border-color-low);
}

/* Responsive Breakpoints: 860px / 768px / 520px */
@media screen and (max-width: 860px) {
	#maincontent .ox-summary-grid {
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 10px;
	}
	#maincontent .ox-form-grid {
		grid-template-columns: 1fr;
	}
}

@media screen and (max-width: 768px), screen and (max-device-width: 600px) {
	#maincontent .ox-view input[type="text"],
	#maincontent .ox-view input[type="password"],
	#maincontent .ox-view input[type="number"],
	#maincontent .ox-view select,
	#maincontent .ox-view textarea {
		font-size: 16px !important;
		min-height: 36px;
		box-sizing: border-box;
	}
	#maincontent .ox-view .cbi-button,
	#maincontent .ox-view ~ .cbi-page-actions .cbi-button {
		min-height: 34px;
	}
	#maincontent ul.ox-tabs > li {
		flex: 1 1 auto;
		text-align: center;
	}
	#maincontent .ox-panel-head {
		font-size: 13px;
	}
	#maincontent .ox-card-main {
		font-size: 16px;
	}
	#maincontent .ox-toolbar {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		width: 100%;
	}
	#maincontent .ox-toolbar .ox-toolbar-wide {
		grid-column: 1 / -1;
	}
	#maincontent .ox-form-row {
		flex-direction: column;
		align-items: stretch;
		gap: 8px;
	}
	#maincontent .ox-form-field-col {
		max-width: none;
		align-items: stretch;
	}
	#maincontent .ox-pills {
		justify-content: flex-start;
	}
	/* Cardify Table on Mobile */
	#maincontent .ox-panel-body .tr.table-titles,
	#maincontent .ox-panel-body thead {
		display: none !important;
	}
	#maincontent .ox-panel-body .tr,
	#maincontent .ox-panel-body tbody tr {
		display: flex;
		flex-wrap: wrap;
		gap: 8px 12px;
		padding: 12px 14px;
		border-bottom: 1px solid var(--border-color-low);
	}
	#maincontent .ox-panel-body .td {
		flex: 1 1 calc(50% - 10px);
		border-top: none;
		padding: 0;
		white-space: normal;
		word-break: break-word;
	}
	#maincontent .ox-panel-body .td[data-title]::before {
		content: attr(data-title);
		display: block;
		font-size: 11px;
		font-weight: 600;
		color: var(--text-color-medium);
		margin-bottom: 2px;
	}
	#maincontent .ox-panel-body .td.cbi-section-actions {
		flex: 1 1 100%;
		width: 100%;
		padding-top: 8px;
		margin-top: 4px;
		border-top: 1px dashed var(--border-color-low);
		text-align: left;
	}
	#maincontent .ox-actions-wrap {
		justify-content: flex-start;
	}
	#modal_overlay > .modal.cbi-modal {
		width: calc(100vw - 20px) !important;
		margin: 10px auto;
		padding: 14px 14px 12px 14px;
	}
	#modal_overlay > .modal.cbi-modal > h4 {
		margin: -14px -14px 12px -14px;
		padding: 12px 14px;
	}
	#modal_overlay > .modal.cbi-modal > .button-row {
		margin: 12px -14px -12px -14px;
		padding: 10px 14px;
	}
}

@media screen and (max-width: 520px) {
	#maincontent .ox-summary-grid {
		grid-template-columns: 1fr;
	}
	#maincontent .ox-panel-body .td {
		flex: 1 1 100%;
	}
	#modal_overlay > .modal.cbi-modal > .button-row .cbi-button {
		flex: 1 1 auto;
	}
}
`;

return view.extend({
	actionInProgress: false,
	noteTimer: null,
	credSyncTimer: null,
	latestStatus: {},
	latestSettings: {},
	latestLogs: [],

	load: function() {
		return Promise.all([
			callGetStatus(),
			callGetSubroutes(),
			callGetSettings(),
			callGetLogs(200),
			uci.load('tailscale')
		]);
	},

	showNote: function(msg, type, shake) {
		const el = document.getElementById('ox_status_note');
		if (!el) return;
		if (this.noteTimer) {
			clearTimeout(this.noteTimer);
			this.noteTimer = null;
		}
		el.classList.remove('ox-note-info', 'ox-note-ok', 'ox-note-err', 'ox-note-shake');
		if (type === 'info') el.classList.add('ox-note-info');
		else if (type === 'ok') el.classList.add('ox-note-ok');
		else if (type === 'err') el.classList.add('ox-note-err');

		el.textContent = msg;
		if (shake) {
			void el.offsetWidth;
			el.classList.add('ox-note-shake');
		}
		const self = this;
		this.noteTimer = setTimeout(function() {
			self.restoreDefaultNote();
		}, 4500);
	},

	restoreDefaultNote: function() {
		const el = document.getElementById('ox_status_note');
		if (!el) return;
		el.classList.remove('ox-note-info', 'ox-note-ok', 'ox-note-err', 'ox-note-shake');
		const status = this.latestStatus || {};
		const settings = this.latestSettings || {};
		const isEnabled = (settings.enabled !== '0');
		const isRunning = (status.status === 'running');
		const isLoginNeeded = (status.status === 'logout' || status.backend_state === 'NeedsLogin');

		if (!isEnabled) {
			el.classList.add('ox-note-info');
			el.textContent = _('Service is disabled. Click "Enable Service" above or enable it in General Settings to start Tailscale.');
		} else if (isLoginNeeded) {
			el.textContent = _('Node is waiting for authorization. Click "Authorize Login" above or configure a Pre-Auth Key in General Settings.');
		} else if (isRunning) {
			el.classList.add('ox-note-ok');
			const healthText = (Array.isArray(status.health) && status.health.length > 0) ? status.health.join('; ') : '';
			el.textContent = healthText ? (_('Connected: ') + healthText) : _('Tailnet mesh is active and healthy. Status refreshes automatically every 5 seconds.');
		} else {
			el.textContent = _('Tailscale daemon is currently stopped. Click "Enable Service" to start.');
		}
	},

	setServiceBadge: function(status, settings) {
		const badge = document.getElementById('ox_service_badge');
		if (!badge) return;
		badge.classList.remove('ox-dot-ok', 'ox-dot-warn', 'ox-dot-err', 'ox-dot-muted');
		const isEnabled = (settings.enabled !== '0');
		const isRunning = (status.status === 'running');
		const isLoginNeeded = (status.status === 'logout' || status.backend_state === 'NeedsLogin');

		if (!isEnabled) {
			badge.classList.add('ox-dot-muted');
			badge.textContent = _('Disabled');
		} else if (isRunning) {
			badge.classList.add('ox-dot-ok');
			badge.textContent = _('Running');
		} else if (isLoginNeeded) {
			badge.classList.add('ox-dot-warn');
			badge.textContent = _('Needs Login');
		} else {
			badge.classList.add('ox-dot-err');
			badge.textContent = _('Stopped');
		}
	},

	buildStatusPanelContent: function(status, settings) {
		const self = this;
		const isEnabled = (settings.enabled !== '0');
		const isRunning = (status.status === 'running');
		const isLoginNeeded = (status.status === 'logout' || status.backend_state === 'NeedsLogin');
		const peers = status.peers || {};
		const peerKeys = Object.keys(peers);

		let onlineCount = 0;
		let directCount = 0;
		let derpCount = 0;
		peerKeys.forEach(function(k) {
			const p = peers[k];
			if (p.online) onlineCount++;
			if (p.cur_addr && p.cur_addr !== '') directCount++;
			else derpCount++;
		});

		const displayIpv4 = (status.ipv4 && status.ipv4 !== 'No IP assigned' && status.ipv4 !== 'No IP')
			? status.ipv4
			: _('Not assigned');

		const nodeCardClass = isRunning ? 'ox-card ox-card-ok' : (isLoginNeeded ? 'ox-card ox-card-warn' : 'ox-card ox-card-err');
		const nodeDotClass = isRunning ? 'ox-dot ox-dot-ok' : (isLoginNeeded ? 'ox-dot ox-dot-warn' : 'ox-dot ox-dot-err');
		const nodeDotText = isRunning ? _('Running') : (isLoginNeeded ? _('Needs Login') : _('Stopped'));
		const ipCardClass = (status.ipv4) ? 'ox-card ox-card-info' : 'ox-card ox-card-muted';
		const fwBadge = status.fw_badge || 'NFTABLES';
		const fwName = status.fw_name || 'Firewall4';
		const mtu = settings.daemon_mtu || '1280';

		const toggleBtn = E('button', {
			'class': 'btn cbi-button ' + (isEnabled && (isRunning || isLoginNeeded) ? 'cbi-button-negative' : 'cbi-button-positive'),
			'click': function(ev) {
				ev.preventDefault();
				self.handleToggleService(this, !(isEnabled && (isRunning || isLoginNeeded)));
			}
		}, (isEnabled && (isRunning || isLoginNeeded)) ? _('Stop Service') : _('Enable Service'));

		const authBtn = isRunning
			? E('button', {
				'class': 'btn cbi-button cbi-button-neutral',
				'click': function(ev) {
					ev.preventDefault();
					self.handleLogout(this);
				}
			}, _('Logout & Unbind'))
			: E('button', {
				'class': 'btn cbi-button cbi-button-action ox-toolbar-wide',
				'disabled': !isEnabled ? '' : null,
				'click': function(ev) {
					ev.preventDefault();
					self.handleDirectJoin(this);
				}
			}, _('Authorize Login'));

		const refreshBtn = E('button', {
			'class': 'btn cbi-button cbi-button-neutral',
			'click': function(ev) {
				ev.preventDefault();
				self.handleManualRefresh(this);
			}
		}, _('Refresh'));

		return [
			E('div', { 'class': 'ox-header-bar' }, [
				E('h3', {}, _('Running Status')),
				E('div', { 'class': 'ox-toolbar' }, [toggleBtn, authBtn, refreshBtn])
			]),
			E('div', { 'class': 'ox-summary-grid' }, [
				E('div', { 'class': nodeCardClass }, [
					E('div', { 'class': 'ox-card-head' }, [
						E('span', { 'class': 'ox-card-title' }, _('Local Node')),
						E('span', { 'class': nodeDotClass }, nodeDotText)
					]),
					E('div', { 'class': 'ox-card-body' }, [
						E('div', { 'class': 'ox-card-main', 'title': status.hostname || 'OpenWrt-Router' }, status.hostname || 'OpenWrt-Router'),
						E('div', { 'class': 'ox-card-sub', 'title': (status.domain_name || _('Tailnet Mesh')) + ' · v' + (status.version || 'Unknown') },
							(status.domain_name || _('Tailnet Mesh')) + ' · ' + (status.version || 'Unknown'))
					])
				]),
				E('div', { 'class': ipCardClass }, [
					E('div', { 'class': 'ox-card-head' }, [
						E('span', { 'class': 'ox-card-title' }, _('Tailscale IP')),
						status.ipv4 ? E('button', {
							'class': 'ox-mini-copy',
							'click': function(ev) {
								ev.preventDefault();
								const btn = this;
								copyToClipboard(status.ipv4).then(function(ok) {
									if (ok) {
										const orig = btn.textContent;
										btn.textContent = _('Copied');
										self.showNote(_('Copied Tailscale IP: ') + status.ipv4, 'ok');
										setTimeout(function() { btn.textContent = orig; }, 1500);
									} else {
										self.showNote(_('Failed to copy to clipboard.'), 'err', true);
									}
								});
							}
						}, _('Copy')) : E('span', { 'class': 'ox-dot ox-dot-muted' }, _('Unassigned'))
					]),
					E('div', { 'class': 'ox-card-body' }, [
						E('div', { 'class': 'ox-card-main ox-mono', 'title': displayIpv4 }, displayIpv4),
						E('div', { 'class': 'ox-card-sub' }, _('IPv6: ') + (status.ipv6 ? status.ipv6 : _('None')))
					])
				]),
				E('div', { 'class': 'ox-card ox-card-ok' }, [
					E('div', { 'class': 'ox-card-head' }, [
						E('span', { 'class': 'ox-card-title' }, _('Firewall Mode')),
						E('span', { 'class': 'ox-dot ox-dot-ok' }, fwBadge)
					]),
					E('div', { 'class': 'ox-card-body' }, [
						E('div', { 'class': 'ox-card-main' }, fwName),
						E('div', { 'class': 'ox-card-sub' }, _('Interface: tailscale0 (MTU %s)').format(mtu))
					])
				]),
				E('div', { 'class': peerKeys.length > 0 ? 'ox-card ox-card-info' : 'ox-card ox-card-muted' }, [
					E('div', { 'class': 'ox-card-head' }, [
						E('span', { 'class': 'ox-card-title' }, _('Mesh Topology')),
						E('span', { 'class': 'ox-dot ' + (onlineCount > 0 ? 'ox-dot-info' : 'ox-dot-muted') },
							onlineCount + ' / ' + peerKeys.length + ' ' + _('Online'))
					]),
					E('div', { 'class': 'ox-card-body' }, [
						E('div', { 'class': 'ox-card-main' }, peerKeys.length + ' ' + _('Peer Nodes')),
						E('div', { 'class': 'ox-card-sub' }, _('Direct: %d · Relay: %d').format(directCount, derpCount))
					])
				])
			]),
			E('div', { 'class': 'ox-note', 'id': 'ox_status_note' }, '')
		];
	},

	buildPeersTableContent: function(status, settings) {
		const self = this;
		const isRunning = (status.status === 'running');
		const peers = status.peers || {};
		const peerKeys = Object.keys(peers);
		const advRoutes = getAdvRoutesStr(settings.advertise_routes);
		const displayIpv4 = (status.ipv4 && status.ipv4 !== 'No IP assigned' && status.ipv4 !== 'No IP')
			? status.ipv4
			: _('Not assigned');

		const rows = [
			E('tr', { 'class': 'tr' }, [
				E('td', { 'class': 'td', 'data-title': _('Status / Device') }, [
					E('span', { 'class': 'ox-dot ' + (isRunning ? 'ox-dot-ok' : 'ox-dot-muted'), 'style': 'margin-right:8px;' },
						isRunning ? _('Online') : _('Offline')),
					E('strong', {}, status.hostname || 'OpenWrt-Router')
				]),
				E('td', { 'class': 'td ox-mono ox-nowrap', 'data-title': _('Tailscale IP') }, displayIpv4),
				E('td', { 'class': 'td ox-nowrap', 'data-title': _('OS') }, 'OpenWrt'),
				E('td', { 'class': 'td', 'data-title': _('Features / Subnets') }, [
					E('div', { 'class': 'ox-tags-wrap' }, [
						E('span', { 'class': 'ox-tag ox-tag-info' }, _('Self')),
						advRoutes ? E('span', { 'class': 'ox-tag ox-tag-ok' }, advRoutes) : '',
						settings.advertise_exit_node === '1' ? E('span', { 'class': 'ox-tag ox-tag-warn' }, _('Exit Node')) : ''
					])
				]),
				E('td', { 'class': 'td ox-nowrap', 'data-title': _('Link Mode') }, _('Local Interface (tailscale0)')),
				E('td', { 'class': 'td cbi-section-actions', 'data-title': _('Action') }, [
					E('div', { 'class': 'ox-actions-wrap' }, [
						E('button', {
							'class': 'btn cbi-button cbi-button-neutral',
							'disabled': !status.ipv4 ? '' : null,
							'click': function(ev) {
								ev.preventDefault();
								const btn = this;
								copyToClipboard(status.ipv4).then(function(ok) {
									if (ok) {
										const orig = btn.textContent;
										btn.textContent = _('Copied');
										self.showNote(_('Copied Tailscale IP: ') + status.ipv4, 'ok');
										setTimeout(function() { btn.textContent = orig; }, 1500);
									}
								});
							}
						}, _('Copy'))
					])
				])
			])
		];

		if (peerKeys.length === 0) {
			rows.push(E('tr', { 'class': 'tr' }, [
				E('td', { 'class': 'td ox-muted', 'colspan': '6', 'style': 'text-align:center; padding:18px 14px;' },
					_('No remote mesh peers found yet. Authorize this node to sync peer devices.'))
			]));
		} else {
			peerKeys.forEach(function(k) {
				const p = peers[k];
				const isDirect = (p.cur_addr && p.cur_addr !== '');
				const ipStr = p.ipv4 || (p.ip ? p.ip.split('<br>')[0] : '') || '';
				rows.push(E('tr', { 'class': 'tr' }, [
					E('td', { 'class': 'td', 'data-title': _('Status / Device') }, [
						E('span', { 'class': 'ox-dot ' + (p.online ? 'ox-dot-ok' : 'ox-dot-muted'), 'style': 'margin-right:8px;' },
							p.online ? _('Online') : _('Offline')),
						E('strong', {}, p.hostname || _('Unknown'))
					]),
					E('td', { 'class': 'td ox-mono ox-nowrap', 'data-title': _('Tailscale IP') }, ipStr || _('Not assigned')),
					E('td', { 'class': 'td ox-nowrap', 'data-title': _('OS') }, p.os || 'Linux'),
					E('td', { 'class': 'td', 'data-title': _('Features / Subnets') }, [
						E('div', { 'class': 'ox-tags-wrap' }, [
							p.exit_node ? E('span', { 'class': 'ox-tag ox-tag-warn' }, _('Exit Node')) : '',
							(p.primary_routes && p.primary_routes.length > 0)
								? E('span', { 'class': 'ox-tag ox-tag-info' }, p.primary_routes.join(', '))
								: '',
							(!p.exit_node && (!p.primary_routes || p.primary_routes.length === 0))
								? E('span', { 'class': 'ox-tag ox-tag-muted' }, _('Standard Node'))
								: ''
						])
					]),
					E('td', { 'class': 'td ox-nowrap', 'data-title': _('Link Mode') },
						isDirect
							? E('span', { 'class': 'ox-tag ox-tag-ok' }, _('Direct'))
							: E('span', { 'class': 'ox-tag ox-tag-warn' }, _('Relay') + (p.relay ? ' (' + p.relay + ')' : ''))
					),
					E('td', { 'class': 'td cbi-section-actions', 'data-title': _('Action') }, [
						E('div', { 'class': 'ox-actions-wrap' }, [
							E('button', {
								'class': 'btn cbi-button cbi-button-neutral',
								'disabled': !ipStr ? '' : null,
								'click': function(ev) {
									ev.preventDefault();
									const btn = this;
									copyToClipboard(ipStr).then(function(ok) {
										if (ok) {
											const orig = btn.textContent;
											btn.textContent = _('Copied');
											self.showNote(_('Copied peer IP: ') + ipStr, 'ok');
											setTimeout(function() { btn.textContent = orig; }, 1500);
										}
									});
								}
							}, _('Copy'))
						])
					])
				]));
			});
		}

		return [
			E('div', { 'class': 'ox-panel-head' }, [
				E('span', {}, _('Mesh Peers')),
				E('span', { 'class': 'ox-count-pill' }, String(1 + peerKeys.length))
			]),
			E('div', { 'class': 'ox-panel-body' }, [
				E('table', { 'class': 'table cbi-section-table' }, [
					E('thead', {}, [
						E('tr', { 'class': 'tr table-titles' }, [
							E('th', { 'class': 'th' }, _('Status / Device')),
							E('th', { 'class': 'th' }, _('Tailscale IP')),
							E('th', { 'class': 'th' }, _('OS')),
							E('th', { 'class': 'th' }, _('Features / Subnets')),
							E('th', { 'class': 'th' }, _('Link Mode')),
							E('th', { 'class': 'th', 'style': 'text-align:right;' }, _('Action'))
						])
					]),
					E('tbody', { 'class': 'tbody' }, rows)
				])
			])
		];
	},

	refreshStatusUI: function(status, settings) {
		this.latestStatus = status || {};
		this.latestSettings = settings || {};
		this.setServiceBadge(this.latestStatus, this.latestSettings);

		const statusPanel = document.getElementById('ox_status_panel');
		if (statusPanel) {
			dom.content(statusPanel, this.buildStatusPanelContent(this.latestStatus, this.latestSettings));
			this.restoreDefaultNote();
		}
		const tablesBox = document.getElementById('ox_tables_box');
		if (tablesBox) {
			dom.content(tablesBox, this.buildPeersTableContent(this.latestStatus, this.latestSettings));
		}
	},

	renderFilteredLogs: function(logs) {
		this.latestLogs = Array.isArray(logs) ? logs : [];
		const body = document.getElementById('ox_log_body');
		const countEl = document.getElementById('ox_log_count');
		if (!body) return;

		const level = (document.getElementById('ox_log_level')?.value || 'all').toLowerCase();
		const kw = (document.getElementById('ox_log_search')?.value || '').trim().toLowerCase();
		const wasNearBottom = (body.scrollHeight - body.scrollTop - body.clientHeight) < 24;

		const filtered = this.latestLogs.map(function(l) {
			return String(l || '').trim();
		}).filter(function(line) {
			if (!line) return false;
			const lower = line.toLowerCase();
			const msgBody = lower.replace(/^.*?(?:tailscaled\[\d+\]|tailscale|outlierox):\s*/, '');
			if (level === 'err' && !/\b(error|err|fail|failed|fatal|panic|crit|action_error)\b/.test(msgBody)) return false;
			if (level === 'warn' && !/\b(warn|warning|error|err|fail|failed|fatal|panic|crit|action_error)\b/.test(msgBody)) return false;
			if (kw && lower.indexOf(kw) === -1) return false;
			return true;
		});

		if (countEl) countEl.textContent = String(filtered.length);
		body.value = filtered.length > 0 ? filtered.join('\n') : _('No matching logs recorded.');
		if (wasNearBottom) {
			body.scrollTop = body.scrollHeight;
		}
	},

	handleManualRefresh: function(btn) {
		const self = this;
		const orig = btn.textContent;
		btn.disabled = true;
		btn.textContent = _('Refreshing...');
		return Promise.all([callGetStatus(), callGetSettings()]).then(function(res) {
			self.refreshStatusUI(res[0], res[1]);
			self.showNote(_('Status refreshed.'), 'info');
		}).catch(function(err) {
			self.showNote(_('Refresh failed: ') + cleanRpcError(err), 'err', true);
		}).finally(function() {
			btn.disabled = false;
			btn.textContent = orig;
		});
	},

	handleToggleService: function(btn, enableTarget) {
		const self = this;
		const orig = btn.textContent;
		btn.disabled = true;
		btn.textContent = enableTarget ? _('Starting...') : _('Stopping...');
		this.actionInProgress = true;

		const formData = collectFormData();
		formData.enabled = enableTarget ? '1' : '0';
		const enabledCheckbox = document.getElementById('ts_enabled');
		if (enabledCheckbox) enabledCheckbox.checked = enableTarget;

		return callSetSettings(formData).then(function(res) {
			if (res && res.error) {
				self.showNote(res.error, 'err', true);
				return;
			}
			return new Promise(function(resolve) {
				setTimeout(resolve, 900);
			}).then(function() {
				return Promise.all([callGetStatus(), callGetSettings()]);
			}).then(function(res1) {
				return new Promise(function(resolve) {
					setTimeout(function() { resolve(res1); }, 700);
				});
			}).then(function() {
				return Promise.all([callGetStatus(), callGetSettings()]);
			}).then(function(res2) {
				self.refreshStatusUI(res2[0], res2[1]);
				self.showNote(enableTarget ? _('Service enabled.') : _('Service stopped.'), 'ok');
			});
		}).catch(function(err) {
			self.showNote(cleanRpcError(err), 'err', true);
		}).finally(function() {
			self.actionInProgress = false;
			btn.disabled = false;
			btn.textContent = orig;
		});
	},

	handleDirectJoin: function(btn) {
		const self = this;
		const srv = document.getElementById('ts_login_server')?.value || this.latestSettings.login_server || this.latestSettings.loginserver || '';
		const key = sanitizeCredValue(document.getElementById('ts_authKey')?.value || this.latestSettings.authKey || this.latestSettings.auth_key || '');
		const host = document.getElementById('ts_hostname')?.value || this.latestSettings.hostname || '';

		const orig = btn.textContent;
		btn.disabled = true;
		btn.textContent = key ? _('Joining...') : _('Requesting URL...');
		this.actionInProgress = true;

		if (key) {
			return callDoLogin({
				login_server: srv,
				auth_key: key,
				hostname: host,
				loginserver: srv,
				loginserver_authkey: key,
				authKey: key
			}).then(function(res) {
				if (res && res.error) {
					self.showNote(res.error, 'err', true);
					return;
				}
				return Promise.all([callGetStatus(), callGetSettings()]).then(function(data) {
					self.refreshStatusUI(data[0], data[1]);
					self.showNote(res?.message || _('Successfully joined Tailnet.'), 'ok');
				});
			}).catch(function(err) {
				self.showNote(cleanRpcError(err), 'err', true);
			}).finally(function() {
				self.actionInProgress = false;
				btn.disabled = false;
				btn.textContent = orig;
			});
		}

		return callDoLogin({
			login_server: srv,
			auth_key: '',
			hostname: host,
			loginserver: srv,
			loginserver_authkey: ''
		}).then(function(res) {
			if (res && res.error) {
				self.showNote(res.error, 'err', true);
				return;
			}
			if (res && res.url) {
				ui.showModal(_('Complete Web Authentication'), [
					E('p', { 'style': 'margin-bottom:10px;' }, _('Auth URL generated. Open the link in your browser to authorize this router:')),
					E('div', {
						'style': 'margin:10px 0; word-break:break-all; background:var(--background-color-medium); padding:10px 12px; border-radius:6px; font-family:var(--font-mono, monospace); font-size:12px; border:1px solid var(--border-color-low);'
					}, [
						E('a', { 'href': res.url, 'target': '_blank', 'style': 'color:var(--primary-color-high); text-decoration:underline; font-weight:600;' }, res.url)
					]),
					E('div', { 'class': 'button-row', 'style': 'display:flex; gap:8px; justify-content:flex-end; flex-wrap:wrap;' }, [
						E('button', {
							'class': 'btn cbi-button cbi-button-neutral',
							'click': function() {
								const copyBtn = this;
								copyToClipboard(res.url).then(function(ok) {
									if (ok) {
										const t = copyBtn.textContent;
										copyBtn.textContent = _('Copied');
										setTimeout(function() { copyBtn.textContent = t; }, 1500);
									}
								});
							}
						}, _('Copy URL')),
						E('a', { 'class': 'btn cbi-button cbi-button-action', 'href': res.url, 'target': '_blank' }, _('Open Auth URL')),
						E('button', {
							'class': 'btn cbi-button cbi-button-positive',
							'click': function() {
								ui.hideModal();
								Promise.all([callGetStatus(), callGetSettings()]).then(function(data) {
									self.refreshStatusUI(data[0], data[1]);
								});
							}
						}, _('Done (Refresh)'))
					])
				]);
			} else {
				return Promise.all([callGetStatus(), callGetSettings()]).then(function(data) {
					self.refreshStatusUI(data[0], data[1]);
					self.showNote(res?.message || _('Connected to Tailnet.'), 'ok');
				});
			}
		}).catch(function(err) {
			self.showNote(cleanRpcError(err), 'err', true);
		}).finally(function() {
			self.actionInProgress = false;
			btn.disabled = false;
			btn.textContent = orig;
		});
	},

	handleLogout: function(btn) {
		const self = this;
		if (!window.confirm(_('Are you sure you want to logout and unbind this node?'))) {
			return;
		}
		const orig = btn.textContent;
		btn.disabled = true;
		btn.textContent = _('Logging out...');
		this.actionInProgress = true;

		return callDoLogout().then(function() {
			return Promise.all([callGetStatus(), callGetSettings()]);
		}).then(function(data) {
			self.refreshStatusUI(data[0], data[1]);
			self.showNote(_('Node logged out and unbound.'), 'info');
		}).catch(function(err) {
			self.showNote(cleanRpcError(err), 'err', true);
		}).finally(function() {
			self.actionInProgress = false;
			btn.disabled = false;
			btn.textContent = orig;
		});
	},

	handleFixFirewall: function(btn) {
		const self = this;
		const orig = btn.textContent;
		btn.disabled = true;
		btn.textContent = _('Applying...');
		this.actionInProgress = true;

		return callSetupFirewall().then(function(res) {
			if (res && res.error) {
				self.showNote(res.error, 'err', true);
			} else {
				self.showNote(res?.message || _('Interface and firewall rules synchronized.'), 'ok');
			}
		}).catch(function(err) {
			self.showNote(cleanRpcError(err), 'err', true);
		}).finally(function() {
			self.actionInProgress = false;
			btn.disabled = false;
			btn.textContent = orig;
		});
	},

	render: function(data) {
		const self = this;
		const status = data[0] || {};
		const subroutes = data[1]?.routes || [];
		const settings = data[2] || {};
		const logs = data[3]?.logs || [];

		this.latestStatus = status;
		this.latestSettings = settings;
		this.latestLogs = logs;

		const peers = status.peers || {};
		const peerKeys = Object.keys(peers);
		const authKeyVal = settings.authKey || settings.auth_key || settings.authkey || '';

		const credWarnEl = E('div', { 'class': 'ox-cred-warn', 'id': 'ox_cred_warn' }, [
			E('span', { 'id': 'ox_cred_warn_text' }, ''),
			E('button', {
				'class': 'ox-cred-fix',
				'type': 'button',
				'click': function(ev) {
					ev.preventDefault();
					const input = document.getElementById('ts_authKey');
					if (input) {
						input.value = sanitizeCredValue(input.value);
						updateCredWarn(input.value);
					}
				}
			}, _('Auto Fix'))
		]);

		function updateCredWarn(val) {
			const issue = detectCredIssue(val);
			const textEl = credWarnEl.querySelector('#ox_cred_warn_text');
			if (issue) {
				if (textEl) textEl.textContent = issue;
				credWarnEl.classList.add('visible');
			} else {
				credWarnEl.classList.remove('visible');
			}
		}

		const authKeyInput = E('input', {
			'type': 'password',
			'class': 'cbi-input-text',
			'id': 'ts_authKey',
			'value': authKeyVal,
			'placeholder': 'tskey-auth-xxxxxxxxxxxx',
			'input': function() {
				const v = this.value;
				if (self.credSyncTimer) clearTimeout(self.credSyncTimer);
				self.credSyncTimer = setTimeout(function() {
					updateCredWarn(v);
				}, 220);
			}
		});
		updateCredWarn(authKeyVal);

		const container = E('div', { 'class': 'ox-view cbi-map' }, [
			E('style', {}, STYLES),
			E('div', { 'class': 'ox-page-header' }, [
				E('h2', {}, [
					E('span', {}, _('Mesh Network')),
					E('span', { 'class': 'ox-dot', 'id': 'ox_service_badge' }, _('Loading...'))
				]),
				E('div', { 'class': 'cbi-map-descr' }, _('Zero-config Mesh virtual private network based on Tailscale / Headscale engine.'))
			]),
			E('ul', { 'class': 'ox-tabs', 'role': 'tablist' }, [
				E('li', { 'class': 'active', 'data-tab': 'overview' }, [E('a', { 'href': '#overview' }, _('Overview'))]),
				E('li', { 'data-tab': 'settings' }, [E('a', { 'href': '#settings' }, _('General Settings'))]),
				E('li', { 'data-tab': 'routing' }, [E('a', { 'href': '#routing' }, _('Routing & Subnets'))]),
				E('li', { 'data-tab': 'security' }, [E('a', { 'href': '#security' }, _('Firewall & Security'))]),
				E('li', { 'data-tab': 'extra' }, [E('a', { 'href': '#extra' }, _('Advanced Flags'))]),
				E('li', { 'data-tab': 'logs' }, [E('a', { 'href': '#logs' }, _('Logs'))])
			]),

			/* Panel 1: Overview */
			E('div', { 'class': 'ox-tab-panel active', 'id': 'ox-panel-overview' }, [
				E('div', { 'class': 'ox-panel-shell', 'id': 'ox_status_panel' }, this.buildStatusPanelContent(status, settings)),
				E('div', { 'class': 'ox-panel-shell ox-tables-box', 'id': 'ox_tables_box' }, this.buildPeersTableContent(status, settings))
			]),

			/* Panel 2: General Settings */
			E('div', { 'class': 'ox-tab-panel', 'id': 'ox-panel-settings' }, [
				E('div', { 'class': 'ox-panel-shell' }, [
					E('div', { 'class': 'ox-form-grid' }, [
						E('div', { 'class': 'ox-form-card' }, [
							E('div', { 'class': 'ox-form-card-head' }, [
								E('div', {}, [
									E('h3', { 'class': 'ox-form-card-title' }, _('Core Service Management')),
									E('div', { 'class': 'ox-form-card-desc' }, _('Core parameters mapped to UCI /etc/config/tailscale'))
								])
							]),
							E('div', { 'class': 'ox-form-card-body' }, [
								E('div', { 'class': 'ox-form-row' }, [
									E('div', { 'class': 'ox-form-label-col' }, [
										E('span', { 'class': 'ox-form-label' }, _('Enable Outlierox Service')),
										E('span', { 'class': 'ox-form-hint' }, _('Start tailscaled daemon automatically on system boot'))
									]),
									E('div', { 'class': 'ox-form-field-col' }, [
										E('input', { 'type': 'checkbox', 'id': 'ts_enabled', 'checked': (settings.enabled !== '0' ? '' : null) })
									])
								]),
								E('div', { 'class': 'ox-form-row' }, [
									E('div', { 'class': 'ox-form-label-col' }, [
										E('label', { 'class': 'ox-form-label', 'for': 'ts_port' }, _('Listen Port')),
										E('span', { 'class': 'ox-form-hint' }, _('Tailscale WireGuard UDP listen port (default: 41641)'))
									]),
									E('div', { 'class': 'ox-form-field-col' }, [
										E('input', { 'type': 'number', 'id': 'ts_port', 'value': settings.port || '41641', 'placeholder': '41641' })
									])
								]),
								E('div', { 'class': 'ox-form-row' }, [
									E('div', { 'class': 'ox-form-label-col' }, [
										E('label', { 'class': 'ox-form-label', 'for': 'ts_config_path' }, _('State Directory')),
										E('span', { 'class': 'ox-form-hint' }, _('Directory for persistent node state and keys'))
									]),
									E('div', { 'class': 'ox-form-field-col' }, [
										E('input', { 'type': 'text', 'id': 'ts_config_path', 'value': settings.config_path || settings.state_dir || '/etc/tailscale' })
									])
								]),
								E('div', { 'class': 'ox-form-row' }, [
									E('div', { 'class': 'ox-form-label-col' }, [
										E('span', { 'class': 'ox-form-label' }, _('Firewall Backend Mode'))
									]),
									E('div', { 'class': 'ox-form-field-col' }, [
										E('span', { 'class': 'ox-tag ox-tag-ok' }, (status.fw_name || 'Firewall4') + ' (' + (status.fw_driver || 'nftables') + ')')
									])
								]),
								E('div', { 'class': 'ox-form-row' }, [
									E('div', { 'class': 'ox-form-label-col' }, [
										E('span', { 'class': 'ox-form-label' }, _('Standard Output Log')),
										E('span', { 'class': 'ox-form-hint' }, _('Log runtime and connection events to syslog'))
									]),
									E('div', { 'class': 'ox-form-field-col' }, [
										E('input', { 'type': 'checkbox', 'id': 'ts_log_stdout', 'checked': (settings.log_stdout !== '0' ? '' : null) })
									])
								]),
								E('div', { 'class': 'ox-form-row' }, [
									E('div', { 'class': 'ox-form-label-col' }, [
										E('span', { 'class': 'ox-form-label' }, _('Error Log')),
										E('span', { 'class': 'ox-form-hint' }, _('Log runtime errors and stack traces'))
									]),
									E('div', { 'class': 'ox-form-field-col' }, [
										E('input', { 'type': 'checkbox', 'id': 'ts_log_stderr', 'checked': (settings.log_stderr !== '0' ? '' : null) })
									])
								])
							])
						]),
						E('div', { 'class': 'ox-form-card' }, [
							E('div', { 'class': 'ox-form-card-head' }, [
								E('div', {}, [
									E('h3', { 'class': 'ox-form-card-title' }, _('Private Node & Headscale Integration')),
									E('div', { 'class': 'ox-form-card-desc' }, _('Connect to self-hosted Headscale control server'))
								])
							]),
							E('div', { 'class': 'ox-form-card-body' }, [
								E('div', { 'class': 'ox-form-row' }, [
									E('div', { 'class': 'ox-form-label-col' }, [
										E('label', { 'class': 'ox-form-label', 'for': 'ts_login_server' }, _('Login Server URL')),
										E('span', { 'class': 'ox-form-hint' }, _('Leave empty to use official Tailscale SaaS coordination server'))
									]),
									E('div', { 'class': 'ox-form-field-col' }, [
										E('input', { 'type': 'text', 'id': 'ts_login_server', 'value': settings.login_server || settings.loginserver || '', 'placeholder': 'https://headscale.example.com' })
									])
								]),
								E('div', { 'class': 'ox-form-row' }, [
									E('div', { 'class': 'ox-form-label-col' }, [
										E('label', { 'class': 'ox-form-label', 'for': 'ts_authKey' }, _('Pre-Auth Key')),
										E('span', { 'class': 'ox-form-hint' }, _('Auth key for headless non-interactive node joining'))
									]),
									E('div', { 'class': 'ox-form-field-col' }, [
										E('div', { 'class': 'ox-cred-wrap' }, [
											E('div', { 'class': 'ox-cred-box' }, [
												authKeyInput,
												E('button', {
													'type': 'button',
													'class': 'ox-cred-toggle',
													'click': function(ev) {
														ev.preventDefault();
														const isPwd = authKeyInput.type === 'password';
														authKeyInput.type = isPwd ? 'text' : 'password';
														this.textContent = isPwd ? _('Hide') : _('Show');
													}
												}, _('Show'))
											]),
											credWarnEl
										])
									])
								]),
								E('div', { 'class': 'ox-form-row' }, [
									E('div', { 'class': 'ox-form-label-col' }, [
										E('label', { 'class': 'ox-form-label', 'for': 'ts_hostname' }, _('Custom Hostname')),
										E('span', { 'class': 'ox-form-hint' }, _('Friendly name in the Tailnet mesh'))
									]),
									E('div', { 'class': 'ox-form-field-col' }, [
										E('input', { 'type': 'text', 'id': 'ts_hostname', 'value': settings.hostname || '', 'placeholder': 'OpenWrt-Router' })
									])
								]),
								E('div', { 'class': 'ox-form-row' }, [
									E('div', { 'class': 'ox-form-label-col' }, [
										E('span', { 'class': 'ox-form-label' }, _('Interface & Firewall Sync')),
										E('span', { 'class': 'ox-form-hint' }, _('Create tailscale0 interface and firewall zone rules automatically'))
									]),
									E('div', { 'class': 'ox-form-field-col' }, [
										E('button', {
											'class': 'btn cbi-button cbi-button-action',
											'click': function(ev) {
												ev.preventDefault();
												self.handleFixFirewall(this);
											}
										}, _('Fix Firewall'))
									])
								])
							])
						])
					])
				])
			]),

			/* Panel 3: Routing & Subnets */
			E('div', { 'class': 'ox-tab-panel', 'id': 'ox-panel-routing' }, [
				E('div', { 'class': 'ox-panel-shell' }, [
					E('div', { 'class': 'ox-form-grid' }, [
						E('div', { 'class': 'ox-form-card' }, [
							E('div', { 'class': 'ox-form-card-head' }, [
								E('div', {}, [
									E('h3', { 'class': 'ox-form-card-title' }, _('Advertise LAN Subnets')),
									E('div', { 'class': 'ox-form-card-desc' }, _('Publish local subnets for access by other mesh nodes'))
								])
							]),
							E('div', { 'class': 'ox-form-card-body' }, [
								E('div', { 'class': 'ox-form-row' }, [
									E('div', { 'class': 'ox-form-label-col' }, [
										E('span', { 'class': 'ox-form-label' }, _('Auto-detected Subnets')),
										E('span', { 'class': 'ox-form-hint' }, _('Click subnet pills to toggle advertisement'))
									]),
									E('div', { 'class': 'ox-form-field-col' }, [
										subroutes.length > 0 ? E('div', { 'class': 'ox-pills' }, subroutes.map(function(sub) {
											const advList = (getAdvRoutesStr(settings.advertise_routes) || '').split(/[\s,]+/).filter(Boolean);
											const isAct = advList.includes(sub);
											return E('span', {
												'class': 'ox-pill' + (isAct ? ' active' : ''),
												'click': function() {
													const input = document.getElementById('ts_advertise_routes');
													let cur = input.value.trim().split(/[\s,]+/).filter(Boolean);
													if (cur.includes(sub)) {
														cur = cur.filter(function(x) { return x !== sub; });
														this.classList.remove('active');
													} else {
														cur.push(sub);
														this.classList.add('active');
													}
													input.value = cur.join(',');
												}
											}, sub);
										})) : E('span', { 'class': 'ox-form-hint' }, _('No valid local LAN subnets detected'))
									])
								]),
								E('div', { 'class': 'ox-form-row' }, [
									E('div', { 'class': 'ox-form-label-col' }, [
										E('label', { 'class': 'ox-form-label', 'for': 'ts_advertise_routes' }, _('Advertised Subnets')),
										E('span', { 'class': 'ox-form-hint' }, _('Comma-separated CIDRs, e.g. 192.168.1.0/24,10.0.0.0/24'))
									]),
									E('div', { 'class': 'ox-form-field-col' }, [
										E('input', { 'type': 'text', 'id': 'ts_advertise_routes', 'value': getAdvRoutesStr(settings.advertise_routes), 'placeholder': '192.168.1.0/24' })
									])
								]),
								E('div', { 'class': 'ox-form-row' }, [
									E('div', { 'class': 'ox-form-label-col' }, [
										E('span', { 'class': 'ox-form-label' }, _('Advertise as Exit Node')),
										E('span', { 'class': 'ox-form-hint' }, _('Allow other mesh nodes to route internet traffic through this router'))
									]),
									E('div', { 'class': 'ox-form-field-col' }, [
										E('input', { 'type': 'checkbox', 'id': 'ts_advertise_exit_node', 'checked': (settings.advertise_exit_node === '1' ? '' : null) })
									])
								])
							])
						]),
						E('div', { 'class': 'ox-form-card' }, [
							E('div', { 'class': 'ox-form-card-head' }, [
								E('div', {}, [
									E('h3', { 'class': 'ox-form-card-title' }, _('Subnet Acceptance & Exit Nodes')),
									E('div', { 'class': 'ox-form-card-desc' }, _('Access remote subnets or use remote mesh exit nodes'))
								])
							]),
							E('div', { 'class': 'ox-form-card-body' }, [
								E('div', { 'class': 'ox-form-row' }, [
									E('div', { 'class': 'ox-form-label-col' }, [
										E('span', { 'class': 'ox-form-label' }, _('Accept Remote Subnet Routes')),
										E('span', { 'class': 'ox-form-hint' }, _('Automatically inject published remote subnets into local routing table'))
									]),
									E('div', { 'class': 'ox-form-field-col' }, [
										E('input', { 'type': 'checkbox', 'id': 'ts_accept_routes', 'checked': (settings.accept_routes !== '0' ? '' : null) })
									])
								]),
								E('div', { 'class': 'ox-form-row' }, [
									E('div', { 'class': 'ox-form-label-col' }, [
										E('span', { 'class': 'ox-form-label' }, _('Site-to-Site Transparent SNAT')),
										E('span', { 'class': 'ox-form-hint' }, _('Disable subnet SNAT to preserve original IP addresses'))
									]),
									E('div', { 'class': 'ox-form-field-col' }, [
										E('input', { 'type': 'checkbox', 'id': 'ts_disable_snat_subnet_routes', 'checked': (settings.disable_snat_subnet_routes === '1' ? '' : null) })
									])
								]),
								E('div', { 'class': 'ox-form-row' }, [
									E('div', { 'class': 'ox-form-label-col' }, [
										E('label', { 'class': 'ox-form-label', 'for': 'ts_exit_node' }, _('Use Remote Exit Node'))
									]),
									E('div', { 'class': 'ox-form-field-col' }, [
										E('select', { 'id': 'ts_exit_node' }, [
											E('option', { 'value': '', 'selected': !settings.exit_node }, _('Do not use exit node (Direct)')),
											...peerKeys.filter(function(k) { return peers[k].exit_node_option; }).map(function(k) {
												const p = peers[k];
												const ip = p.ipv4 || p.ip.split('<br>')[0];
												const label = p.hostname + ' (' + ip + ')' + (!p.online ? ' [' + _('Offline') + ']' : '');
												return E('option', { 'value': ip, 'selected': (settings.exit_node === ip) }, label);
											})
										])
									])
								]),
								E('div', { 'class': 'ox-form-row' }, [
									E('div', { 'class': 'ox-form-label-col' }, [
										E('span', { 'class': 'ox-form-label' }, _('Allow LAN Access from Exit Node')),
										E('span', { 'class': 'ox-form-hint' }, _('Allow direct access to local LAN when using an exit node'))
									]),
									E('div', { 'class': 'ox-form-field-col' }, [
										E('input', { 'type': 'checkbox', 'id': 'ts_exit_node_allow_lan_access', 'checked': (settings.exit_node_allow_lan_access !== '0' ? '' : null) })
									])
								])
							])
						])
					])
				])
			]),

			/* Panel 4: Firewall & Security */
			E('div', { 'class': 'ox-tab-panel', 'id': 'ox-panel-security' }, [
				E('div', { 'class': 'ox-panel-shell' }, [
					E('div', { 'class': 'ox-form-grid' }, [
						E('div', { 'class': 'ox-form-card' }, [
							E('div', { 'class': 'ox-form-card-head' }, [
								E('div', {}, [
									E('h3', { 'class': 'ox-form-card-title' }, _('Firewall4 Zone Policies')),
									E('div', { 'class': 'ox-form-card-desc' }, _('Manage OpenWrt Firewall4 zone rules safely and non-destructively'))
								]),
								E('button', {
									'class': 'btn cbi-button cbi-button-action',
									'click': function(ev) {
										ev.preventDefault();
										self.handleFixFirewall(this);
									}
								}, _('Repair Rules'))
							]),
							E('div', { 'class': 'ox-form-card-body' }, [
								E('div', { 'class': 'ox-form-row' }, [
									E('div', { 'class': 'ox-form-label-col' }, [
										E('span', { 'class': 'ox-form-label' }, _('Tailscale to LAN Access')),
										E('span', { 'class': 'ox-form-hint' }, _('Allow remote Tailscale clients to access router LAN'))
									]),
									E('div', { 'class': 'ox-form-field-col' }, [
										E('input', { 'type': 'checkbox', 'id': 'ts_ac_lan', 'checked': (settings.ac_lan !== '0' ? '' : null) })
									])
								]),
								E('div', { 'class': 'ox-form-row' }, [
									E('div', { 'class': 'ox-form-label-col' }, [
										E('span', { 'class': 'ox-form-label' }, _('LAN to Tailscale Access')),
										E('span', { 'class': 'ox-form-hint' }, _('Allow LAN clients to connect to remote Tailscale devices'))
									]),
									E('div', { 'class': 'ox-form-field-col' }, [
										E('input', { 'type': 'checkbox', 'id': 'ts_lan_ts', 'checked': (settings.lan_ts !== '0' ? '' : null) })
									])
								]),
								E('div', { 'class': 'ox-form-row' }, [
									E('div', { 'class': 'ox-form-label-col' }, [
										E('span', { 'class': 'ox-form-label' }, _('Tailscale to WAN Access')),
										E('span', { 'class': 'ox-form-hint' }, _('Allow exit node traffic forwarding to public WAN'))
									]),
									E('div', { 'class': 'ox-form-field-col' }, [
										E('input', { 'type': 'checkbox', 'id': 'ts_ac_wan', 'checked': (settings.ac_wan === '1' ? '' : null) })
									])
								]),
								E('div', { 'class': 'ox-form-row' }, [
									E('div', { 'class': 'ox-form-label-col' }, [
										E('span', { 'class': 'ox-form-label' }, _('Allow WAN Direct Punching (UDP)')),
										E('span', { 'class': 'ox-form-hint' }, _('Open Tailscale UDP listen port on WAN zone to enable direct P2P connections instead of DERP relay'))
									]),
									E('div', { 'class': 'ox-form-field-col' }, [
										E('input', { 'type': 'checkbox', 'id': 'ts_allow_wan_udp', 'checked': (settings.allow_wan_udp !== '0' ? '' : null) })
									])
								])
							])
						]),
						E('div', { 'class': 'ox-form-card' }, [
							E('div', { 'class': 'ox-form-card-head' }, [
								E('div', {}, [
									E('h3', { 'class': 'ox-form-card-title' }, _('DNS & Security Features')),
									E('div', { 'class': 'ox-form-card-desc' }, _('Configure MagicDNS resolution and inbound connection shields'))
								])
							]),
							E('div', { 'class': 'ox-form-card-body' }, [
								E('div', { 'class': 'ox-form-row' }, [
									E('div', { 'class': 'ox-form-label-col' }, [
										E('span', { 'class': 'ox-form-label' }, _('Enable MagicDNS')),
										E('span', { 'class': 'ox-form-hint' }, _('Forward Tailnet domain queries (e.g. *.ts.net) to 100.100.100.100 via dnsmasq'))
									]),
									E('div', { 'class': 'ox-form-field-col', 'style': 'flex:0 0 auto;' }, [
										E('input', { 'type': 'checkbox', 'id': 'ts_accept_dns', 'checked': (settings.accept_dns === '1' ? '' : null) })
									]),
									E('div', { 'class': 'ox-note ox-note-info ox-form-row-note' },
										_('Safe Mode: Only Tailnet domains are forwarded to 100.100.100.100 through dnsmasq. Your router /etc/resolv.conf, default ISP DNS, and proxy rules remain untouched.'))
								]),
								E('div', { 'class': 'ox-form-row' }, [
									E('div', { 'class': 'ox-form-label-col' }, [
										E('span', { 'class': 'ox-form-label' }, _('Enable Shields Up')),
										E('span', { 'class': 'ox-form-hint' }, _('Block all inbound connections from other mesh peers'))
									]),
									E('div', { 'class': 'ox-form-field-col' }, [
										E('input', { 'type': 'checkbox', 'id': 'ts_shields_up', 'checked': (settings.shields_up === '1' ? '' : null) })
									])
								]),
								E('div', { 'class': 'ox-form-row' }, [
									E('div', { 'class': 'ox-form-label-col' }, [
										E('span', { 'class': 'ox-form-label' }, _('Enable Outlierox SSH')),
										E('span', { 'class': 'ox-form-hint' }, _('Secure Tailscale-authenticated SSH access'))
									]),
									E('div', { 'class': 'ox-form-field-col' }, [
										E('input', { 'type': 'checkbox', 'id': 'ts_ssh', 'checked': (settings.ssh === '1' ? '' : null) })
									])
								])
							])
						])
					])
				])
			]),

			/* Panel 5: Advanced Flags */
			E('div', { 'class': 'ox-tab-panel', 'id': 'ox-panel-extra' }, [
				E('div', { 'class': 'ox-panel-shell' }, [
					E('div', { 'class': 'ox-form-grid' }, [
						E('div', { 'class': 'ox-form-card ox-full' }, [
							E('div', { 'class': 'ox-form-card-head' }, [
								E('div', {}, [
									E('h3', { 'class': 'ox-form-card-title' }, _('Advanced Flags & Parameters')),
									E('div', { 'class': 'ox-form-card-desc' }, _('Extra arguments passed to tailscale up/set on daemon startup'))
								])
							]),
							E('div', { 'class': 'ox-form-card-body' }, [
								E('div', { 'class': 'ox-form-row' }, [
									E('div', { 'class': 'ox-form-label-col' }, [
										E('label', { 'class': 'ox-form-label', 'for': 'ts_flags' }, _('Custom Startup Flags')),
										E('span', { 'class': 'ox-form-hint' }, _('Supports all official Tailscale CLI flags'))
									]),
									E('div', { 'class': 'ox-form-field-col' }, [
										E('textarea', {
											'id': 'ts_flags',
											'rows': 3,
											'placeholder': '--netfilter-mode=nodivert --operator=root',
											'style': 'font-family: var(--font-mono, monospace);'
										}, settings.flags || '')
									])
								]),
								E('div', { 'class': 'ox-form-row' }, [
									E('div', { 'class': 'ox-form-label-col' }, [
										E('label', { 'class': 'ox-form-label', 'for': 'ts_daemon_mtu' }, _('Virtual Interface MTU')),
										E('span', { 'class': 'ox-form-hint' }, _('Virtual tunnel MTU (Default: 1280)'))
									]),
									E('div', { 'class': 'ox-form-field-col' }, [
										E('input', { 'type': 'number', 'id': 'ts_daemon_mtu', 'value': settings.daemon_mtu || '1280' })
									])
								]),
								E('div', { 'class': 'ox-form-row' }, [
									E('div', { 'class': 'ox-form-label-col' }, [
										E('label', { 'class': 'ox-form-label', 'for': 'ts_reduce_memory' }, _('Memory Optimization Mode'))
									]),
									E('div', { 'class': 'ox-form-field-col' }, [
										E('select', { 'id': 'ts_reduce_memory' }, [
											E('option', { 'value': '0', 'selected': (settings.reduce_memory !== '1') }, _('Disabled (Standard Performance)')),
											E('option', { 'value': '1', 'selected': (settings.reduce_memory === '1') }, _('Enabled (Reduced GC Frequency)'))
										])
									])
								])
							])
						]),
						E('div', { 'class': 'ox-form-card ox-full ox-danger-card', 'style': 'background:color-mix(in srgb, var(--error-color-high) 4.5%, var(--background-color-high));' }, [
							E('div', { 'class': 'ox-form-card-body', 'style': 'padding:2px 16px;' }, [
								E('div', { 'class': 'ox-form-row', 'style': 'align-items:center;' }, [
									E('div', { 'class': 'ox-form-label-col' }, [
										E('span', { 'class': 'ox-form-label', 'style': 'color:var(--error-color-high);' }, _('Service Reset & Cache Cleanup')),
										E('span', { 'class': 'ox-form-hint' }, _('Clear Tailscale runtime node state, auth cache, and restart daemon'))
									]),
									E('div', { 'class': 'ox-form-field-col', 'style': 'flex:0 0 auto;' }, [
										E('button', {
											'class': 'btn cbi-button cbi-button-negative',
											'click': function(ev) {
												ev.preventDefault();
												if (!window.confirm(_('Are you sure you want to clean runtime cache and restart service?'))) return;
												const btn = this;
												const orig = btn.textContent;
												btn.disabled = true;
												btn.textContent = _('Resetting...');
												self.actionInProgress = true;
												callCleanupReset().then(function() {
													return Promise.all([callGetStatus(), callGetSettings()]);
												}).then(function(data) {
													self.refreshStatusUI(data[0], data[1]);
													self.showNote(_('Service cache cleared and restarted successfully.'), 'ok');
												}).catch(function(err) {
													self.showNote(cleanRpcError(err), 'err', true);
												}).finally(function() {
													self.actionInProgress = false;
													btn.disabled = false;
													btn.textContent = orig;
												});
											}
										}, _('Clean & Restart'))
									])
								])
							])
						])
					])
				])
			]),

			/* Panel 6: Logs */
			E('div', { 'class': 'ox-tab-panel', 'id': 'ox-panel-logs' }, [
				E('div', { 'class': 'ox-panel-shell' }, [
					E('div', { 'class': 'ox-log-panel' }, [
						E('div', { 'class': 'ox-log-head' }, [
							E('div', { 'class': 'ox-log-head-left' }, [
								E('h3', {}, _('Real-time Logs')),
								E('span', { 'class': 'ox-count-pill', 'id': 'ox_log_count' }, String(logs.length))
							]),
							E('div', { 'class': 'ox-log-tools' }, [
								E('select', {
									'id': 'ox_log_level',
									'change': function() { self.renderFilteredLogs(self.latestLogs); }
								}, [
									E('option', { 'value': 'all' }, _('All Levels')),
									E('option', { 'value': 'warn' }, _('Warnings & Errors')),
									E('option', { 'value': 'err' }, _('Errors Only'))
								]),
								E('input', {
									'type': 'text',
									'id': 'ox_log_search',
									'placeholder': _('Filter keyword...'),
									'input': function() { self.renderFilteredLogs(self.latestLogs); }
								}),
								E('button', {
									'class': 'btn cbi-button cbi-button-action',
									'click': function(ev) {
										ev.preventDefault();
										const btn = this;
										const orig = btn.textContent;
										btn.disabled = true;
										btn.textContent = _('Refreshing...');
										callGetLogs(200).then(function(res) {
											self.renderFilteredLogs(res?.logs || []);
										}).finally(function() {
											btn.disabled = false;
											btn.textContent = orig;
										});
									}
								}, _('Refresh')),
								E('button', {
									'class': 'btn cbi-button cbi-button-neutral',
									'click': function(ev) {
										ev.preventDefault();
										const body = document.getElementById('ox_log_body');
										if (body) body.scrollTop = 0;
									}
								}, _('Top')),
								E('button', {
									'class': 'btn cbi-button cbi-button-neutral',
									'click': function(ev) {
										ev.preventDefault();
										const body = document.getElementById('ox_log_body');
										if (body) body.scrollTop = body.scrollHeight;
									}
								}, _('Bottom')),
								E('button', {
									'class': 'btn cbi-button cbi-button-neutral',
									'click': function(ev) {
										ev.preventDefault();
										const btn = this;
										const body = document.getElementById('ox_log_body');
										if (body) {
											copyToClipboard(body.value).then(function(ok) {
												if (ok) {
													const orig = btn.textContent;
													btn.textContent = _('Copied');
													setTimeout(function() { btn.textContent = orig; }, 1500);
												}
											});
										}
									}
								}, _('Copy'))
							])
						]),
						E('div', { 'class': 'ox-log-body' }, [
							E('textarea', { 'class': 'ox-log-textarea', 'id': 'ox_log_body', 'readonly': 'readonly' }, '')
						])
					])
				])
			])
		]);

		setTimeout(function() {
			self.setServiceBadge(status, settings);
			self.restoreDefaultNote();
			self.renderFilteredLogs(logs);

			const tabItems = container.querySelectorAll('.ox-tabs > li');
			const panels = container.querySelectorAll('.ox-tab-panel');

			function switchTab(tabName) {
				const targetLi = container.querySelector('.ox-tabs > li[data-tab="' + tabName + '"]');
				const targetPanel = container.querySelector('#ox-panel-' + tabName);
				if (targetLi && targetPanel) {
					tabItems.forEach(function(t) { t.classList.remove('active'); });
					panels.forEach(function(p) { p.classList.remove('active'); });
					targetLi.classList.add('active');
					targetPanel.classList.add('active');
				}
			}

			tabItems.forEach(function(li) {
				const link = li.querySelector('a');
				if (link) {
					link.addEventListener('click', function(ev) {
						ev.preventDefault();
						const tabName = li.getAttribute('data-tab');
						switchTab(tabName);
						window.sessionStorage.setItem('outlierox_active_tab', tabName);
						history.replaceState(null, '', window.location.pathname + window.location.search + '#' + tabName);
					});
				}
			});

			const savedTab = (window.location.hash.replace(/^#/, '') || window.sessionStorage.getItem('outlierox_active_tab') || 'overview');
			if (savedTab && savedTab !== 'overview') {
				switchTab(savedTab);
			}

			poll.add(function() {
				if (self.actionInProgress) return Promise.resolve();
				const activePanel = container.querySelector('.ox-tab-panel.active');
				const isLogsActive = activePanel && activePanel.id === 'ox-panel-logs';
				const tasks = [callGetStatus(), callGetSettings()];
				if (isLogsActive) tasks.push(callGetLogs(200));

				return Promise.all(tasks).then(function(res) {
					if (self.actionInProgress) return;
					self.refreshStatusUI(res[0], res[1]);
					if (isLogsActive && res[2]) {
						self.renderFilteredLogs(res[2].logs || []);
					}
				}).catch(function() {
					/* silent poll error */
				});
			}, 5);
		}, 0);

		return container;
	},

	handleSaveApply: function(ev, mode) {
		const self = this;
		if (this.credSyncTimer) {
			clearTimeout(this.credSyncTimer);
			this.credSyncTimer = null;
		}
		const authInput = document.getElementById('ts_authKey');
		if (authInput) authInput.value = sanitizeCredValue(authInput.value);

		const formData = collectFormData();
		this.actionInProgress = true;

		return callSetSettings(formData)
			.then(function(res) {
				if (res && res.error) {
					throw new Error(res.error);
				}
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
				return Promise.all([callGetStatus(), callGetSettings()]);
			})
			.then(function(data) {
				self.refreshStatusUI(data[0], data[1]);
				self.showNote(_('Configuration saved and applied.'), 'ok');
			})
			.catch(function(err) {
				self.showNote(cleanRpcError(err), 'err', true);
			})
			.finally(function() {
				self.actionInProgress = false;
			});
	},

	handleSave: function(ev) {
		if (this.credSyncTimer) {
			clearTimeout(this.credSyncTimer);
			this.credSyncTimer = null;
		}
		const authInput = document.getElementById('ts_authKey');
		if (authInput) authInput.value = sanitizeCredValue(authInput.value);

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
		return ui.changes.revert().then(function() {
			window.location.reload();
		});
	}
});

function collectFormData() {
	const srv = document.getElementById('ts_login_server')?.value || '';
	const key = sanitizeCredValue(document.getElementById('ts_authKey')?.value || '');
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
		ac_lan: document.getElementById('ts_ac_lan')?.checked ? '1' : '0',
		lan_ts: document.getElementById('ts_lan_ts')?.checked ? '1' : '0',
		ac_wan: document.getElementById('ts_ac_wan')?.checked ? '1' : '0',
		allow_wan_udp: document.getElementById('ts_allow_wan_udp')?.checked ? '1' : '0',
		accept_dns: document.getElementById('ts_accept_dns')?.checked ? '1' : '0',
		shields_up: document.getElementById('ts_shields_up')?.checked ? '1' : '0',
		ssh: document.getElementById('ts_ssh')?.checked ? '1' : '0',
		flags: document.getElementById('ts_flags')?.value || '',
		daemon_mtu: document.getElementById('ts_daemon_mtu')?.value || '1280',
		reduce_memory: document.getElementById('ts_reduce_memory')?.value || '0'
	};
}
