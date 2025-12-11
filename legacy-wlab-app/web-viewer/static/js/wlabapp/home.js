/* 
	WeatherLab home.js
	$Rev: 255 $
	$Author: kkuras $
	$Date: 2018-03-17 21:02:31 +0100 (sob) $
*/
var home_page_base = 
`
<div class="row">
	<div class="col-md-9">
		<div class="well" id="home_chartWell">
		</div>
	</div>
	<div class="col-md-3">
		<div class="well" style="min-height:480px; padding-top: 20px;">
		
			<div class="row">
				<div class="col-md-6">
					<button class="btn-block btn-primary btn-md" 
						id="home_ovBtnBack" 
						onclick="_home_onBackBtnClick()">
						<font size="2"><dt id="home_ovPrevDay">-</dt></font>
					</button>
				</div>
				<div class="col-md-6">
					<button class="btn-block btn-primary btn-md" 
								id="home_overviewBtnNext"
								onclick="_home_onNextBtnClick()">
						<font size="2"><dt id="home_ovNextDay">-</dt></font>
					</button>
				</div>
			</div>
			
			<div class="row" align="center" style="padding-top: 32px;">
				<font size="5"><dt id="home_ovStationName"></dt></font>
				<font size="2"><dt id="home_ovStationUid"></dt></font>
			</div>
			
			<div class="row" align="center" style="padding-top: 32px;"
				id="home_ovDailyData">
			</div>
			
			<div class="row" align="center" style="padding-top: 42px;">
				<div class="col-sm-6">
				<img src="static/images/sunrise2.png?ver=1.4" 
					class="img-responsive"
					style="height:48px; width:64px;">
				<font size="3"><dt id="home_ovSunrise">-</dt></font>
				</div>
				<div class="col-sm-6">
				<img src="static/images/sunset2.png?ver=1.4" 
					class="img-responsive"
					style="height:48px; width:64px;">
				<font size="3"><dt id="home_ovSunset">-</dt></font>
				</div>
			</div>
			
			<div class="row" align="center" style="padding-top: 16px;">
				<font size="4"><dt id="home_ovTz"></dt></font>
				<font size="4"><dt id="home_ovLoc"></dt></font>
			</div>
			
		</div>
	</div>
</div>

	<div class="panel panel-primary">
		<div class="panel-heading text-center">
		<dt>LATEST MEASUREMENTS</dt>
		</div>
		<div class="panel-body" style="max-height:400px; overflow-y: scroll;">
		<table class="table table-striped">
			<thead>
			<tr>
		        <th>NAME</th>
		   		<th>SERIES</th>
		   		<th>ACT</th>
		   		<th>TIME</th>
		        <th>AVG</th>
		        <th>MAX</th>
		        <th>TIME</th>
		        <th>MIN</th>
		        <th>TIME</th>
		        <th><img src="static/glyph/glyphicons-42-charts.png?ver=1.4"
		        							class="img-responsive"></th>
		 	</tr>
		    </thead>
		    <tbody id="home_dataTable">
			</tbody>
		</table>
		</div>
	</div>
<footer class="text-center" style="margin-top:20px; padding:10px; color:#888;">
	<small>Weather°LAB - Powered by Graphite & MQTT</small>
</footer>
`;

var home_ov_dailydata_prev = 
`
<span style="font-weight: bold;">
<font size="3" id="home_ovMin">-</font></span>

<span><font size="6">/</font></span>

<span style="font-weight: bold;">
<font size="5" id="home_ovAvg">-</font></span>

<span><font size="6">/</font></span>

<span style="font-weight: bold;">
<font size="3" id="home_ovMax">-</font></span>
`

var home_ov_dailydata_curr = 
`
<div class="row">
	<span style="font-weight: bold;">
	<font size="7" id="home_ovAct">-</font></span>
</div>
<div class="row">
	<span style="font-weight: bold;">
	<font size="3" id="home_ovMin">-</font></span>
	
	<span><font size="6">/</font></span>
	
	<span style="font-weight: bold;">
	<font size="5" id="home_ovAvg">-</font></span>
	
	<span><font size="6">/</font></span>
	
	<span style="font-weight: bold;">
	<font size="3" id="home_ovMax">-</font></span>
</div>
`
	
var __home_currChartBtnId = null;
var __home_dailyChart = null;
var __home_stationsDesc = null;
var __home_currStationNfo = null;
var __home_monthlyData = null;
var __home_ovNextDay = null;
var __home_ovPrevDay = null;

function _home_onChartBtnClick() {
	console.log("_home_onChartBtnClick/");
	
	if(this.id != __home_currChartBtnId) {
		console.log("update chart");
		var curr_btn_el = document.getElementById(__home_currChartBtnId);
		curr_btn_el.className = "btn btn-base disable";
		
		var new_curr_btn_el = document.getElementById(this.id);
		new_curr_btn_el.className = "btn btn-primary active";
		__home_currChartBtnId = this.id;
		
		var splited = __home_currChartBtnId.split("_");
		
		__home_currStationNfo =  
			{ "uid":splited[0],"serie":splited[1],"dt":splited[2] };
		
		__home_dailyChart.redraw( splited[0],	/* UID */
								  splited[1],	/* SERIE */
								  splited[2]);	/* DT */
		_home_updateOverview();
	} else {
		console.log("update not neccessary");
	}
	console.log("/_home_onChartBtnClick");
}

function _home_updateOverview() {
	console.log("_home_updateOverview/");
		
	_home_ovUpdateDesc();
	
	var dt = __home_currStationNfo["dt"].split("-");
	var uid = __home_currStationNfo["uid"];
	var device_name_uid = __home_stationsDesc[uid]["name"] + "_" + uid;
	var serieName = __home_currStationNfo["serie"];
	var serieId = __home_stationsDesc[uid]["serie"][serieName];
	var param = JSON.stringify({
		"uid": device_name_uid, 
		"serie": serieId, 
		"date": dt[0]+"-"+dt[1],
	});
	$.ajax({
		type: "GET",
		url: "/restq/station/serie/monthly/"+param,
		success: function(data) {
			__home_monthlyData = data;
		
			__home_ovNextDay = _home_getNextDay();
			__home_ovPrevDay = _home_getPrevDay();
			console.log("nextDay " + __home_ovNextDay);
			console.log("prevDay " + __home_ovPrevDay);
			_home_ovUpdateMoveBtn();
			_home_ovUpdateDailyData();
			_home_ovUpdateGeoPosition();
			_home_ovUpdateSunData();
		}
	});
	
	console.log("/_home_updateOverview");
}

function _home_ovUpdateSunData() {
	console.log("_home_ovUpdateSunData/");
	var uid = __home_currStationNfo["uid"];
	var dt = __home_currStationNfo["dt"];
	var long = parseFloat(__home_stationsDesc[uid]["longitude"]);
	var lat = parseFloat(__home_stationsDesc[uid]["latitude"]);
	
	var sunrise_date = new Date(dt).sunrise(long, lat);
	var sunrise = moment(sunrise_date).format("HH:mm");
	console.log("SUNRISE: " + sunrise);
	
	var sunset_date = new Date(dt).sunset(long, lat);
	var sunset = moment(sunset_date).format("HH:mm");
	console.log("SUNSET: " + sunset);
	
	var ovSunriseEl = document.getElementById("home_ovSunrise");
	ovSunriseEl.innerHTML = sunrise;
	
	var ovSunsetEl = document.getElementById("home_ovSunset");
	ovSunsetEl.innerHTML = sunset;
	console.log("/_home_ovUpdateSunData");
}

function _home_ovUpdateGeoPosition() {
	console.log("_home_ovUpdateGeoPosition/");
	var uid = __home_currStationNfo["uid"];
	var tz = __home_stationsDesc[uid]["timezone"];
	var long = __home_stationsDesc[uid]["longitude"];
	var lat = __home_stationsDesc[uid]["latitude"];
	
	var ovTzEl = document.getElementById("home_ovTz");
	ovTzEl.innerHTML = tz;
	
	var ovLocEl = document.getElementById("home_ovLoc");
	ovLocEl.innerHTML = long+"°N, "+lat+"°E";
	
	console.log("/_home_ovUpdateGeoPosition");
}

function _home_ovUpdateDailyData() {
	console.log("_home_ovUpdateDailyData/");
	var currDay = __home_currStationNfo["dt"].split("-")[2];
	var uid = __home_currStationNfo["uid"];
	var serieId = __home_stationsDesc[uid]["serie"]
										  [__home_currStationNfo["serie"]];
	var serieUnit = serie_getUnit(serieId);
	
	// Check if data exists for current day
	if (!__home_monthlyData[currDay]) {
		console.warn("No data for day: " + currDay);
		console.log("Available days:", Object.keys(__home_monthlyData));
		return;
	}
	
	var dayAvg = (__home_monthlyData[currDay]["f_avg_buff"]/
		  __home_monthlyData[currDay]["i_counter"]).toFixed(1).toString();
	var dayMin = __home_monthlyData[currDay]["f_min"].toFixed(1).toString();
	var dayMax = __home_monthlyData[currDay]["f_max"].toFixed(1).toString();
	var dayAct = __home_monthlyData[currDay]["f_act"].toFixed(1).toString();	var ovDailyDataEl = document.getElementById("home_ovDailyData");
	if(__home_ovNextDay == null) {
		ovDailyDataEl.innerHTML = home_ov_dailydata_curr;
		var ovActEl = document.getElementById("home_ovAct");
		ovActEl.color = "#269287"; // serie_sampleColorTrans(serieId, "ACT");
		ovActEl.innerHTML = dayAct+serieUnit;
	} else {
		ovDailyDataEl.innerHTML = home_ov_dailydata_prev;
	}
	
	var ovMinEl = document.getElementById("home_ovMin");
//	ovMinEl.color = serie_sampleColorTrans(serieId, "MIN");
	ovMinEl.innerHTML = dayMin+serieUnit;

	var ovAvgEl = document.getElementById("home_ovAvg");
	ovAvgEl.color = "#269287"; // serie_sampleColorTrans(serieId, "AVG");
	ovAvgEl.innerHTML = dayAvg+serieUnit;
	
	var ovMaxEl = document.getElementById("home_ovMax");
//	ovMaxEl.color = serie_sampleColorTrans(serieId, "MAX");
	ovMaxEl.innerHTML = dayMax+serieUnit;
	console.log("/_home_ovUpdateDailyData");
}

function _home_ovUpdateDesc() {
	console.log("_home_ovUpdateDesc/");
	name = __home_stationsDesc[__home_currStationNfo["uid"]]["name"];
	var ovNameEl = document.getElementById("home_ovStationName");
	ovNameEl.innerHTML = name;
	
	var ovUidEl = document.getElementById("home_ovStationUid");
	ovUidEl.innerHTML = __home_currStationNfo["uid"];
	console.log("/_home_ovUpdateDesc");
}

function _home_getNextDay() {
	var currDay = __home_currStationNfo["dt"].split("-")[2];
	// Filter out non-numeric keys and sort numerically
	var days = Object.keys(__home_monthlyData)
		.filter(function(key) { return !isNaN(key); })
		.sort(function(a, b) { return parseInt(a) - parseInt(b); });
	var currDayIdx = days.indexOf(currDay);
	var daysInMonth = days.length;
	
	if( currDayIdx < daysInMonth-1 ) {
		return days[currDayIdx+1];
	} else {
		return null;
	}
}

function _home_getPrevDay() {
	var currDay = __home_currStationNfo["dt"].split("-")[2];
	// Filter out non-numeric keys and sort numerically
	var days = Object.keys(__home_monthlyData)
		.filter(function(key) { return !isNaN(key); })
		.sort(function(a, b) { return parseInt(a) - parseInt(b); });
	var currDayIdx = days.indexOf(currDay);
	var daysInMonth = days.length;
	
	if( currDayIdx > 0 ) {
		return days[currDayIdx-1];
	} else {
		return null;
	}
}

function _home_onNextBtnClick() {
	console.log("_home_onNextBtnClick");
	if(__home_ovNextDay != null)	{
		splited = __home_currStationNfo["dt"].split("-");
		
		dt = splited[0]+"-"+splited[1]+"-"+__home_ovNextDay;
		var uid = __home_currStationNfo["uid"];
		var device_name_uid = __home_stationsDesc[uid]["name"] + "_" + uid;
		
		__home_currStationNfo["dt"] = dt;
		__home_dailyChart.redraw( device_name_uid,
								  __home_currStationNfo["serie"],
								  dt);
		
		__home_ovNextDay = _home_getNextDay();
		__home_ovPrevDay = _home_getPrevDay();
		console.log("nextDay " + __home_ovNextDay);
		console.log("prevDay " + __home_ovPrevDay);
		_home_ovUpdateMoveBtn();
		_home_ovUpdateDailyData();
	}else {
		console.log("_home_onBackBtnClick no __home_ovNextDay");
	}
}

function _home_onBackBtnClick() {
	console.log("_home_onBackBtnClick");
	if(__home_ovPrevDay != null)	{
		splited = __home_currStationNfo["dt"].split("-");
		
		dt = splited[0]+"-"+splited[1]+"-"+__home_ovPrevDay;
		var uid = __home_currStationNfo["uid"];
		var device_name_uid = __home_stationsDesc[uid]["name"] + "_" + uid;
		
		__home_currStationNfo["dt"] = dt;
		__home_dailyChart.redraw( device_name_uid,
								  __home_currStationNfo["serie"],
								  dt);
		
		__home_ovNextDay = _home_getNextDay();
		__home_ovPrevDay = _home_getPrevDay();
		console.log("nextDay " + __home_ovNextDay);
		console.log("prevDay " + __home_ovPrevDay);
		_home_ovUpdateMoveBtn();		
		_home_ovUpdateDailyData();
	} else {
		console.log("_home_onBackBtnClick no __home_ovPrevDay");
	}
}

function _home_ovUpdateMoveBtn() {
	console.log("_home_overviewMoveBtn/");
	
	month = __home_currStationNfo["dt"].split("-")[1];
	
	/* Create back button */
	var btnBackEl = document.getElementById("home_ovBtnBack");
	if(__home_ovPrevDay == null) {
		btnBackEl.className = "btn-block btn-default disabled";
		var prevDayBtn = document.getElementById("home_ovPrevDay");
		prevDayBtn.innerHTML = "-";
	} else {
		btnBackEl.className = "btn-block btn-primary";
		var prevDayBtn = document.getElementById("home_ovPrevDay");
		prevDayBtn.innerHTML = __home_ovPrevDay + "-" + month;
		_home_ovUpdateDailyData();
	}
	
	/* Create next button */
	var btnNextEl = document.getElementById("home_overviewBtnNext");
	if(__home_ovNextDay == null) {
		btnNextEl.className = "btn-block btn-default disabled";
		var nextDayBtn = document.getElementById("home_ovNextDay");
		nextDayBtn.innerHTML = "-";
	} else {
		btnNextEl.className = "btn-block btn-primary";
		var nextDayBtn = document.getElementById("home_ovNextDay");
		nextDayBtn.innerHTML = __home_ovNextDay + "-" + month;
		_home_ovUpdateDailyData();
	}
	
	_home_ovUpdateSunData();
	console.log("_home_overviewMoveBtn");
}


function _home_createTable(stationsData, stationsDesc) {
	for (station_uid in stationsData) {		
		for (serie in stationsData[station_uid]) {	
			var stationRow = document.createElement("tr");
			
			var serie_dict = stationsData[station_uid][serie];
			var station_tz = stationsDesc[station_uid]["timezone"];
			var dt = moment(serie_dict["i_act_ts"]*1000);
			var str_dt_now = dt.tz(station_tz).format("HH:mm YYYY-MM-DD");
			
			var str_t_min = moment(serie_dict["i_min_ts"]*1000).tz(station_tz);
			var str_t_min = str_t_min.format("HH:mm");
			var str_t_max = moment(serie_dict["i_max_ts"]*1000).tz(station_tz);
			var str_t_max = str_t_max.format("HH:mm");
			
			var str_serie_el = document.createElement("td");
			str_serie_el.innerHTML = serie;
			
			var str_dt_now_el = document.createElement("td");
			str_dt_now_el.innerHTML = str_dt_now;
			
			var str_t_min_el = document.createElement("td");
			str_t_min_el.innerHTML = str_t_min;
			
			var str_t_max_el = document.createElement("td");
			str_t_max_el.innerHTML = str_t_max;
			
			var str_name_el = document.createElement("td");
			str_name_el.innerHTML = stationsDesc[station_uid]["name"];
			
			var str_act_el = document.createElement("td");
			str_act_el.innerHTML = serie_dict["f_act"].toFixed(1) +
					serie_getUnit(stationsDesc[station_uid]["serie"][serie]);
			
			var str_min_el = document.createElement("td");
			str_min_el.innerHTML = serie_dict["f_min"].toFixed(1) +
					serie_getUnit(stationsDesc[station_uid]["serie"][serie]);
			
			var str_max_el = document.createElement("td");
			str_max_el.innerHTML = serie_dict["f_max"].toFixed(1) +
					serie_getUnit(stationsDesc[station_uid]["serie"][serie]);
			
			var str_avg = 0;
			if (serie_dict["i_counter"] && serie_dict["i_counter"] > 0) {
				str_avg = serie_dict["f_avg_buff"]/serie_dict["i_counter"];
			} else if (serie_dict["f_avg"]) {
				str_avg = serie_dict["f_avg"];
			}
			str_avg = str_avg.toFixed(1).toString();
			var str_avg_el = document.createElement("td");
			str_avg_el.innerHTML = str_avg +
					serie_getUnit(stationsDesc[station_uid]["serie"][serie]);
			
			var chart_btn_id = station_uid + "_" + serie +
											 "_" + str_dt_now.split(" ")[1];

			var btn_chart_row_el = document.createElement("td");
			var btn_chart_el = document.createElement("button");
			
			if(__home_currChartBtnId == null)
			{
				console.log("__home_currChartBtnId == null");
				__home_currChartBtnId = chart_btn_id;
				btn_chart_el.className = "btn btn-primary active";
			} else {
				btn_chart_el.className = "btn btn-base disable";
			}
			
			btn_chart_el.typeName = "button";
			btn_chart_el.id = chart_btn_id;
			btn_chart_el.onclick = _home_onChartBtnClick;
			btn_chart_row_el.append(btn_chart_el);
			
			stationRow.append(str_name_el);
			stationRow.append(str_serie_el);
			stationRow.append(str_act_el);
			stationRow.append(str_dt_now_el);
			stationRow.append(str_avg_el);
			stationRow.append(str_max_el);
			stationRow.append(str_t_max_el);
			stationRow.append(str_min_el);
			stationRow.append(str_t_min_el);
			stationRow.append(btn_chart_row_el);
			
			var curr_btn_el = document.getElementById("home_dataTable");
			curr_btn_el.append(stationRow);
		}
	}
}

/* home_getStationDailyData(uid, serie, dt)
 * dt: YYYY-MM-DD
 * serie: Temperature
 * uid: 0234294532AB
 * */
function _home_getStationDailyData(uid, serie, dt) {
	console.log("_home_getStationDailyData/");
	
	var param = { "uid": uid, "serie": serie, "date": dt }
	$.ajax({
		type: "GET",
		url: "/restq/station/serie/daily/"+JSON.stringify(param),
		success: function(data) {
            stationDailyData = data;
            console.log(stationDailyData);
            console.log("/_home_getStationDailyData");
        }
	});
}

function home_createPage(workArea) {
	console.log("home_createPage/ - " + workArea);
	
	__home_currChartBtnId = null;
	
	var mainBodyEl = document.getElementById(workArea);
	mainBodyEl.innerHTML = home_page_base;
	
	$.ajax({
		type: "GET",
		url: "/restq/stations/desc",
		success: function(data) {
			__home_stationsDesc = data;
        	$.ajax({
        		type: "GET",
        		url: "/restq/stations/newest",
        		success: function(data) {
        		var stationsNewest = data;
        			_home_createTable(stationsNewest, __home_stationsDesc);
        			
        			__home_dailyChart = new DailyChart(__home_stationsDesc,
        											  "home_chartWell", 400, 
        											   null, null, null, null,
        											   null);
        			
			var splited = __home_currChartBtnId.split("_");
			__home_currStationNfo =  
			{ "uid":splited[0],"serie":splited[1],"dt":splited[2] };
			var device_name_uid = __home_stationsDesc[splited[0]]["name"] + "_" + splited[0];
			
			__home_dailyChart.redraw( device_name_uid,	/* UID */
									  splited[1],	/* SERIE */
									  splited[2]);	/* DT */                    console.log("/_home_getStationsDailyData");
                }
        	});            
        }
	});

	console.log("/home_createPage");
}

/* 	------------------------------------------------------------------------- /
	end of file
	------------------------------------------------------------------------ */
