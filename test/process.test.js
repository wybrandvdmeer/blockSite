import { test, assert} from 'vitest'
import {initMem, open, close, hosts2groups, excludeGroups} from '../process.js'
import {Group} from '../data.js'

function getCurrentTime() {
    return new Date().getTime();
}

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

test('Open record', () => {
    var group = new Group(0, 'host', ['host'], 10, 600, '0000', '2359', [0,1,2,3,4,5,6], null)
    open(group)
    assert(group.start > 0)
})

test('Dont open record outsite interval', () => {
    var group = new Group(0, 'host', ['host'], 10, 600, '0000', '2359', [], null)
    open(group)
    assert(group.start == null)
})

test('Close record', () => {
    var start = getCurrentTime() - 5 * 1000
    var group = new Group(0, 'host', ['host'], 10, 600, '0000', '2359', [0,1,2,3,4,5,6], start)
    close(group)
    assert(group.start == null)
    assert(group.remaining == 595)
})

test('Deal with yesterday after restart', () => {
    var start = getCurrentTime() - 24 * 60 * 60 * 1000
    var groups = [new Group(0, 'host', ['host'], 10, 300, '0000', '2359', [0,1,2,3,4,5,6], start)]
    initMem(groups)
    assert(groups[0].remaining == 600)
})

test('Deal with yesterday processing an open record', () => {
    var start = getCurrentTime() - 24 * 60 * 60 * 1000
    var group = new Group(0, 'host', ['host'], 10, 300, '0000', '2359', [0,1,2,3,4,5,6], start)
    open(group)
    assert(group.remaining == 600)
})

test('Deal with yesterday processing a closed record', () => {
    var group = new Group(0, 'host', ['host'], 10, 300, '0000', '2359', [0,1,2,3,4,5,6], null)
    group.lastUpdated = getCurrentTime() - 24 * 60 * 60 * 1000
    open(group)
    assert(group.remaining == 600)
})