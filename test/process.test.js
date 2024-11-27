import {vi, test, assert, expect, beforeEach, afterEach} from 'vitest'
import {process, initMem, open, close, hosts2groups, excludeGroups} from '../process.js'
import {start, reset} from '../globals.js'
import {Group} from '../data.js'
import flushPromises from 'flush-promises'

var tabs = []
var groups = []

global.chrome = {
    storage : {
        local : {
            get : vi.fn().mockReturnValue(new Promise((resolve) => {
                var mem = new Object()
                mem.groups = groups
                resolve(mem)
            })),
            set : vi.fn()
        }
    },
    tabs : {
        query : vi.fn().mockResolvedValue(tabs),
        update : vi.fn()
    },
    idle: {
        queryState : vi.fn().mockResolvedValue('active')
    },
    windows: {
        get : vi.fn().mockReturnValue(new Promise((resolve) => {
            var window = new Object()
            window.focused = true
            resolve(window)
        }))
    }
}

beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2024,0,20,12,0,0))
  })

afterEach(() => {
    vi.clearAllMocks()
    vi.useRealTimers()
})

test('Multiple hosts: 1 active and 1 audible', async () => {
    start()
    var startTime = epoch('01/20/2024 11:55:00')
    pushArr(groups, new Group(0, 'multiple hosts', ['host1', 'host2'], 0, 0, '0000', '2359', [0,1,2,3,4,5,6], startTime))
    pushArr(tabs, 
        {id: 0, active: true, audible: false, url: 'https://host1'},
        {id: 1, active: false, audible: true, url: 'https://host2'},
    )

    process()
    await flushPromises()
    
    expect(global.chrome.tabs.update).toBeCalledTimes(2)

    assert(global.chrome.tabs.update.mock.calls[0][0] == 1)
    assert(global.chrome.tabs.update.mock.calls[1][0] == 0)
})

test('Multiple hosts', async () => {
    start()
    var startTime = epoch('01/20/2024 11:55:00')
    pushArr(groups, new Group(0, 'multiple hosts', ['host1', 'host2'], 0, 0, '0000', '2359', [0,1,2,3,4,5,6], startTime))
    pushArr(tabs, 
        {id: 0, active: true, audible: false, url: 'https://host1'},
        {id: 1, active: false, audible: false, url: 'https://host2'},
    )
    process()
    await flushPromises()
    
    expect(global.chrome.tabs.update).toHaveBeenCalledOnce()
    assert(global.chrome.tabs.update.mock.calls[0][0] == 0)

    pushArr(tabs, 
        {id: 1, active: true, audible: false, url: 'https://host2'},
    )

    process()
    await flushPromises()

    assert(global.chrome.tabs.update.mock.calls[1][0] == 1)
})

test('Close group when there is no tab', async () => {
    start()
    var startTime = epoch('01/20/2024 11:55:00')
    pushArr(groups, new Group(0, 'host', ['host'], 10, 600, '0000', '2359', [0,1,2,3,4,5,6], startTime))
    pushArr(tabs)
    process()
    await flushPromises()

    var mem = global.chrome.storage.local.set.mock.calls[0][0]
    assert(mem['groups'][0].start == null)
    assert(mem['groups'][0].remaining == 300)
})

test('Close audio tab after duration is spent', async () => {
    start()
    var startTime = epoch('01/20/2024 07:00:00')
    pushArr(groups, new Group(0, 'host', ['host'], 10, 600, '0000', '2359', [0,1,2,3,4,5,6], startTime))
    groups[0].lastUpdated = epoch('01/20/2024 07:05')
    pushArr(tabs, {active: false, audible: true, id: 0, url: 'https://host'})
    process()
    await flushPromises()
    expect(global.chrome.tabs.update).toHaveBeenCalledOnce()
})

test('Close active tab after duration is spent', async () => {
    start()
    var startTime = epoch('01/20/2024 07:00:00')
    pushArr(groups, new Group(0, 'host', ['host'], 10, 600, '0000', '2359', [0,1,2,3,4,5,6], startTime))
    groups[0].lastUpdated = epoch('01/20/2024 07:05')
    pushArr(tabs, {active: true, audible: false, id: 0, url: 'https://host'})
    process()
    await flushPromises()
    expect(global.chrome.tabs.update).toHaveBeenCalledOnce()
})

test('Open active group after shutdown', async () => {
    reset()
    var start = epoch('01/20/2024 07:00:00')
    pushArr(groups, new Group(0, 'host', ['host'], 10, 600, '0000', '2359', [0,1,2,3,4,5,6], start))
    groups[0].lastUpdated = epoch('01/20/2024 07:05:00')
    pushArr(tabs, {active: false, audible: false, id: 0, url: 'https://host'})
    process()
    await flushPromises()
    expect(global.chrome.storage.local.set).toHaveBeenCalledOnce()
    var mem = global.chrome.storage.local.set.mock.calls[0][0]
    assert(mem['groups'][0].start != null)
    assert(mem['groups'][0].remaining == 300)
})

test('Open active group', async () => {
    start()
    pushArr(groups,new Group(0, 'host', ['host'], 0, 0, '0000', '2359', [0,1,2,3,4,5,6], null))
    pushArr(tabs, {active: true, audible: false, id: 0, url: 'https://host'})
    process()
    await flushPromises()
    expect(global.chrome.storage.local.set).toHaveBeenCalledOnce()
    var mem = global.chrome.storage.local.set.mock.calls[0][0]
    assert(mem['groups'][0].start != null)
})

test('excludeGroups method', () => {
    var g0 = new Group(0, 'group', [], 10, 600, '0000', '2359', [0,1,2,3,4,5,6], null)
    var g1 = new Group(1, 'group', [], 10, 600, '0000', '2359', [0,1,2,3,4,5,6], null)
    var g2 = new Group(2, 'group', [], 10, 600, '0000', '2359', [0,1,2,3,4,5,6], null)
    var groups = [g0, g1, g2]

    var selectedGroups = excludeGroups(groups, [g0, g2])
    assert(selectedGroups.length == 1)
    assert(selectedGroups.find(g => g.id == 1) != undefined)
})

test('hosts2groups method', () => {
    var g0 = new Group(0, 'group', ['h0', 'h1'], 10, 600, '0000', '2359', [0,1,2,3,4,5,6], null)
    var g1 = new Group(1, 'group', ['h2'], 10, 600, '0000', '2359', [0,1,2,3,4,5,6], null)
    var g2 = new Group(2, 'group', ['h3'], 10, 600, '0000', '2359', [0,1,2,3,4,5,6], null)
    var groups = [g0, g1, g2]

    var selectedGroups = hosts2groups(groups, ['h1', 'h2'])
    assert(selectedGroups.length == 2)
    assert(selectedGroups.find(g => g.id == 0) != undefined)
    assert(selectedGroups.find(g => g.id == 1) != undefined)
})

test('Open group', () => {
    var group = new Group(0, 'host', ['host'], 10, 600, '0000', '2359', [0,1,2,3,4,5,6], null)
    open(group)
    assert(group.start > 0)
})

test('Dont open group outside interval (no interval days)', () => {
    var group = new Group(0, 'host', ['host'], 10, 600, '0000', '2359', [], null)
    open(group)
    assert(group.start == null)
})

test('Close group', () => {
    var start = epoch('01/20/2024 11:55')
    var group = new Group(0, 'host', ['host'], 10, 600, '0000', '2359', [0,1,2,3,4,5,6], start)
    close(group)
    assert(group.start == null)
    assert(group.remaining == 300)
})

test('Deal with yesterday after restart', () => {
    var start = epoch('01/19/2024 12:00:00')
    var groups = [new Group(0, 'host', ['host'], 10, 300, '0000', '2359', [0,1,2,3,4,5,6], start)]
    initMem(groups)
    assert(groups[0].remaining == 600)
})

test('Deal with yesterday processing an open group', () => {
    var start = epoch('01/19/2024 12:00:00')
    var group = new Group(0, 'host', ['host'], 10, 300, '0000', '2359', [0,1,2,3,4,5,6], start)
    open(group)
    assert(group.remaining == 600)
})

test('Deal with yesterday processing a closed group', () => {
    var group = new Group(0, 'host', ['host'], 10, 300, '0000', '2359', [0,1,2,3,4,5,6], null)
    group.lastUpdated = epoch('01/19/2024 12:00')
    open(group)
    assert(group.remaining == 600)
})

function pushArr(arr, ...args) {
    arr.length = 0
    arr.push(...args)
}

function epoch(s) {
    return new Date(s).getTime()
}