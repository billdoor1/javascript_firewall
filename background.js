var rules = { };
var counters = { };
const types = ['script', 'xmlhttprequest', 'sub_frame', 'websocket'];
var enabled = true;

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
	browser.storage.local.set({ rules: rules });
}

function counters_init(tab_id, hostname)
{
	for (let h of domains(hostname))
	{
		if (counters[tab_id].hostnames.hasOwnProperty(h))
			break;
		counters[tab_id].hostnames[h] = [0, 0, 0];
	}
}

function handler_headers(request)
{
	let hostname = new URL(request.url).hostname;
	if (hostname.includes("."))
	{
		counters[request.tabId] = { origin: hostname, hostnames: { } };
		counters_init(request.tabId, hostname);
		
		if (enabled && request_allow(hostname, hostname, 0) < 2)
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

	let hostname_origin = counters[request.tabId].origin;
	let hostname_request = new URL(request.url).hostname;
	let request_type = [0, 1, 2, 1][types.indexOf(request.type)];

	counters_init(request.tabId, hostname_request);
	counters[request.tabId].hostnames[hostname_request][request_type] += 1;
	
	return { cancel: enabled && request_allow(hostname_origin, hostname_request, request_type) < 2 };
}

function handler_tab_removed(tab_id, remove_info)
{
	delete counters[tab_id];
}

function handler_message(message)
{
	if (message.length > 0)
	{
		rule_update(message);
	}
	else
	{
		enabled = !enabled;
		browser.browserAction.setBadgeText({ text: enabled ? "" : "!" });
	}
}

browser.storage.local.get({ rules: { } }).then(r => {
	rules = r.rules;
	
	browser.webRequest.onHeadersReceived.addListener(
		handler_headers, { urls: ["*://*/*"], types: ["main_frame"] }, ["blocking", "responseHeaders"]);
	browser.webRequest.onBeforeRequest.addListener(handler_request, { urls: ["*://*/*"], types: types }, ["blocking"]);
	browser.tabs.onRemoved.addListener(handler_tab_removed);
	browser.runtime.onMessage.addListener(handler_message);
	
	browser.browserAction.setBadgeBackgroundColor({ color: "#B60200" });
});