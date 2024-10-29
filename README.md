# blockSite

design choice:

It is not possible to check via Chrome if tab is visible to user. So when there are multiple chrome 
windows (which mean multiple active tabs), we cannot detect which tab is relevant to the user.
So we treat all active tabs as relevant to the user.