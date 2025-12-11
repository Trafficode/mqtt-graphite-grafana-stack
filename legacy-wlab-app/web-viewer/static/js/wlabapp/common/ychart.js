/* 
	WeatherLab ychart.js
	$Rev: 255 $
	$Author: kkuras $
	$Date: 2018-03-17 21:02:31 +0100 (sob) $
*/

var ychart_table_head = 
`
<tr>
	<th style="text-align: center;">MONTH</th>
	<th style="text-align: center;">AVG</th>
	<th style="text-align: center;">MAX</th>
	<th style="text-align: center;">T_MAX</th>
	<th style="text-align: center;">MIN</th>
	<th style="text-align: center;">T_MIN</th>
</tr>	
`

var ychart_table_legend = 
`
<div class="row">
	<div class="col-sm-4">
		<dl>
		<dt>MONTH</dt>
		<dd>miesiąc</dd>
		</dl>
	</div>
	<div class="col-sm-4">
		<dl>
		<dt>AVG</dt>
		<dd>średnia miesiąca</dd>
		</dl>
	</div>
	<div class="col-sm-4">
		<dl>
		<dt>MAX</dt>
		<dd>maksimum miesięczne</dd>
		</dl>
	</div>
</div>
<div class="row">
	<div class="col-sm-4">
		<dl>
		<dt>T_MAX</dt>
		<dd>data wystąpienia MAX</dd>
		</dl>
	</div>
	<div class="col-sm-4">
		<dl>
		<dt>MIN</dt>
		<dd>minimum miesięczne</dd>
		</dl>
	</div>
	<div class="col-sm-4">
		<dl>
		<dt>T_MIN</dt>
		<dd>data występienia MIN</dd>
		</dl>
	</div>
</div>
`
	
class YearlyChart	{
	
	constructor(stations_desc, ychart_area_id, ychart_height_px, 
							   gen_area_id, general_height_px,
							   table_area_id, table_height_px,
							   table_legend_area_id)
	{
		this.__desc = stations_desc;
		this.__monthlyParsed = null
		this.__currSerie = null
		this.__currUid = null
		this.__prev_chart_type = "CANDLE";
		
		this.__ychart_cont_id = ychart_area_id+"_ychart";
		this.__ychart_table_body_id = ychart_area_id+"_ychart_table_body";
		this.__ychart_btns_cont_id = ychart_area_id+"_ychart_btns";
		
		/* Format chart area */
		var ychartContEl = document.createElement("div");
		ychartContEl.style.height = (ychart_height_px+40).toString()+"px";
		ychartContEl.style.width = "auto";
		
		var ychartChartTypeBtnEl = document.createElement("div");
		ychartChartTypeBtnEl.className = "row";
		ychartChartTypeBtnEl.align = "right";
		ychartChartTypeBtnEl.id = this.__ychart_btns_cont_id;
		ychartContEl.append(ychartChartTypeBtnEl);
		
		var spaceEl = document.createElement("br");
		ychartContEl.append(spaceEl);
		
		var ychartChartEl = document.createElement("div");
		ychartChartEl.id = this.__ychart_cont_id;
		ychartContEl.append(ychartChartEl);
		
		/* Append to main element */
		var ychartAreaEl = document.getElementById(ychart_area_id);
		ychartAreaEl.append(ychartContEl);
		
		/* Chart buttons create */
		this._create_chart_type_btns(this);
		
		this.__unvisible_counter = 0;
		this.__ychart = this._create_ychart_template(this);
		this.__ychart.render();
		
		/* Yearly general bar chart */
		this.__ychart_gen_cont_id = gen_area_id+"_ychart_general";
		var ychartGenContEl = document.createElement("div");
		ychartGenContEl.id = this.__ychart_gen_cont_id;
		ychartGenContEl.style.height = general_height_px.toString()+"px";
		var ychartGenAreaEl = document.getElementById(gen_area_id);
		ychartGenAreaEl.append(ychartGenContEl);
		
		this.__ychart_general = this._create_ychart_general_template(this);
		this.__ychart_general.render();
		
		/* Table of yearly months */
		this._create_ychart_table_template(this, table_area_id, 
												table_height_px);
		
		var tableLegendArea = document.getElementById(table_legend_area_id);
		tableLegendArea.innerHTML = ychart_table_legend;
	}
	
	_set_chart_btn_type(self, btnType)	{
		console.log("_on_chart_btn_click: "+btnType);
		
		var prefix = self.__ychar_btns_cont_id+"_";
		var prevBtnEl = document.getElementById(prefix +
												self.__prev_chart_type);
		prevBtnEl.className = "btn btn-default btn-sm";
		var currBtnEl = document.getElementById(prefix + btnType);
		currBtnEl.className = "btn btn-primary btn-sm";
		self.__prev_chart_type = btnType;
		
		var serieUnit = serie_getUnit(
					self.__desc[self.__currUid]["serie"][self.__currSerie]);
		var mSerie=null;
		if(btnType=="CANDLE") {
			mSerie=self._set_chart_candle_type(self);
			self.__ychart.options.toolTip.content =
									"<strong>Month {x}</strong>" +
									"<br>AVG: {y[0]}"+serieUnit+
									"<br>MAX: {y[1]}"+serieUnit+
									"<br>MIN: {y[2]}"+serieUnit;
		} else if(btnType=="LINE") {
			mSerie=self._set_chart_line_type(self,self.__yearlyParsed,"line");
			self.__ychart.options.toolTip.content = "{x}: {y}"+serieUnit;
		} else if(btnType=="SPLINE") {
			mSerie=self._set_chart_line_type(self,
										self.__yearlyParsed,"spline");
			self.__ychart.options.toolTip.content = "{x}: {y}"+serieUnit;
		} else if(btnType=="AREA") {
			mSerie=self._set_chart_line_type(self,self.__yearlyParsed,"area");
			self.__ychart.options.toolTip.content = "{x}: {y}"+serieUnit;
		} else if(btnType=="COLUMN") {
			mSerie=self._set_chart_line_type(self, 
										self.__yearlyParsed, "column");
			self.__ychart.options.toolTip.content = "{x}: {y}"+serieUnit;
		}
		self.__ychart.options.data = mSerie;
		self.__ychart.render();
	}
	
	_set_chart_candle_type(self) {
		console.log("_set_chart_candle_type/");
		
		var serieId = self.__desc[self.__currUid]["serie"][self.__currSerie];
		var dataSample = [];
		for(var idx in self.__yearlyParsed["avg_serie"]) {
			var sampleTemplate = {
					x: self.__yearlyParsed["avg_serie"][idx].x,
					y: [self.__yearlyParsed["avg_serie"][idx].y,
					    self.__yearlyParsed["max_serie"][idx].y,
					    self.__yearlyParsed["min_serie"][idx].y,
					    self.__yearlyParsed["avg_serie"][idx].y]
			};
			dataSample.push(sampleTemplate);
		}
		
		var serieparam = { 
				type: "candlestick",  
				dataPoints: dataSample,
				showInLegend: false,
				visible: true,
				color: serie_sampleColorTrans(serieId, "ACT")
		};
		
		console.log("/_set_chart_candle_type");
		return [serieparam];
	}
	
	_set_chart_line_type(self, parsed, type) {
		console.log("_set_chart_line_chart/");
		self.__unvisible_counter = 0;
		
		var serieId = self.__desc[self.__currUid]["serie"][self.__currSerie];
		var mSeries = self._create_ymonthly_serie(self,
									parsed["avg_serie"], 
									parsed["min_serie"],
									parsed["max_serie"], serieId, type);
		
		console.log("/_set_chart_line_chart");
		return mSeries;
	}
	
	_create_chart_type_btns(self) 	{
		var btnsAreaEl = document.getElementById(self.__ychart_btns_cont_id);
		
		var columnBtnEl = document.createElement("button");
		columnBtnEl.id = self.__ychar_btns_cont_id+"_COLUMN";
		columnBtnEl.type = "button";
		columnBtnEl.style = "margin-right:10px;";
		columnBtnEl.className = "btn btn-default btn-sm";
		columnBtnEl.innerHTML = "COLUMN";
		columnBtnEl.onclick = function() { 
									self._set_chart_btn_type(self, "COLUMN");
									self.__ychart.render();
								};
		
		var lineBtnEl = document.createElement("button");
		lineBtnEl.id = self.__ychar_btns_cont_id+"_LINE";
		lineBtnEl.type = "button";
		lineBtnEl.style = "margin-right:10px;";
		lineBtnEl.className = "btn btn-default btn-sm";
		lineBtnEl.innerHTML = "LINE";
		lineBtnEl.onclick = function() { 
									self._set_chart_btn_type(self, "LINE");
									self.__ychart.render();
								};
								
		var areaBtnEl = document.createElement("button");
		areaBtnEl.id = self.__ychar_btns_cont_id+"_AREA";
		areaBtnEl.type = "button";
		areaBtnEl.style = "margin-right:10px;";
		areaBtnEl.className = "btn btn-default btn-sm";
		areaBtnEl.innerHTML = "AREA";
		areaBtnEl.onclick = function() { 
									self._set_chart_btn_type(self, "AREA");
									self.__ychart.render();
								};
		
		var splineBtnEl = document.createElement("button");
		splineBtnEl.id = self.__ychar_btns_cont_id+"_SPLINE";
		splineBtnEl.type = "button";
		splineBtnEl.style = "margin-right:10px;";
		splineBtnEl.className = "btn btn-default btn-sm";
		splineBtnEl.innerHTML = "SPLINE";
		splineBtnEl.onclick = function() { 
									self._set_chart_btn_type(self, "SPLINE");
									self.__ychart.render();
								};
		
		var candleBtnEl = document.createElement("button");
		candleBtnEl.id = self.__ychar_btns_cont_id+"_CANDLE";
		candleBtnEl.type = "button";
		candleBtnEl.style = "margin-right:10px;";
		candleBtnEl.className = "btn btn-primary btn-sm";
		candleBtnEl.innerHTML = "CANDLE";
		candleBtnEl.onclick = function() { 
									self._set_chart_btn_type(self, "CANDLE"); 
									self.__ychart.render();
								};
		
		btnsAreaEl.append(columnBtnEl);
		btnsAreaEl.append(lineBtnEl);
		btnsAreaEl.append(areaBtnEl);
		btnsAreaEl.append(splineBtnEl);
		btnsAreaEl.append(candleBtnEl);
	}
	
	_create_ychart_daily_table(self, yearly_data, serie_unit, station_tz)
	{
		console.log("_create_ychart_daily_table/");
		
		var ytablebody = document.getElementById(self.__ychart_table_body_id);
		
		var kay_months = Object.keys(yearly_data).sort();
				
		for(var idx in kay_months)
		{
			var sampleRowEl = document.createElement("tr");
			
			var _month = kay_months[idx];
			var _month_int = parseInt(_month);
			
			var month_average_str = yearly_data[_month]["f_avg"].toFixed(1);
			var month_min_str = yearly_data[_month]["f_min"].toString()
			var month_max_str = yearly_data[_month]["f_max"].toString()
			
			var min_hm = moment(yearly_data[_month]["i_min_ts"]*1000)
									.tz(station_tz).format("YYYY-MM-DD HH:mm");
			var max_hm = moment(yearly_data[_month]["i_max_ts"]*1000)
									.tz(station_tz).format("YYYY-MM-DD HH:mm");
			
			var monthEl = document.createElement("td");
			monthEl.innerHTML = _month_int.toString();
			monthEl.style = "text-align: center;";
			var avgEl = document.createElement("td");
			avgEl.innerHTML = month_average_str+serie_unit;
			avgEl.style = "text-align: center;";
			var maxEl = document.createElement("td");
			maxEl.innerHTML = month_max_str+serie_unit;
			maxEl.style = "text-align: center;";
			var minEl = document.createElement("td");
			minEl.innerHTML = month_min_str+serie_unit;
			minEl.style = "text-align: center;";
			var minTsEl = document.createElement("td");
			minTsEl.innerHTML = min_hm;
			minTsEl.style = "text-align: center;";
			var maxTsEl = document.createElement("td");
			maxTsEl.innerHTML = max_hm;
			maxTsEl.style = "text-align: center;";
			
			sampleRowEl.append(monthEl);
			sampleRowEl.append(avgEl);
			sampleRowEl.append(maxEl);
			sampleRowEl.append(maxTsEl);
			sampleRowEl.append(minEl);
			sampleRowEl.append(minTsEl);
			ytablebody.append(sampleRowEl);
		}
		console.log("/_create_ychart_daily_table");
	}
	
	/** _create_ychart_table_template
	 * 
	 */
	_create_ychart_table_template(self, cont_id, height_px)
	{
		console.log("_create_ychart_table_template/");
		
		var tableCont = document.getElementById(cont_id);

		var ychartTableDivEl = document.createElement("div"); 
		ychartTableDivEl.style = "max-height:"+height_px.toString()
											  +"px; overflow-y: scroll;";
		
		var ychartTable = document.createElement("table");
		ychartTable.className = "table table-striped";
		
		var ychartTableHead = document.createElement("thead");
		ychartTableHead.innerHTML = ychart_table_head;
		ychartTable.append(ychartTableHead);
		
		var ychartTableBody = document.createElement("tbody");
		ychartTableBody.id = self.__ychart_table_body_id;
		ychartTable.append(ychartTableBody);
		
		ychartTableDivEl.append(ychartTable);
		
		tableCont.append(ychartTableDivEl);
		
		console.log("/_create_ychart_table_template");
	}
	
	/** _parse_ydata
	 * 
	 */
	_parse_ydata(self, yearly_data)
	{
		var kay_months = Object.keys(yearly_data).sort();
		
		var avg_sample = [];
		var max_sample = [];
		var min_sample = [];
		
		var year_buff_f = 0.0;
		var year_buff_counter = 0;
		var year_min_f = 999999.0;
		var year_max_f = -999999.0;
		var year_min_ts = 0
		var year_max_ts = 0
		
		for(var idx in kay_months)
		{
			var _month = kay_months[idx];
			var _month_int = parseInt(_month);
			avg_sample.push({
					x: _month_int, 
					y: parseFloat(yearly_data[_month]["f_avg"].toFixed(1))
				});
			max_sample.push({
					x: _month_int, 
					y: parseFloat(yearly_data[_month]["f_max"].toFixed(1))
				});
			min_sample.push({
					x: _month_int, 
					y: parseFloat(yearly_data[_month]["f_min"].toFixed(1))
				});
			
			if(year_min_f > yearly_data[_month]["f_min"])
			{
				year_min_f = yearly_data[_month]["f_min"];
				year_min_ts = yearly_data[_month]["i_min_ts"];
			}
			
			if(year_max_f < yearly_data[_month]["f_max"])
			{
				year_max_f = yearly_data[_month]["f_max"];
				year_max_ts = yearly_data[_month]["i_max_ts"];
			}
			
			year_buff_f += yearly_data[_month]["f_avg"];
			year_buff_counter += 1;
		}
		
		year_min_ts *= 1000;
		year_max_ts *= 1000;
		var y_min = {"value": parseFloat(year_min_f.toFixed(1)), 
					 "ts": year_min_ts};
		var y_avg = {"value": parseFloat((year_buff_f/year_buff_counter)
															.toFixed(1))};
		var y_max = {"value": parseFloat(year_max_f.toFixed(1)), 
					 "ts": year_max_ts};
		
		var result = {
			"avg_serie": avg_sample, "max_serie": max_sample,
			"min_serie": min_sample, "y_min": y_min, "y_max": y_max,
			"y_avg": y_avg
		};
		
		return result;
	}
	
	/** function _create_ychart_general_serie
	 * month_avg
	 * month_max
	 * month_min
	 * station_tz
	 * serie_id
	 * @returns: general properties table
	 */
	_create_ychart_general_serie(self, year_avg, year_max, year_min, 
												  station_tz, serie_id)
	{
		console.log("month_avg " + JSON.stringify(year_avg));
		console.log("month_max " + JSON.stringify(year_max));
		console.log("month_min " + JSON.stringify(year_min));
		console.log("station_tz " + station_tz);
		console.log("serie_id " + serie_id);
		
		var t_min = moment(year_min["ts"])
									.tz(station_tz).format("YYYY-MM-DD HH:mm");
		var t_max = moment(year_max["ts"])
									.tz(station_tz).format("YYYY-MM-DD HH:mm");
		
		var yearly_general_serie = 
		[{			
			type: "bar",
			indexLabelFontSize: 14,
			dataPoints:	[{
				y: year_min["value"], 
				label: "MIN "+t_min, 
				indexLabel: year_min["value"].toString(),
				color: serie_sampleColorTrans(serie_id, "MIN")
			},
			{
				y: year_avg["value"], 
				label: "AVG", 
				indexLabel: year_avg["value"].toString(),
				color: serie_sampleColorTrans(serie_id, "AVG")
			},
			{	
				y: year_max["value"], 
				label: "MAX "+t_max, 
				indexLabel: year_max["value"].toString(),
				color: serie_sampleColorTrans(serie_id, "MAX")
			}]
		}];
		
		return yearly_general_serie;
	}
	
	/** _create_ychart_general_template
	 * 
	 */
	_create_ychart_general_template(self)
	{
		var chart = new CanvasJS.Chart(this.__ychart_gen_cont_id,
	    {
			animationEnabled: true,
			title:
			{
				fontSize: 16
			},
			backgroundColor: null,
			axisY: 
			{
				titleFontSize: 16,
				labelFontSize: 12
			},
			axisX: 
			{
				titleFontSize: 16,
				labelFontSize: 12
			},
			theme: "theme1",
			backgroundColor: null,
			data: [],
			toolTip: {},
	    });
		
		return chart;
	}
	
	/** _create_ymonthly_serie
	 * 
	 */
	_create_ymonthly_serie(self,avg_sample,min_sample,max_sample,serie_id,type)
	{		
		var avg_serie = { 
			type: type,  
			dataPoints: avg_sample,
			showInLegend: true,
			name: "AVG",
			visible: true,
			color: serie_sampleColorTrans(serie_id, "AVG")
		};

		var max_serie = { 
			type: type,  
			dataPoints: max_sample,
			showInLegend: true,
			name: "MAX",
			visible: true,
			color: serie_sampleColorTrans(serie_id, "MAX")
		};
		
		var min_serie = { 
			type: type,  
			dataPoints: min_sample,
			showInLegend: true,
			name: "MIN",
			visible: true,
			color: serie_sampleColorTrans(serie_id, "MIN")
		};

		return [max_serie, avg_serie, min_serie];
	}
	
	/** _create_ychart_template
	 * 
	 */
	_create_ychart_template(self)
	{
		var chart = new CanvasJS.Chart(self.__ychart_cont_id,
	    {
			animationEnabled: true,
			theme: "theme1",
			title:
			{
				fontSize: 16
			},
			zoomEnabled: true,
			backgroundColor: null,
			axisY: {
				titleFontSize: 16,
				labelFontSize: 12,
				stripLines:[]
			},
			axisX: {
				titleFontSize: 16,
				labelFontSize: 12,
				interval: 1
			},
			legend: {
				cursor: "pointer",
				fontSize: 16,
				itemclick: function(e)	{
					if (typeof(e.dataSeries.visible) === "undefined" 
						|| e.dataSeries.visible) {
						
						if(self.__unvisible_counter < 2)	{
							e.dataSeries.visible = false;
							self.__unvisible_counter += 1;
						}
					}
					else {
						e.dataSeries.visible = true;
						self.__unvisible_counter -= 1;
					}
					
					self.__ychart.render();
				}
			},
			toolTip: {},
			data: []
	    });
		
		return chart;
	}
	
	/** function redraw
	 * uid: station string uid (format: DEVICENAME_UID or just UID)
	 * serie: "Temperature", "Humidity"
	 * dt_str: "YYYY"
	 */
	redraw(uid, serie, dt_str)
	{
		console.log("redraw("+uid+", "+serie+", "+dt_str+")");
		
		// Extract short UID from device_name_uid format (e.g., "RODOS_110020FF0001" -> "110020FF0001")
		var shortUid = uid.includes("_") ? uid.split("_").slice(1).join("_") : uid;
		
		// Convert serie name to serie ID for API call
		var serieId = this.__desc[shortUid]["serie"][serie];
		
		var self = this;
		var param = JSON.stringify({
			"uid": uid, 
			"serie": serieId, 
			"date": dt_str
		});
		
		$.ajax({
			type: "GET",
			url: "/restq/station/serie/yearly/"+param,
			success: function(data) {
//				console.log("yearlyData " + data);
				
				var yearlyData = data;
				
				self.__ychart = self._create_ychart_template(self);
				self.__ychart_general = 
								self._create_ychart_general_template(self);
				
				var serieId = self.__desc[shortUid]["serie"][serie];
				var stationTz = self.__desc[shortUid]["timezone"];
        		var serieUnit = serie_getUnit(self.__desc[shortUid]["serie"][serie]);
        		self.__currSerie = serie;
        		self.__currUid = shortUid;
        		
        		/* Yearly chart */
        		if(serie == "Humidity") {
        			self.__ychart.options.axisY.maximum = 102; 
        		}
        		var chartTitle = dt_str + " " + serie.toUpperCase();
        		self.__ychart.options.title.text = chartTitle;
        		self.__ychart.options.axisY.title = serie;
        		self.__ychart.options.axisY.labelFormatter = function(e) 
        							{
        								return e.value.toFixed(1)+serieUnit;
        							};
        		self.__ychart.options.axisY.stripLines = 
        				serie_getLabelColors(self.__desc[shortUid]["serie"][serie]);
        		        		
        		self.__yearlyParsed = self._parse_ydata(self, yearlyData);
        		
        		self._set_chart_btn_type(self, "CANDLE");
        		
//        		self.__ychart.options.data = self._create_ymonthly_serie(self, 
//        								self.__yearlyParsed["avg_sample"], 
//        								self.__yearlyParsed["min_sample"], 
//        								self.__yearlyParsed["max_sample"], 
//        								serieId);
//        		
//        		self.__ychart.render();
        		
        		/* Yearly general chart create */
        		if(serie == "Humidity") {
        			self.__ychart_general.options.axisY.maximum = 102; 
        		}
        		self.__ychart_general.options.title.text = 
														dt_str + " STATISTICS";
				self.__ychart_general.options.axisY.title = serie;
				self.__ychart_general.options.axisY.labelFormatter = 
									function(e) 
									{
										return e.value.toFixed(1)+serieUnit;
									};
				var generalSample = self._create_ychart_general_serie(self, 
												self.__yearlyParsed["y_avg"],
												self.__yearlyParsed["y_max"],
												self.__yearlyParsed["y_min"],
												stationTz, serieId);
				self.__ychart_general.options.data = generalSample;
				
				var serieUnit = serie_getUnit(
										self.__desc[shortUid]["serie"][serie]);
				self.__ychart_general.options.toolTip.content = 
										"{label}: {y}"+serieUnit;
				
				self.__ychart_general.render();
				
				/* Yearly months table */
				self._create_ychart_daily_table(self, yearlyData, serieUnit,
						stationTz);
			}
		});
	}
}

/* 	------------------------------------------------------------------------- /
	end of file
	------------------------------------------------------------------------ */
