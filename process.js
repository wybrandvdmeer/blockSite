import {log} from './log.js'

export function initMem(groups) {
    var save=false;
    for(const g of groups) {
        if(g.start != undefined) {
            if(beforeToday(g.start)) {
                log('Reset duration of group ' + g.name)
                g.remaining = g.duration * 60;
            } else if(g.lastUpdated != undefined) {
                var delta = Math.floor(g.lastUpdated - g.start);
                g.remaining = (g.remaining - delta);
                log('Init-mem(' + g.name + ', delta: ' + delta + ', rem: ' + g.remaining + ')');
            } else {
                log('Error: unexpected, no lastUpdated date of group ' + g.name)
            }
            
            g.start = null;
            save = true;
        }
    }

    return save
}

export function close(group) {
    if(!inActiveInterval(group) || group.start == null) {
        return false
    }

    var currentTime = getCurrentTime();
    group.remaining = group.remaining - Math.floor((currentTime - group.start)/1000);

    if(group.remaining < 0) {
        group.remaining = 0;
    }

    log('close(' + group.name + ', remaining: ' + group.remaining + ')');

    group.start = null;

    return true
}

export function open(group) {
    if(!inActiveInterval(group)) {
        return false
    }
    
    var currentTime = getCurrentTime();
    var open=false
    if(group.start != null && beforeToday(group.start) || group.start == null && beforeToday(group.lastUpdated)) {
        log('Reset duration of group ' + group.name)
        group.start = currentTime;
        group.remaining = group.duration * 60;
        open = true
    }  else if(group.start == null) {
        group.start = currentTime;
        open = true
    } 

    group.lastUpdated = currentTime
          
    if(open) {
        log('open(' + group.name + ', start: ' + group.start + ')');
    }

    return true
}

export function hosts2groups(groups, hosts) {
    return groups.filter(g => g.sites.filter(s => hosts.indexOf(s) >= 0).length > 0)
}

export function excludeGroups(groups, excluding) {
    return groups.filter(g => excluding.find(e => e.id == g.id) == undefined)
}

function beforeToday(ts) {
    return ts < new Date(new Date().toDateString()).getTime();
}

export function remainingDuration(group) {
    var remaining;
    if(group.start == null) {
        remaining = group.remaining
    } else  {
        remaining = group.remaining - Math.floor((new Date().getTime() - group.start)/1000);
    }
    log('Remaining duration(' + group.name + '): ' + remaining);
    return remaining;
}

export function redirect(tabId) {
    chrome.tabs.update(tabId, {url : "ui/blocked.html"});
}

export function inActiveInterval(group) {
    var d = new Date();
    var begin = Number(group.begin.slice(0,2)) * 60 + Number(group.begin.slice(2));
    var end = Number(group.end.slice(0,2)) * 60 + Number(group.end.slice(2))
    var current = d.getHours() * 60 + d.getMinutes();

    if(current < begin || current > end) {
        return false;
    }

    if(group.days == undefined || group.days.find(e => e == d.getDay()) != undefined) {
        return true;
    }

    return false;
}

function getCurrentTime() {
    return new Date().getTime();
}