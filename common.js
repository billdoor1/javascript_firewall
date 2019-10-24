var $ = document.getElementById.bind(document);
var request_allow = browser.extension.getBackgroundPage().request_allow;
const status = ['blocked', 'blocked_auto', 'allowed_auto', 'allowed'];

function compare_hostnames(a, b)
{
	return a.split(".").reverse() > b.split(".").reverse();
}

function td_change_rule(td, origin, request)
{
	td.className = status[[2, 3, 3, 0][status.indexOf(td.className)]];
	
	let id_prefix = td.id.slice(0, -1);
	let r = type => [0, 2, 2, 1][status.indexOf($(id_prefix + type).className)];
	let rule = [origin, request, r(0), r(1), r(2)];
	browser.runtime.sendMessage(rule).then(show_rules);
}