{{/*
	Trigger: \A
	Trigger Type: Regex

	Usage:
	Limit this custom command to your counting channel and start counting :)
	
	Copyright (c): Joe_#2997 (creator) & @blackwolfwoof (modified) 2021
	License: MIT
	Repository: https://github.com/BlackWolfWoof/yagpdb-cc/
*/}}

{{$countingrole := 0}}
{{/*Set the countingrole to 0 or false if you don't want to give a role to the last user that counted*/}}
{{$antiad := true}}
{{/*This prevents users with discord servers in their status to get hoised*/}}
{{$sameuser := true}}
{{/*If set to false the same user cannot count multiple times in a row*/}}
{{$countingtracker := true}}
{{/*If set to true it will keep track of who counted how often*/}}
{{/*Make sure to also add the 'Pagination', 'Leaderboard' and 'Counter' code when setting this to true*/}}




{{$dbcount := dbCount}}{{$_ := 50}}{{if .IsPremium}}{{$_ = 500}}{{end}}
{{$db := sdict "counter" 0 "lastCounter" 0 "countingrole" 0}}{{with dbGet 2000 "counting"}}{{$db = .Value}}{{end}}
{{/*Converter for a bug fix*/}}
{{with dbGet 2000 "counting_counter"}}
	{{$db.Set "counter" (toInt .Value)}}
	{{$db.Set "lastCounter" (toInt (dbGet 2000 "lastCounter").Value|add -1)}}
	{{$db.Set "countingrole" (toInt (dbGet 2000 "countingrole").Value)}}
	{{dbSet 2000 "counting" $db}}
	{{dbDel 2000 "counting_counter"}}
	{{dbDel 2000 "lastCounter"}}
	{{dbDel 2000 "countingrole"}}
{{end}}

{{/*Channel Topic*/}}
{{define "topic"}}
	{{$unix := currentTime.Unix}}
	{{with (reFindAllSubmatches `Next possible edit: <t:(\d+):[RT]>` .Channel.Topic)}}
		{{$unix = index . 0 1}}
	{{end}}
	{{if and (ge currentTime.Unix (toInt $unix)) (dbGet 2000 "cc_edit_cooldown"|not)}}
		{{dbSetExpire 2000 "cc_edit_cooldown" true 10}}
		{{$topic := ""}}
		{{if .ct}}
			{{$topic = print $topic "\nUsers that counted: " (dbCount "counting_tracker")}}
			{{if .IsPremium}}
				{{range dbTopEntries "counting_tracker" 1 0}}{{$topic = print $topic "\nTop user: <@" .UserID "> - " .Value "x"}}{{end}}
			{{end}}
			{{$topic = print $topic "\nDatabase filled: " (fdiv (mult (mult .Guild.MemberCount .us|fdiv .dbc) 10000|roundCeil) 100) "%"}}
		{{end}}
		{{editChannelTopic nil (print "🗒️ YAGPDB counting channel\n\n**Stats:**\nCurrent number: " .current $topic "\n\n*The channel topic can only update every 15 minutes if someone counts*\nNext possible edit: <t:" (toDuration "15m"|currentTime.Add).Unix ":T>\n\nIf you are interested in adding this code to your own server visit https://github.com/BlackWolfWoof/yagpdb-cc/tree/master/Counting")}}
	{{else}}
		{{scheduleUniqueCC .CCID nil (sub $unix currentTime.Unix) "counting_cc" "channelname"}}
	{{end}}
{{end}}

{{$current := add 1 $db.counter}}
{{if not .ExecData}}
	{{if or (reFind `^\d+$` .Message.Content|not) (ne (str $current) .Message.Content)}}
		{{/*Wrong number*/}}
		{{$x := sendMessageRetID nil (print .User.Mention ", that was the wrong number https://tenor.com/view/memes-wrong-number-sike-gif-13837863 **The next number is** " $current)}}
		{{deleteMessage nil $x 25}}
		{{deleteTrigger 1}}
	{{else if and (eq .User.ID $db.lastCounter) (not $sameuser)}}
		{{/*$sameuser part*/}}
		{{$x := sendMessageRetID nil (print .User.Mention ", you cannot count twice in a row!")}}
		{{deleteMessage nil $x 5}}
		{{deleteTrigger 1}}
	{{else}}
		{{/*Current counting number +1*/}}
		{{$db.Set "counter" $current}}

		{{/*If antiad on block counting role*/}}
		{{$blockrole := false}}
		{{if and $antiad (reFind `(?i)(discord(?:app)?\.gg(?:/|\\+/+)|discord(?:app)?\.com(?:/|\\+/+)(?:invite/))([A-z0-9-]{2,})` (index (exec "whois" .User.ID).Fields 6).Value)}}
			{{$blockrole = true}}
		{{end}}

		{{/*Countingrole part*/}}
		{{$sdict := sdict}}{{with (dbGet 0 "countingroleblock")}}{{$sdict = .Value}}{{end}}
		{{if and $countingrole ($sdict.Get (str .User.ID)|not)}}
			{{if not $blockrole}}
				{{addRoleID $countingrole}}
				{{if ne $db.countingrole .User.ID}}
					{{takeRoleID $db.countingrole $countingrole}}
				{{end}}
				{{$db.Set "countingrole" .User.ID}}
			{{end}}
		{{end}}
		{{$db.Set "lastCounter" .User.ID}}
		{{dbSet 2000 "counting" $db}}

		{{/*Counting tracker part*/}}
		{{if $countingtracker}}
			{{$num := 1}}{{with (dbGet .User.ID "counting_tracker")}}{{$num = toInt .Value|add 1}}{{end}}
			{{dbSet .User.ID "counting_tracker" (str $num)}}
			{{/*Database Anti overflow*/}}
			{{if ge (fdiv (mult (mult $.Guild.MemberCount $_|fdiv $dbcount) 10000|roundCeil) 100|toInt) 95}}
				{{execCC .CCID nil 0 "overflow"}}
			{{end}}
		{{end}}

		{{/*Channel Topic*/}}
		{{template "topic" (sdict "Channel" .Channel "IsPremium" .IsPremium "Guild" .Guild "CCID" .CCID "ct" $countingtracker "us" $_ "dbc" $dbcount "current" $current "ExecData" .ExecData)}}
	{{end}}
{{else if eq .ExecData "channelname"}}
	{{/*Channel topic*/}}
	{{template "topic" (sdict "Channel" .Channel "IsPremium" .IsPremium "Guild" .Guild "CCID" .CCID "ct" $countingtracker "us" $_ "dbc" $dbcount "current" (sub $current 1) "ExecData" .ExecData)}}
{{else}}
	{{/*Database Anti overflow*/}}
	{{if not (dbGet 2000 "counting_warning")}}
		{{dbSetExpire 2000 "counting_warning" true 604800}}
		{{sendMessage nil (complexMessage "content" (print "<@" $.Guild.OwnerID ">, a custom command requires your attention!") "embed" (cembed "title" "‼️The YAGPDB database is almost full‼️" "thumbnail" (sdict "url" "https://cdn.discordapp.com/emojis/565142262401728512.png") "description" (print "**The YAGPDB database is to " (fdiv (mult (mult .Guild.MemberCount $_|fdiv $dbcount) 10000|roundCeil) 100) "% full!\nTo ensure the functionality of thise code I will delete the counting trackers of the people who counted the least amount of times from now on.**\nTo stop that, please make sure the database isn't that full.\nIf you are unsure how to do that please join the [official support server](https://discord.gg/4udtcA5) and message `@blackwolfwoof` for help.") "color" 0xB62138))}}
	{{else}}
		{{range (dbBottomEntries "counting_tracker" 1 0)}}
			{{dbDel .UserID .Key}}
		{{end}}
	{{end}}
{{end}}
