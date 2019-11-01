var rules = { };
var badge = true;
var counters = { };
var tabs_to_update = new Set();
var timer_badge = false;
var timer_rules = false;
const types = ['script', 'xmlhttprequest', 'sub_frame', 'websocket', 'beacon', 'csp_report', 'ping', 'object'];

function* domains(hostname, all = false)
{
	for (let h = hostname; h.includes("."); h = h.slice(h.indexOf(".") + 1))
		yield h;
	if (all)
		yield "*";
}

function request_allow(origin, request, type)
{
	for (let from of domains(origin, true))
		if (rules.hasOwnProperty(from))
			for (let to of domains(request, true))
				if (rules[from].hasOwnProperty(to) && rules[from][to][type] != 2)
					return [1, 2, 0, 3][2 * (from == origin && to == request) + rules[from][to][type]];
	return (request == origin && origin != "*") || request.endsWith('.' + origin) ? 2 : 1;
}

function rule_update(rule)
{
	if (rule.length > 1 && rule[2] + rule[3] + rule[4] < 6)
	{
		if (!rules.hasOwnProperty(rule[0]))
			rules[rule[0]] = { };
		rules[rule[0]][rule[1]] = [rule[2], rule[3], rule[4]];
	}
	else if (rule.length > 1)
	{
		delete rules[rule[0]][rule[1]];
		if (Object.keys(rules[rule[0]]).length === 0)
			delete rules[rule[0]];
	}
	else if (typeof rule[0] === 'string')
	{
		delete rules[rule[0]];
	}
	else
	{
		rules = rule[0];
	}
	
	if (!timer_rules)
	{
		timer_rules = true;
		setTimeout(() => { timer_rules = false; browser.storage.local.set({ rules: rules }); }, 30000);
	}
}

function counters_init(tab_id, tab_url, hostname)
{
	for (let h of domains(hostname))
	{
		if (counters[tab_id][tab_url].hasOwnProperty(h))
			break;
		counters[tab_id][tab_url][h] = [0, 0, 0];
	}
}

function badge_update(tab_id, value = null, color = null)
{
	let counter = counters[tab_id][counters[tab_id].url];
	if (color !== null)
		browser.browserAction.setBadgeBackgroundColor({ color: color, tabId: tab_id });
	value = value !== null ? value : counter == undefined || counter.badge == 0 ? "" : counter.badge.toString();
	browser.browserAction.setBadgeText({ text: value, tabId: tab_id });
}

function timer_badge_update()
{
	timer_badge = false;
	for (let tab_id of tabs_to_update)
	{
		tabs_to_update.delete(tab_id);
		if (counters.hasOwnProperty(tab_id) && counters[tab_id].enabled)
			badge_update(tab_id);
	}
}

function handler_headers(request)
{
	let url = new URL(request.url);
	if (request.tabId != -1 && request.statusCode != 301 && request.statusCode != 302 && url.hostname.includes("."))
	{
		if (!counters.hasOwnProperty(request.tabId))
			counters[request.tabId] = { enabled: true };
		counters[request.tabId].url = url.origin + url.pathname + url.search;
		counters[request.tabId][counters[request.tabId].url] = { };
		Object.defineProperty(counters[request.tabId][counters[request.tabId].url], 'badge',
			{ value: 0, writable: true, enumerable: false });
		counters_init(request.tabId, counters[request.tabId].url, url.hostname);
		
		if (counters[request.tabId].enabled && request_allow(url.hostname, url.hostname, 0) < 2)
		{
			request.responseHeaders.push({ name: 'Content-Security-Policy', value: "script-src 'none';" });
			return { responseHeaders: request.responseHeaders };
		}
	}
	return { };
}

function handler_request(request)
{
	if (!counters.hasOwnProperty(request.tabId))
		return { };
	
	let tab_url = new URL(request.frameId == 0 ? request.originUrl : counters[request.tabId].url);
	let hostname_origin = tab_url.hostname;
	let hostname_request = new URL(request.url).hostname;
	let request_type = [0, 1, 2, 1, 1, 1, 1, 2][types.indexOf(request.type)];
	tab_url = tab_url.origin + tab_url.pathname + tab_url.search;
	
	counters_init(request.tabId, tab_url, hostname_request);
	counters[request.tabId][tab_url][hostname_request][request_type] += 1;
	
	let canceled = counters[request.tabId].enabled && request_allow(hostname_origin, hostname_request, request_type) < 2;
	if (canceled)
	{
		counters[request.tabId][tab_url].badge += 1;
		if (badge)
		{
			tabs_to_update.add(request.tabId);
			if (!timer_badge)
			{
				timer_badge = true;
				setTimeout(timer_badge_update, 500);
			}
		}
	}
	return { cancel: canceled };
}

function handler_history(request)
{
	if (request.frameId == 0 && counters.hasOwnProperty(request.tabId))
	{
		let url = new URL(request.url); url = url.origin + url.pathname + url.search;
		if (counters[request.tabId].hasOwnProperty(counters[request.tabId].url))
			counters[request.tabId][url] = counters[request.tabId][counters[request.tabId].url];
		counters[request.tabId].url = url;
	}
}

function handler_committed(request)
{
	if (request.frameId == 0)
	{
		if (!counters.hasOwnProperty(request.tabId))
			counters[request.tabId] = { enabled: true };
		let url = new URL(request.url);
		counters[request.tabId].url = url.origin + url.pathname + url.search;
		if (!counters[request.tabId].enabled)
			badge_update(request.tabId, "!", "#B60200");
		else if (badge)
			badge_update(request.tabId);
	}
}

function handler_tab_removed(tab_id, remove_info)
{
	delete counters[tab_id];
}

function handler_message(message)
{
	if (message.length == 1 && typeof message[0] === "number")
	{
		counters[message[0]].enabled = !counters[message[0]].enabled;
		let color = counters[message[0]].enabled ? "#4d4dff" : "#B60200";
		badge_update(message[0], !counters[message[0]].enabled ? "!" : badge ? null : "", color);
	}
	else
	{
		rule_update(message);
	}
}

browser.storage.local.get({ rules: { }, badge: true }).then(r => { rules = r.rules; badge = r.badge; });

browser.webRequest.onHeadersReceived.addListener(
	handler_headers, { urls: ["*://*/*"], types: ["main_frame"] }, ["blocking", "responseHeaders"]);
browser.webRequest.onBeforeRequest.addListener(handler_request, { urls: ["*://*/*"], types: types }, ["blocking"]);
browser.webNavigation.onHistoryStateUpdated.addListener(handler_history);
browser.webNavigation.onCommitted.addListener(handler_committed);
browser.tabs.onRemoved.addListener(handler_tab_removed);
browser.runtime.onMessage.addListener(handler_message);

browser.browserAction.setBadgeBackgroundColor({ color: "#4d4dff" });