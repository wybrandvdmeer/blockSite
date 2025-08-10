import {Group} from '../../data.js'
import {remainingDuration} from '../../process.js'

function html(groups) {
	if(groups == undefined) {
		return;
	}

    var groupsElement = document.getElementById('groups');
    for(const g of groups) {
        groupsElement.insertAdjacentHTML("afterbegin", group(g));
		
		document.getElementById('update-' + g.id).addEventListener('click', async (e) => {
			if(updateGroup(g, g.id)) {
  	 	 		chrome.storage.local.set({'groups': groups}).then(() => {
					localStorage.setItem('scrollPosition', window.scrollY)
					location.reload()
				})
			}
		})

		document.getElementById('delete-' + g.id).addEventListener('click', async (e) => {
			deleteGroup(groups, g.id);
		});
    }
    
	var newGroup = document.getElementById('new-group');
	document.getElementById('add-group').addEventListener('click', () => {
		newGroup.classList.add('show');
    });
		
	document.getElementById('update-new').addEventListener('click', async (e) => {
		var idx=0
		if(groups.length != 0) {
			idx = groups.map(g => g.id).reduce((max, curr) => Math.max(max, curr), -Infinity) + 1
		}

    	var group = new Group(idx);
		if(updateGroup(group, 'new')) {
			groups.push(group);
  	  		chrome.storage.local.set({'groups': groups}).then(() => {
				localStorage.setItem('scrollPosition', window.scrollY)
				location.reload()
			})
		}
	})
	document.getElementById('delete-new').addEventListener('click', (e) => {
		location.reload();
	})
	
	var remainingElementNew = document.getElementById('remaining-new');
	var durationElementNew = document.getElementById('duration-new');
	durationElementNew.addEventListener('input', (e) => {
		remainingElementNew.value = durationElementNew.value * 60;
	})

	var scrl = localStorage.getItem('scrollPosition')
	localStorage.removeItem('scrollPosition')
	if(scrl) {
		window.scrollTo(0, parseInt(scrl))
	}
}

function updateGroup(group, id) {
	var nameElement = document.getElementById('name-' + id)
	var beginElement = document.getElementById('begin-' + id);
	var endElement = document.getElementById('end-' + id);
	var sitesElement = document.getElementById('sites-' + id)
	var durationElement = document.getElementById('duration-' + id)

	removeError([nameElement,
		beginElement,
		endElement,
		sitesElement,
		durationElement])

	if(nameElement.value == undefined || nameElement.value.length == 0) {
		addError([nameElement])
		return false;
	}

	group.name = nameElement.value;

	if(!validDuration(durationElement.value)) {
		addError([durationElement]);
		return false;
	}

	if(group.duration != durationElement.value) {
		group.duration = durationElement.value;
		group.remaining = group.duration * 60;
		group.start = undefined
	}
			
	var begin,end;
	if(!validTime(beginElement.value)) {
		addError([beginElement]);
		return false;
	}

	begin = beginElement.value;

	if(!validTime(endElement.value)) {
		addError([endElement]);
		return false;
	}

	end = endElement.value;

	if(Number(end) - Number(begin) <= 0) {
		addError([beginElement, endElement]);
		return false;
	}

	group.begin = begin
	group.end = end

	var sites = sitesElement.value.split(/\s+/).filter(s => s.length > 0);
	if(sites == undefined || sites.length == 0) {
		addError([sitesElement]);
		return false;
	}

	group.sites = sites

	group.days = [];
	['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'].forEach((d,pos) => {
		if(document.getElementById(d + '-' + id).checked) {
			group.days.push(pos);
		}
	});

	if(group.start == undefined) {
		group.start = null;
	}
	return true;
}

function addError(elements) {
	elements.forEach(e => e.classList.add('error'));
}

function removeError(elements) {
	elements.forEach(e => e.classList.remove('error'));
}

function validDuration(value) {
	if(value == undefined) {
		return false;
	}

	if(!(/^\d+$/.test(value))) {
		return false;
	}

	var duration = Number(value);
	if(duration < 0 || duration > 1440) {
		return false;
	}
	return true;
}

function validTime(value) {
	if(value == undefined) {
		return false;
	}

	if(!(/^\d\d\d\d$/.test(value))) {
		return false;
	}

    var hour = Number(value.slice(0,2));
	if(hour < 0 || hour > 23) {
		return false;
	} 
    
	var minutes = Number(value.slice(2));
	if(minutes < 0 || minutes > 59) {
		return false;
	}
	return true;
}

function deleteGroup(groups, id) {
	for(var idx=0; idx < groups.length; idx++) {
		if(groups[idx].id == id) {
			groups.splice(idx, 1);
			break;
		}
	}
    chrome.storage.local.set({'groups': groups}).then(location.reload());
}

function printSites(sites) {
	var line='';
	if(sites == undefined) {
		return line
	}

	for(const s of sites) {
		line += (s + '\n');
	}
	return line;
}

function isChecked(days, day) {
	return days != undefined && days.find(e => e == day) != undefined ? 'checked' : '';
}

function group(group) {
    return "<div class='square'> \
                <div> \
	            <label>Name</label> \
	            <br/> \
	            <input type='text' id='name-" + group.id + "' value='" + group.name + "' /> \
	            <br/> \
	            <br/> \
	            <label>Sites</label> \
	            <br/> \
	            <textarea cols='20' rows='5' id='sites-" + group.id + "'>" + printSites(group.sites) + "</textarea> \
	            <br/> \
	            <br/> \
	            <label>Duration</label> \
	            <input title='In minutes' type='text' id='duration-" + group.id + "' value='" + group.duration + "' class='time'/> \
	            <br/> \
	            <br/> \
	            <label>Remaining</label> \
	            <input title='In minutes' disabled type='text' id='remaining-" + group.id + "' value='" + Math.ceil(remainingDuration(group)/60) + "' class='time'/> \
	            <br/> \
	            <br/> \
	            <label>Begin</label> \
	            <input type='text' id='begin-" + group.id + "' value='" + group.begin + "' class='time'/> \
	            <label>End</label> \
	            <input type='text' id='end-" + group.id + "' value='" + group.end + "'class='time'/> \
	            <br/> \
	            <br/> \
	            Sun Mon Tue Wed Thu Fri Sat \
	            <br/> \
	            <input type='checkbox' id='sun-" + group.id + "' " + isChecked(group.days, 0) + "/> \
	            <input type='checkbox' id='mon-" + group.id + "' " + isChecked(group.days, 1) + " /> \
	            <input type='checkbox' id='tue-" + group.id + "' " + isChecked(group.days, 2) + "/> \
	            <input type='checkbox' id='wed-" + group.id + "' " + isChecked(group.days, 3) + " /> \
	            <input type='checkbox' id='thu-" + group.id + "' " + isChecked(group.days, 4) + " /> \
	            <input type='checkbox' id='fri-" + group.id + "' " + isChecked(group.days, 5) + " /> \
	            <input type='checkbox' id='sat-" + group.id + "' " + isChecked(group.days, 6) + " /> \
	            <br/> \
	            <br/> \
				<div class='editbuttons'> \
	            	<button id='update-" + group.id + "'>update</button> \
	            	<button id='delete-" + group.id + "'>delete</button> \
				</div> \
	            <br/> \
	            </div> \
	        </div><br/>";
}

chrome.storage.local.get('groups').then(g => html(g['groups']))

