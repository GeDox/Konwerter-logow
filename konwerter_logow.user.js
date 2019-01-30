// ==UserScript==
// @name         	Konwerter logów
// @namespace    	http://tampermonkey.net/
// @version      	3.3
// @description  	Szybki konwerter logów pojazdów
// @author       	Przemysław "Szemek/GeDox" Kozłowski
// @match        	*://net4game.com/group/*/dashboard/
// @grant        	GM_addStyle
// @run-at 			document-end
// @updateURL		https://github.com/GeDox/Konwerter-logow/raw/master/konwerter_logow.user.js
// ==/UserScript==

GM_addStyle('.tm_bold { font-weight: bold }');
GM_addStyle('.tm_green { color: green }');
GM_addStyle('.tm_orange { color: orange }');
GM_addStyle('.tm_red { color: red }');
GM_addStyle('div pre { white-space: pre-wrap }');

var tabela = $$('[summary="Pojazdy"]');
$$('[summary="Pojazdy"] tbody tr').each(function(i, v) {
    if(v === 0) {
        return i.insert('<th class="short" scope="col">Logi</th>');
    }

    var url = i.cells[0].childNodes[0].attributes.href.value;

    i.insert('<td class="short"> <input type="button" class="input_submit sprawdzLogi" data-href="'+url+'" data-id="'+v+'" value="Sprawdź"> </td>');
    tabela[0].insertRow(v*2).writeAttribute('id', v).insert('');//.hide();
});


$$('.sprawdzLogi').invoke('observe','click', function(event) {
    var wiersze = $$('[summary="Pojazdy"] tbody tr');
    var url = this.readAttribute('data-href');
    var id = this.readAttribute('data-id');
    
    new Ajax.Request(url, {
        onSuccess: function(response) {
            wiersze[id*2].update( parseLogs(response.responseText) );
        }
    });
});


document.body.on("click", ".tm_close", function(event, target) {
	target.up(2).remove();
});

function parseLogs(logs) {
	var driver = "";
	
    logs = logs.replace('<if count="Array">', '').replace('</if>', '').split('<pre>').join('<pre>\n').split("\n");
    
	logs.each(function(v, i) {
		if(v.indexOf('Dzisiaj') >= 0) {
			logs[i] = v.replace('Dzisiaj', 'Dzisiaj <span style="float: right" class="tm_close tm_bold tm_red">[ukryj]</span>');
		}
		
		var cars = v.toLowerCase().indexOf('[cars]');
		if(cars >= 0) {
			var entered = v.indexOf('Entered vehicle');
			var exited = v.indexOf('Exited vehicle');
			var panels = v.indexOf('[Damage][Panels]');
            var hp = v.indexOf('[Damage][HP]');
			var death = v.indexOf('[CARS][Damage][Death][VProtection]');
			var upsidedown = v.indexOf('Exits an upside down vehicle');
			var usun = true;
			
			if(entered >= 0 && v.indexOf('seat 0') >= 0) {
				var fuel = v.substr( v.indexOf('fuel ')+5, 3).replace(')', '');
				driver = v.substr(cars+8, entered-cars-10);
				logs[i] = v.substr(0, entered-1).replace(' [cars]', '') + ' Wejście na fotel <b>kierowcy pojazdu</b>. Ilość paliwa: <b>'+fuel+'%</b>';
				usun = false;
			} else if(exited >= 0 && v.indexOf('os2') >= 0) {
				driver = "-";
			} else if(panels >= 0) {
				var str = parsePanels(v);
				
				if(str.length) {
					logs[i] = v.substr(0, panels-8) + ' <b>Uszkodzenie części</b> [kierowca: <b>'+driver+'</b>]: [ '+str+' ]';
					usun = false;
				}
            } else if(hp >= 0) {
                logs[i] = v.substr(0, hp-7) + '<b>Uszkodzenie pojazdu</b> [ostatni kierowca: <b>'+driver+'</b>]: '+parseHp(v);
				usun = false;
            } else if(upsidedown >= 0) {
				logs[i] = v.substr(0, upsidedown-1).replace(' [cars]', '') + ' <b><span class="tm_bold tm_red">POJAZD JEST NA DACHU</span></b>';
				usun = false;
			} else if(death >= 0) {
				var x = v.split('; ');
				x[1] = x[1].replace('Last driver: UID ', '');
				x[3] = x[3].split(', ');
				console.log(v);
				logs[i] = logs[i].substr(0, 10) + ' <span class="tm_bold tm_red">***</span> <b>Zniszczenie pojazdu</b>: <a href="https://net4game.com/index.php?app=hrp&module=online&section=characterDetails&char='+x[1]+'" target="_blank">ostatni kierowca</a>, <a href="https://n4gmap.kozioldev.eu/?x='+x[3][0].substr(9)+'&y='+x[3][1]+'" target="_blank">miejsce wybuchu</a>.';
				usun = false;
			}
			
			if(usun) {
                 delete logs[i];
            }
        }
    });
    
    return '<td colspan="7">'+logs.filter(function(a){return typeof a !== 'undefined';}).join('\n')+'</td>';
}

function parseHp(log) {
	var hp = log.substr( log.indexOf('from ')+5, log.indexOf(' (delta')-log.indexOf('from ')-5 ).split(' to ');
	var type = log.match(/p\d{1,}/g); type = type[0].replace('p', '');

	log = 'Spadek HP z <b>'+hp[0]+'</b> do <b>'+hp[1]+'</b>, ';
	
	if (type != "0") {
		log += 'wypadek z <a href="https://net4game.com/index.php?app=hrp&module=online&section=characterDetails&char='+type+'" target="_blank">graczem</a>';
	} else {
		log += 'zderzenie z obiektem';
	}
	
	return log+'.';
}

function parsePanels(log) {
	log = log.replace(' Panels ', '').replace(' Doors ', '').split(',');
	
	const nazwyDrzwi = {
		3: 'maska',
		7: 'bagażnik',
		11: 'drzwi kier.',
		15: 'drzwi pas.'
	};
	
	const uszkodzenia = {
		'zderzak': { '00': 'nowy', '01': 'uszkodzony', '10': 'uszkodzony (latający)', '11': 'oderwany' },
		'szyba': { '00': 'nowa', '01': 'pęknięta', '10': 'pęknięta', '11': 'wybita' },
		'drzwi': { '00': 'nowe', '01': 'urwane', '10': 'uszkodzone', '11': 'urwane' },
		'kolor': { '00': '<span class="tm_green tm_bold">', '01': '<span class="tm_orange tm_bold">', '10': '<span class="tm_orange tm_bold">', '11': '<span class="tm_red tm_bold">' }
	};

	var tekst = [];
	var panels = log[1].split('-&gt;');
	var doors = log[2].split('-&gt;');

	panels['przed'] = dopiszZera(parseInt(panels[0]).toString(2), 28).match(/.{2}/g);
	panels['po'] = dopiszZera(parseInt(panels[1]).toString(2), 28).match(/.{2}/g);

	if(panels[0] != panels[1]) {
		if(panels['przed'][1] != panels['po'][1]) tekst.push('zderzak tył: ' + uszkodzenia['kolor'][panels['przed'][1]] + uszkodzenia['zderzak'][panels['przed'][1]] + '</span> -> ' + uszkodzenia['kolor'][panels['po'][1]] + uszkodzenia['zderzak'][panels['po'][1]] + '</span>');
		if(panels['przed'][3] != panels['po'][3]) tekst.push('zderzak przód: ' + uszkodzenia['kolor'][panels['przed'][3]] + uszkodzenia['zderzak'][panels['przed'][3]] + '</span> -> ' + uszkodzenia['kolor'][panels['po'][3]] + uszkodzenia['zderzak'][panels['po'][3]] + '</span>');
		if(panels['przed'][5] != panels['po'][5]) tekst.push('szyba: ' + uszkodzenia['kolor'][panels['przed'][5]] + uszkodzenia['szyba'][panels['przed'][5]] + '</span> -> ' + uszkodzenia['kolor'][panels['po'][5]] + uszkodzenia['szyba'][panels['po'][5]] + '</span>');
		if(panels['przed'][7] != panels['po'][7]) tekst.push('część spec1: ' + uszkodzenia['kolor'][panels['przed'][7]] + uszkodzenia['zderzak'][panels['przed'][7]] + '</span> -> ' + uszkodzenia['kolor'][panels['po'][7]] + uszkodzenia['zderzak'][panels['po'][7]] + '</span>');
		if(panels['przed'][9] != panels['po'][9]) tekst.push('część spec2: ' + uszkodzenia['kolor'][panels['przed'][9]] + uszkodzenia['zderzak'][panels['przed'][9]] + '</span> -> ' + uszkodzenia['kolor'][panels['po'][9]] + uszkodzenia['zderzak'][panels['po'][9]] + '</span>');
		if(panels['przed'][11] != panels['po'][11]) {
			tekst.push('część spec3: ' + uszkodzenia['kolor'][panels['przed'][11]] + uszkodzenia['zderzak'][panels['przed'][11]] + '</span> -> ' + uszkodzenia['kolor'][panels['po'][11]] + uszkodzenia['zderzak'][panels['po'][11]] + '</span>');
		}
		
		if(panels['przed'][11] != panels['po'][13]) {
			tekst.push('część spec4: ' + uszkodzenia['kolor'][panels['przed'][13]] + uszkodzenia['zderzak'][panels['przed'][13]] + '</span> -> ' + uszkodzenia['kolor'][panels['po'][13]] + uszkodzenia['zderzak'][panels['po'][13]] + '</span>');
		}
	}

	doors['przed'] = dopiszZera(parseInt(doors[0]).toString(2), 32).match(/.{2}/g);
	doors['po'] = dopiszZera(parseInt(doors[1]).toString(2), 32).match(/.{2}/g);

	if(doors[0] != doors[1]) {  
		for(var i=3; i <= 15; i+=4) {
			if(doors['przed'][i] != doors['po'][i]) {
				tekst.push(nazwyDrzwi[i] + ': ' + uszkodzenia['kolor'][doors['przed'][i]] + uszkodzenia['drzwi'][ doors['przed'][i] ] + '</span> -> ' + uszkodzenia['kolor'][doors['po'][i]] + uszkodzenia['drzwi'][ doors['po'][i] ] + '</span>');
			}
		}
	}
	
    return tekst.join(', ');
}

function dopiszZera(str, num) {
	while(str.length < num) {
		str = "0"+str;
	}
	return str;
}