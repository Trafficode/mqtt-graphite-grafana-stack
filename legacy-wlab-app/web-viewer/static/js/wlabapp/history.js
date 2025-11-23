/* 
	WeatherLab history.js
	$Rev: 255 $
	$Author: kkuras $
	$Date: 2018-03-17 21:02:31 +0100 (sob) $
*/

var history_page_base = 
`
<div class="row well">
	<div class="container-fluid">
	    <div class="col-sm-6">
		    <div class="form-group">
		    	<label for="history_selStation">STATION</label>
		    	<select class="form-control" id="history_selStation" 
		    	style="max-height:320px; overflow-y: scroll; max-width:320px;">
				</select>
		    </div>
		    <div class="form-group">
		    	<label for="history_selSerie">SERIES</label>
		    	<select class="form-control" id="history_selSerie" 
		    	style="max-height:320px; overflow-y: scroll; max-width:320px;">
				</select>
			</div>
	    </div>
	    <div class="col-sm-6">
	    	<div class="panel panel-primary">
	    		<div class="panel-heading text-center">
	    			<dt>INFORMACJE O STACJI</dt>
	    		</div>
		    	<div class="panel-body">
		    		<div class="row">
			    		<div class="col-sm-6">
			    		<p align="right">LOKALIZACJA</p>
			    		</div>
			    		<div class="col-sm-6">
			    		<p align="left" id="history_locInfo"></p>
			    		</div>
		    		</div>
		    		<div class="row">
			    		<div class="col-sm-6">
			    		<p align="right">OPIS</p>
			    		</div>
			    		<div class="col-sm-6">
			    		<p align="left" id="history_descInfo"></p>
			    		</div>
		    		</div>
		    		<div class="row">
			    		<div class="col-sm-6">
			    		<p align="right">STREFA CZASOWA</p>
			    		</div>
			    		<div class="col-sm-6">
			    		<p align="left" id="history_tzInfo"></p>
			    		</div>
		    		</div>
		    	</div>
		    </div>
	    </div>
    </div>
</div>
<div class="row">
	<div class="panel panel-primary">
		<div class="panel-heading text-center"><dt>WYBIERZ OKRES</dt></div>
		<div class="panel-body">
		<div class="row">
		<div class="col-sm-4">
			<div class="col-sm-6">
				<button type="button" align="right" id="history_drawYearBtn"
						class="btn btn-base disable pull-right">
				<img src="static/glyph/glyphicons-42-charts.png"	\ 
													class="img-responsive">
				</button>
			</div>
			<div class="col-sm-6">
				<label for="history_selYear">YEAR</label>
		    	<select class="form-control" id="history_selYear" 
		    	style="max-height:320px; overflow-y: scroll; max-width:320px;">
				</select>
			</div>
		</div>
		<div class="col-sm-4">
			<div class="col-sm-6">
				<button type="button" align="right" id="history_drawMonthBtn"
						class="btn btn-base disable pull-right">
				<img src="static/glyph/glyphicons-42-charts.png"	\ 
													class="img-responsive">
				</button>			
			</div>
			<div class="col-sm-6">
				<label for="history_selMonth">MONTH</label>
	    		<select class="form-control" id="history_selMonth" 
		    	style="max-height:320px; overflow-y: scroll; max-width:320px;">
				</select>
			</div>
		</div>
		<div class="col-sm-4">
			<div class="col-sm-6">
				<button type="button" align="right" id="history_drawDayBtn"
						class="btn btn-base disable pull-right">
				
				<img src="static/glyph/glyphicons-42-charts.png"	\ 
													class="img-responsive">
				</button>
			</div>
			<div class="col-sm-6">
				<label for="history_selDay">DAY</label>
	    		<select class="form-control" id="history_selDay" 
		    	style="max-height:320px; overflow-y: scroll; max-width:320px;">
				</select>
			</div>
		</div>		
		</div> <!-- /row -->
			<br><br>
			<div class="container-fluid" id="history_showDataArea">
			</div>
		</div> <!-- /panel-body -->
	</div>
</div>`;

var history_daily_area = 
`
<div class="row well" id="history_dailyGeneralArea">
</div> 
<div class="row well" id="history_dailyChartArea">
</div>
<div class="row well" id="history_dailyLegendArea">
</div>
<div class="row" id="history_dailyTableArea">
</div>
`

var history_monthly_area = 
`
<div class="row well" id="history_monthlyGeneralArea">
</div> 
<div class="row well" id="history_monthlyChartArea">
</div>
<div class="row well" id="history_monthlyLegendArea">
</div>
<div class="row" id="history_monthlyTypDayArea">
</div>
<div class="row" id="history_monthlyTableArea">
</div>
`

var history_yearly_area = 
`
<div class="row well" id="history_yearlyGeneralArea">
</div> 
<div class="row well" id="history_yearlyChartArea">
</div>
<div class="row well" id="history_yearlyLegendArea">
</div>
<div class="row" id="history_yearlyTableArea">
</div>
`

var __history_stationsDesc = null;
var __history_stationsDataTree = null;

/** _history_crYearlyArea
 * @returns
 */
function _history_crYearlyArea()
{
	$("#history_showDataArea").empty();
	
	var mainBodyEl = document.getElementById("history_showDataArea");
	mainBodyEl.innerHTML = history_yearly_area;
	
	var selStationUid = _history_selStationUid();
	var selSerie = _history_selSerie();
	var yearDt = _history_selYear();
	
	var __history_yearlyChart = new YearlyChart(__history_stationsDesc,
											"history_yearlyChartArea", 400,
											"history_yearlyGeneralArea", 150,
											"history_yearlyTableArea", 400,
											"history_yearlyLegendArea")
	
	__history_yearlyChart.redraw(selStationUid, selSerie, yearDt);
}

/** _history_crMonthlyArea
 * @returns
 */
function _history_crMonthlyArea()
{
	$("#history_showDataArea").empty();
	
	var mainBodyEl = document.getElementById("history_showDataArea");
	mainBodyEl.innerHTML = history_monthly_area;
	
	var selStationUid = _history_selStationUid();
	var selSerie = _history_selSerie();
	var monthDt = _history_selYear() + "-" + _history_selMonth();
	
	var __history_monthlyChart = new MonthlyChart(__history_stationsDesc,
											"history_monthlyChartArea", 400,
											"history_monthlyGeneralArea", 150,
											"history_monthlyTypDayArea", 400,
											"history_monthlyTableArea", 400,
											"history_monthlyLegendArea");
	
	__history_monthlyChart.redraw(selStationUid, selSerie, monthDt);
}

/** _history_crDailyArea
 * @returns
 */
function _history_crDailyArea()
{
	$("#history_showDataArea").empty();
	
	var mainBodyEl = document.getElementById("history_showDataArea");
	mainBodyEl.innerHTML = history_daily_area;
	
	var selStationUid = _history_selStationUid();
	var selSerie = _history_selSerie();
	var dayDt = _history_selYear() + "-" + _history_selMonth()
								   + "-" + _history_selDay();
	
	var __history_dailyChart = new DailyChart(__history_stationsDesc,
			  						  	 	"history_dailyChartArea", 400, 
			  						  	 	"history_dailyGeneralArea", 150,
			  						  		"history_dailyTableArea", 400,
			  						  		"history_dailyLegendArea");
	
	__history_dailyChart.redraw(selStationUid, selSerie, dayDt);
}

/** function _history_selMonth
 * @returns: current selected month 
 */
function _history_selMonth()
{
	return $("#history_selMonth").find("option:selected").text();
}

/** function _history_selDay
 * @returns: current selected day 
 */
function _history_selDay()
{
	return $("#history_selDay").find("option:selected").text();
}

/** function _history_selYear
 * @returns: current selected year 
 */
function _history_selYear()
{
	return $("#history_selYear").find("option:selected").text();
}

/** function _history_crDaySelect
 * @returns: None
 */
function _history_crDaySelect()
{
	console.log("_history_crDaySelect/");
	$("#history_selDay").empty();
	
	var selStationUid = _history_selStationUid();
	var selSerie = _history_selSerie();
	var selYear = _history_selYear();
	var selMonth = _history_selMonth();
	
	console.log("day select "+selStationUid+"/"+
							  selSerie+"/"+selYear+"/"+selMonth);
	
	var dataTree = __history_stationsDataTree[selStationUid]
											 [selSerie][selYear][selMonth];
		
	for(var day_idx in dataTree)
	{
		var serieOption = document.createElement("option");
		serieOption.innerHTML = "<p>"+dataTree[day_idx]+"</p>";
		$("#history_selDay").append(serieOption);
	}
	
	console.log("/_history_crDaySelect");
}

/** function _history_crMonthSelect
 * @returns: None
 */
function _history_sortDataTree()
{
	for(st_uid in __history_stationsDataTree)
	{
		station = __history_stationsDataTree[st_uid];
		for(var serie in station)
		{
			var station_serie_years = station[serie]["years"];
			station_serie_years.sort(function(a, b) 
						{return parseInt(a)-parseInt(b);}).reverse();
					
			for(var year_idx in station_serie_years)
			{
				var year = station_serie_years[year_idx];
				var station_serie_months = station[serie][year]["months"];
				station_serie_months.sort(function(a, b) 
						{return parseInt(a)-parseInt(b);}).reverse();
				
				for(var month_idx in station_serie_months)
				{
					var month = station_serie_months[month_idx];
					var station_serie_days = station[serie][year][month];
					station_serie_days.sort(function(a, b) 
						{return parseInt(a)-parseInt(b);}).reverse();
				}
			}
		}
	}
}

/** function _history_crMonthSelect
 * @returns: None
 */
function _history_crMonthSelect()
{
	console.log("_history_crMonthSelect/");
	$("#history_selMonth").empty();
	
	var selStationUid = _history_selStationUid();
	var selSerie = _history_selSerie();
	var selYear = _history_selYear();
	
	console.log("month select "+selStationUid+"/"+selSerie+"/"+selYear);
	
	var dataTree = __history_stationsDataTree[selStationUid]
											 [selSerie][selYear];
	for(var month_idx in dataTree["months"])
	{
		var serieOption = document.createElement("option");
		serieOption.innerHTML = "<p>"+dataTree["months"][month_idx]+"</p>";
		$("#history_selMonth").append(serieOption);
	}
	
	console.log("/_history_crMonthSelect");
}

/** function _history_crYearSelect
 * @returns: None
 */
function _history_crYearSelect()
{
	console.log("_history_crYearSelect/");
	$("#history_selYear").empty();
	
	var selStationUid = _history_selStationUid();
	var selSerie = _history_selSerie();
	
	console.log("year select "+selStationUid+"/"+selSerie);
	
	var dataTree = __history_stationsDataTree[selStationUid][selSerie];
	
	for(var year_idx in dataTree["years"])
	{
		var serieOption = document.createElement("option");
		serieOption.innerHTML = "<p>"+dataTree["years"][year_idx]+"</p>";
		$("#history_selYear").append(serieOption);
	}
	
	console.log("/_history_crYearSelect");
}

/** function _history_clrAllDrawBtn
 * @returns: None
 */
function _history_clrAllDrawBtn()
{
	console.log("_history_clrAllDrawbtn/");
	
	var drawYearBtnEl = document.getElementById("history_drawYearBtn");
	var drawMonthBtnEl = document.getElementById("history_drawMonthBtn");
	var drawDayBtnEl = document.getElementById("history_drawDayBtn");
	drawYearBtnEl.className = "btn btn-base disable pull-right";
	drawMonthBtnEl.className = "btn btn-base disable pull-right";
	drawDayBtnEl.className = "btn btn-base disable pull-right";
	
	console.log("/_history_clrAllDrawbtn");
}

/** function _history_setActivDrawBtn
 * @param btn_id: button id to set activ state
 * @returns: None
 */
function _history_setActivDrawBtn(btn_id)
{
	console.log("_history_setActivDrawBtn/");
	var drawYearBtnEl = document.getElementById("history_drawYearBtn");
	var drawMonthBtnEl = document.getElementById("history_drawMonthBtn");
	var drawDayBtnEl = document.getElementById("history_drawDayBtn");

	if(btn_id=="history_drawYearBtn")
	{
		drawYearBtnEl.className = "btn btn-primary active pull-right";
		drawMonthBtnEl.className = "btn btn-base disable pull-right";
		drawDayBtnEl.className = "btn btn-base disable pull-right";
	}
	else if(btn_id=="history_drawMonthBtn")
	{
		drawYearBtnEl.className = "btn btn-base disable pull-right";
		drawMonthBtnEl.className = "btn btn-primary active pull-right";
		drawDayBtnEl.className = "btn btn-base disable pull-right";
	}
	else if(btn_id=="history_drawDayBtn")
	{
		drawYearBtnEl.className = "btn btn-base disable pull-right";
		drawMonthBtnEl.className = "btn btn-base disable pull-right";
		drawDayBtnEl.className = "btn btn-primary active pull-right";
	}
	else
	{
		console.log("error - wrong btn_id " + btn_id);
	}
	
	console.log("/_history_setActivDrawBtn");
}

/** function _history_onDrawYear
 * @returns: None
 */
function _history_onDrawYear()
{
	console.log("_history_onDrawYear/");
	
	_history_setActivDrawBtn("history_drawYearBtn");
	_history_crYearlyArea();
	
	console.log("/_history_onDrawYear");
}

/** function _history_onDrawMonth
 * @returns: None
 */
function _history_onDrawMonth()
{
	console.log("_history_onDrawMonth/");
	
	_history_setActivDrawBtn("history_drawMonthBtn");
	_history_crMonthlyArea();
	
	console.log("/_history_onDrawMonth");
}

/** function _history_onDrawDay
 * @returns: None
 */
function _history_onDrawDay()
{
	console.log("_history_onDrawDay/");
	
	_history_setActivDrawBtn("history_drawDayBtn");
	_history_crDailyArea();
	
	console.log("/_history_onDrawDay");
}

/** function _history_selStationUid
 * @returns: current choosen station UID
 */
function _history_selStationUid()
{
	var selStationId = $("#history_selStation").
											find("option:selected").attr('id');
	return selStationId.split("_")[2].trim(); /* sel_station_UID */
}

/** function _history_selSerie
 * @returns
 */
function _history_selSerie()
{
	var selSerieId = $("#history_selSerie").
											find("option:selected").attr('id');
	return selSerieId.split("_")[2].trim(); /* sel_station_SERIE */
}

/** function _history_setTimezone
 * @param new_tz: new timezone
 * @returns: None
 */
function _history_setTimezone(new_tz)
{
	var timezoneEl = document.getElementById("history_tzInfo");
	timezoneEl.innerHTML = new_tz;
}

/** function _history_setDesc
 * @param new_desc: new description
 * @returns: None
 */
function _history_setDesc(new_desc)
{
	if(new_desc=="")
	{
		new_desc = "None";
	}
	
	var descEl = document.getElementById("history_descInfo");
	descEl.innerHTML = new_desc;
}

/** function _history_setLocation
 * @param new_location: new station location
 * @returns: None
 */
function _history_setLocation(new_location)
{
	var locationEl = document.getElementById("history_locInfo");
	locationEl.innerHTML = new_location;
}

/** function _history_crSelectSerie
 * @param stations_desc: general stations descriptions
 * @returns
 */
function _history_crSelectSerie(stations_desc)
{
	console.log("_history_crSelectSerie/");
	$("#history_selSerie").empty();
	
	var selStationUid = _history_selStationUid();
	console.log("selectedStation: <" + selStationUid + ">");
	
	for(var serie in stations_desc[selStationUid]["serie"])
	{
		var serieOption = document.createElement("option");
		serieOption.innerHTML = "<p>"+serie+"</p>";
		serieOption.id = "sel_serie_" + serie;
		$("#history_selSerie").append(serieOption);
	}
	
	console.log("/_history_crSelectSerie");
}

/** function _history_fillStationDesc
 * @param stations_desc: general stations descriptions
 * @returns: None
 */
function _history_fillStationDesc(stations_desc)
{
	console.log("_history_fillStationDesc/");
	
	var selStationUid = _history_selStationUid();
	console.log("selStationUid: <" + selStationUid + ">");
	
	var location = stations_desc[selStationUid]["longitude"] + "°N, " +
				   stations_desc[selStationUid]["latitude"] + "°E";
	
	_history_setLocation(location);
	_history_setDesc(stations_desc[selStationUid]["description"]);
	_history_setTimezone(stations_desc[selStationUid]["timezone"]);
	
	console.log("/_history_fillStationDesc");
}

/** function _history_crSelectStation
 * @param stations_desc: general stations descriptions
 * @returns: None
 */
function _history_crSelectStation(stations_desc)
{
	console.log("_history_crSelectHeader/");
	
	$("#history_selStation").empty();
	
    for(var stationUid in stations_desc)
    {
		var stationOption = document.createElement("option");

		stationOption.innerHTML = "<p>" + stations_desc[stationUid]["name"] + 
								  "  (" + stationUid + ")</p>";
		stationOption.id = "sel_station_" + stationUid;
		
		$("#history_selStation").append(stationOption);
	}
    
    console.log("/_history_crSelectHeader");
}

/** function _history_onStationChange
 * @returns: None
 */
function _history_onStationChange()
{
	console.log("_history_onStationChange/");
	
	_history_crSelectSerie(__history_stationsDesc);
	_history_fillStationDesc(__history_stationsDesc);
	
	_history_crYearSelect();
	_history_crMonthSelect();
	_history_crDaySelect();
	
	_history_setActivDrawBtn("history_drawDayBtn");
	
	_history_crDailyArea();
	
	console.log("/_history_onStationChange");
}

function _history_onDayChange()
{
	console.log("_history_onDayChange/");
	
	_history_clrAllDrawBtn();
	
	console.log("/_history_onDayChange");
}

function _history_onMonthChange()
{
	console.log("_history_onMonthChange/");
	
	_history_crDaySelect();
	
	_history_clrAllDrawBtn();
	
	console.log("/_history_onMonthChange");
}

function _history_onYearChange()
{
	console.log("_history_onYearChange/");
	
	_history_crMonthSelect();
	_history_crDaySelect();
	
	_history_clrAllDrawBtn();
	console.log("/_history_onYearChange");
}

/** function _history_onSerieChange
 * @returns: None
 */
function _history_onSerieChange()
{
	console.log("_history_onSerieChange/");
	
	console.log("selected serie <" + _history_selSerie() + ">");
	
	_history_crYearSelect();
	_history_crMonthSelect();
	_history_crDaySelect();
	
	_history_setActivDrawBtn("history_drawDayBtn");
	
	_history_crDailyArea();
	
	console.log("/_history_onSerieChange");
}


/** function _history_loadCompleted
 * @param stations_desc: general stations descriptions
 * @param stations_data_tree: general data tree
 * @returns: None
 */
function _history_loadCompleted(stations_desc, stations_data_tree)
{
	console.log("_history_loadCompleted/");
	
	_history_crSelectStation(stations_desc);
	_history_crSelectSerie(stations_desc);
	_history_fillStationDesc(stations_desc);
	
	/* Station and serie change selection callbacks */
	$("#history_selStation").change(_history_onStationChange);
	$("#history_selSerie").change(_history_onSerieChange);
	
	/* Selection of range chart, day, mont, day callbacks */
	$("#history_drawYearBtn").click(_history_onDrawYear);
	$("#history_drawMonthBtn").click(_history_onDrawMonth);
	$("#history_drawDayBtn").click(_history_onDrawDay);
	
	/* Year, month and day change selection callbacks */
	$("#history_selYear").change(_history_onYearChange);
	$("#history_selMonth").change(_history_onMonthChange);
	$("#history_selDay").change(_history_onDayChange);
	
	_history_crYearSelect();
	_history_crMonthSelect();
	_history_crDaySelect();
	
	_history_setActivDrawBtn("history_drawDayBtn");
	
	_history_crDailyArea();
	
	console.log("/_history_loadCompleted");
}

/** function history_createPage
 * @param workArea: work area where page should be draw
 * @returns: None
 */
function history_createPage(workArea)
{
	console.log("history_createPage/ - " + workArea);
	
	var mainBodyEl = document.getElementById(workArea);
	mainBodyEl.innerHTML = history_page_base;
	
	$.ajax({
		type: "GET",
		url: "/restq/stations/desc",
		success: function(data)	{
			__history_stationsDesc = data;
			$.ajax({
				type: "GET",
				url: "/restq/stations/datatree",
				success: function(data) { 
					__history_stationsDataTree = data;
					_history_sortDataTree();
					
					_history_loadCompleted(__history_stationsDesc,
										   __history_stationsDataTree);
				}
			});
        }
	});
	
	console.log("/history_createPage");
}

/* 	------------------------------------------------------------------------- /
	end of file
	------------------------------------------------------------------------ */
