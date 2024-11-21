import {log, loggerEnabled, enableLogging} from './log.js'
import {IDLE_DETECTION_INTERVAL, start, started} from './globals.js'

var locks=[]

export async function process(tab) {
    /* To prevent multiple events from same tab initiating the same promise.
    */
    if(tab != undefined && !lock(tab)) {
        return
    }

    try {
        await process_impl()
    } finally {
        tab != undefined && unlock(tab)
    }
}

async function process_impl() {
    var mem = await chrome.storage.local.get('groups')
    var groups = mem['groups']
    if(groups.length == 0) {
        return
    }

    var saveStarted=false
    if(!started) {
        /* Turn logging on via group. */
        if(!loggerEnabled() && groups.map(g => g.name).filter(n => n == 'debug-group').length == 1) {
            enableLogging()
        }

        saveStarted = initMem(groups)
        start()
    }

    var tabs = await chrome.tabs.query({})
    var hosts2open = getAudibleHosts(tabs)

    var activeTab = await getActiveTabByQuery() // active tab from active window.

    /* Is there an active tab? 
    */
    if(activeTab != undefined) {
        var systemIsActive = await isSystemActive()
        log('System is active:' + systemIsActive)
        
        if(systemIsActive) { 
            var host = getHost(activeTab.url)
            if(host != undefined) {
                hosts2open.push(host)
            }
        }
    }
    
    var groups2open = hosts2groups(groups, hosts2open)

    var saveOpen=false
    groups2open.forEach(g => {
        if(open(g)) {
            saveOpen = true
        }
    })

    /* Close all other groups.
    */
    var saveClose=false

    excludeGroups(groups, groups2open).forEach(g => {
        if(close(g)) {
            saveClose = true
        }
    })

    if(saveStarted || saveOpen || saveClose) {
        await chrome.storage.local.set({'groups': groups})
    }

    redirectTabs(groups, tabs)
}

async function redirectTabs(groups, tabs) {
    var tabs2Check = getAudibleTabs(tabs)

    var activeTabs = tabs.filter((t) => t.active)
    for(var idx=0; idx < activeTabs.length; idx++) {
        if(await isWindowOfTabActive(activeTabs[idx])) {
            tabs2Check.push(activeTabs[idx])
        }
    }

    [...new Set(tabs2Check)].forEach(t => blockUrl(groups, t))
}

function lock(tab) {
    if(locks.includes(tab.id)) {
        return false
    }
    locks.push(tab.id)
    return true
}

function unlock(tab) {
    var pos = locks.indexOf(tab.id)
    if(pos >= 0) {
        locks.splice(pos,1)
    }
}

async function getActiveTabByQuery() {
    var tabs = await chrome.tabs.query({active: true, currentWindow: true})
    if(tabs.length == 1) {
        return tabs[0]
    }
    return undefined
}

function getAudibleTabs(tabs) {
    return tabs.filter(t => t.audible)
}

function getAudibleHosts(tabs) {
    return getAudibleTabs(tabs).map(t => getHost(t.url)).filter(h => h != undefined)
}

function getHost(url) {
    try {
        return new URL(url).host
    } catch(e) {
        return undefined
    }
}

function blockUrl(groups, tab) {
    var host = getHost(tab.url)
    log('blockUrl - check host ' + host)
    for(const g of groups) {
        var site = g.sites.find(e => e == host)
        if(site != undefined && inActiveInterval(g) && remainingDuration(g) <= 0) {
            log('redirect to block-page')
            redirect(tab.id)
            return
        }
    }
}

async function isWindowOfTabActive(tab) {
    var w = await chrome.windows.get(tab.windowId)
    return w.focused
}

async function isSystemActive() {
    var state = await chrome.idle.queryState(IDLE_DETECTION_INTERVAL)
    return state == 'active'
}

export function initMem(groups) {
    var save=false;
    for(const g of groups) {
        if(g.start != undefined) {
            if(beforeToday(g.start)) {
                log('Reset duration of group ' + g.name)
                g.remaining = g.duration * 60;
            } else if(g.lastUpdated != undefined) {
                var delta = Math.floor((g.lastUpdated - g.start)/1000);
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

function redirect(tabId) {
    chrome.tabs.update(tabId, {url : "ui/blocked.html"});
}

function inActiveInterval(group) {
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