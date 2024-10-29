export class Group {
	constructor(id, name, sites, duration, remaining, begin, end, days, start, lastUpdated) {
		this.id = id;
		this.name = name;
		this.sites = sites;
		this.duration = duration;
		this.remaining = remaining;
		this.begin = begin;
		this.end = end;
		this.days = days;
		this.start = start;
		this.lastUpdated = lastUpdated;
	}
}
