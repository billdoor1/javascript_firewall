let rules = null;
const text = ["no", "yes", "auto"];
const regex_valid = /^[a-z0-9]+([-.][a-z0-9]+)*\.[a-z0-9]+$/;

function td_click(event)
{
	td_change_rule(event.currentTarget, ...event.currentTarget.id.split('/', 2));
}

function save()
{
	let new_rules = { };
	let valid = x => x == "*" || regex_valid.test(x);
	for (let rule of $("textarea").value.split('\n'))
	{
		rule = rule.trim().split(' ');
		if (rule.length == 5 && valid(rule[0]) && valid(rule[1]))
		{
			[2, 3, 4].forEach(i => rule[i] = text.indexOf(rule[i]));
			if (rule[2] != -1 && rule[3] != -1 && rule[4] != -1 && rule[2] + rule[3] + rule[4] < 6)
			{
				if (!new_rules.hasOwnProperty(rule[0]))
					new_rules[rule[0]] = { };
				new_rules[rule[0]][rule[1]] = [rule[2], rule[3], rule[4]];
			}
		}
	}
	browser.runtime.sendMessage([new_rules]).then(show);
}

function show_rules()
{
	let search = $("search").value;
	let table_rules = $("rules");
	table_rules.innerHTML = '';
	
	for (let origin of Object.keys(rules).sort(compare_hostnames))
	{
		let border = 'domain';
		for (let request of Object.keys(rules[origin]).sort(compare_hostnames))
		{
			if (origin.includes(search) || request.includes(search))
			{
				let colors = [0, 1, 2].map(i => status[request_allow(origin, request, i)]);
				let tr = document.createElement("tr");
				tr.innerHTML = `<td class="hostname ${border}">${origin}</td>
					<td class="hostname ${border}">${request}</td>
					<td class="${colors[0]}" id="${origin}/${request}/0"></td>
					<td class="${colors[1]}" id="${origin}/${request}/1"></td>
					<td class="${colors[2]}" id="${origin}/${request}/2"></td>`;
				table_rules.appendChild(tr);
				[0, 1, 2].forEach(i => $(`${origin}/${request}/${i}`).onclick = td_click);
				border = '';
			}
		}
	}
}

function show_rules_text()
{
	$("textarea").value = '';
	for (let origin of Object.keys(rules).sort(compare_hostnames))
		for (let request of Object.keys(rules[origin]).sort(compare_hostnames))
			$("textarea").value += [origin, request, ...rules[origin][request].map(i => text[i])].join(' ') + '\n';
}

function show()
{
	rules = browser.extension.getBackgroundPage().rules;
	$("table").classList.add("hidden");
	$("text").classList.add("hidden");
	$($("mode").value).classList.remove("hidden");
	
	if ($("mode").value == "table")
		show_rules();
	else
		show_rules_text();
}

if (background === null)
{
	$("error_private").classList.remove("hidden");
	$("options").classList.add("hidden");
}
else
{
	$("mode").onchange = show;
	$("search").oninput = show_rules;
	$("save").onclick = save;
	let option_badge = $("option_badge");
	option_badge.checked = browser.extension.getBackgroundPage().badge;
	option_badge.onchange = () => browser.runtime.sendMessage([]);
	show();
}